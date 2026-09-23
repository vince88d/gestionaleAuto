// Numeri e elenchi della Dashboard. Funzioni pure (testate): ricevono gia'
// solo le prenotazioni "visibili" (niente annullate ne' richieste del sito non
// pagate) e il giorno di oggi come 'YYYY-MM-DD'.
import { daAssegnare } from './assegnazioneVeicolo';
import { SCADENZE_VEICOLO } from './scadenze';
import { veicoloLibero } from './disponibilitaCategoria';

const giorno = (valore) => (valore ? String(valore).slice(0, 10) : '');

// Prezzo di una prenotazione: le richieste del sito non ancora assegnate a un
// veicolo hanno il prezzo in `totale` (diventa `prezzoTotale` all'assegnazione).
export function prezzoPrenotazione(p) {
  const valore = parseFloat(p?.prezzoTotale || p?.totale);
  return Number.isFinite(valore) ? valore : 0;
}

const conta = (p) => p.status === 'attiva' || p.status === 'completata';

// Giorni tra oggi e la data (negativo se passata), senza sorprese di fuso orario.
function giorniDa(oggi, data) {
  const [a1, m1, g1] = oggi.split('-').map(Number);
  const [a2, m2, g2] = giorno(data).split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, g2) - Date.UTC(a1, m1 - 1, g1)) / 86400000);
}

// Prenotazioni che occupano un veicolo (le concluse lo hanno gia' liberato).
// Occupano un veicolo solo le prenotazioni attive: non le concluse, le
// annullate o i pagamenti del sito non andati a buon fine.
export const prenotazioniOccupanti = (prenotazioni) => (prenotazioni || []).filter((p) => p.status === 'attiva');

export function veicoliLiberiNelPeriodo(veicoli, dataInizio, dataFine, prenotazioni, holds) {
  const occupanti = prenotazioniOccupanti(prenotazioni);
  return (veicoli || []).filter((v) => veicoloLibero(v, dataInizio, dataFine, veicoli, occupanti, holds));
}

export function riepilogoDashboard({ veicoli = [], prenotazioni = [], holds = [], oggi }) {
  const attive = prenotazioni.filter((p) => p.status === 'attiva');
  const perVeicolo = (p) => veicoli.find((v) => v.targa && v.targa === p.targa);

  const danniDaRiparare = [
    ...veicoli.flatMap((v) =>
      (v.danni || []).filter((d) => d.daRiparare).map((d) => ({ veicolo: v, descrizione: d.descrizione, origine: 'veicolo' }))
    ),
    ...prenotazioni
      .filter((p) => p.status === 'completata' && p.daRiparare)
      .map((p) => ({ veicolo: perVeicolo(p), descrizione: p.descrizioneDanno, origine: 'riconsegna' }))
      .filter((d) => d.veicolo),
  ];

  const scadenze = veicoli
    .flatMap((v) =>
      SCADENZE_VEICOLO.map(({ chiave, nome }) => {
        const data = v.scadenze?.[chiave];
        if (!data) return null;
        const giorni = giorniDa(oggi, data);
        return giorni <= 30 ? { veicolo: v, nome, data, giorni } : null;
      })
    )
    .filter(Boolean)
    .sort((a, b) => a.giorni - b.giorni);

  const mese = oggi.slice(0, 7);

  return {
    flotta: veicoli.length,
    liberiOggi: veicoliLiberiNelPeriodo(veicoli, oggi, oggi, prenotazioni, holds),
    inCorso: attive.filter((p) => giorno(p.dataInizio) <= oggi && giorno(p.dataFine) >= oggi),
    inArrivo: attive.filter((p) => giorno(p.dataInizio) > oggi),
    ritiriOggi: attive.filter((p) => giorno(p.dataInizio) === oggi),
    riconsegneOggi: attive.filter((p) => giorno(p.dataFine) === oggi),
    incassoMese: prenotazioni
      .filter((p) => conta(p) && giorno(p.dataInizio).slice(0, 7) === mese)
      .reduce((totale, p) => totale + prezzoPrenotazione(p), 0),
    daAssegnare: prenotazioni.filter(daAssegnare).sort((a, b) => giorno(a.dataInizio).localeCompare(giorno(b.dataInizio))),
    danniDaRiparare,
    scadenze,
  };
}

// Ultimi 12 mesi (compreso quello in corso), dal piu' vecchio: numero di
// prenotazioni e incasso per mese di inizio. Prima i grafici sommavano lo
// stesso mese di anni diversi.
export function serieUltimi12Mesi(prenotazioni, oggi) {
  const [anno, meseOggi] = oggi.split('-').map(Number);
  const mesi = Array.from({ length: 12 }, (_, i) => {
    const data = new Date(anno, meseOggi - 1 - (11 - i), 1);
    const chiave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    const nome = data.toLocaleString('it-IT', { month: 'short' });
    // `nome` per l'asse del grafico (solo il mese), `mese` con l'anno per il riquadro al passaggio del mouse.
    return { chiave, nome, mese: `${nome} ${data.getFullYear()}`, prenotazioni: 0, incasso: 0 };
  });
  const perChiave = new Map(mesi.map((m) => [m.chiave, m]));
  (prenotazioni || []).filter(conta).forEach((p) => {
    const m = perChiave.get(giorno(p.dataInizio).slice(0, 7));
    if (!m) return;
    m.prenotazioni += 1;
    m.incasso += prezzoPrenotazione(p);
  });
  return mesi;
}
