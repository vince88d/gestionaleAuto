// Rientro dell'auto: calcoli e righe di addebito proposte. Funzioni pure, testate.
// Mockup approvato: formiarent-documenti/mockup/gestionale-rientro.html
//
// Il rientro salva sulla prenotazione `rientro`: { dataRientro, oraRientro,
// km, carburante, chiaviTornate, dotazioneNonTornata, nuoviDanni, addebiti,
// totaleAddebiti, cauzione: { importo, trattenuta, sbloccata, restano } }.
import { calcolaGiorniNoleggio } from './giorniNoleggio';
import { leggiEuro } from './protezioni';

export const LIVELLI = ['1/4', '1/2', '3/4', 'Pieno'];
const arrotonda = (n) => Math.round(n * 100) / 100;
const giorno = (v) => (v ? String(v).slice(0, 10) : '');

// Quarti di serbatoio (1-4); null se il livello non c'e' o non si legge.
export const quartiCarburante = (livello) => {
  const i = LIVELLI.indexOf(String(livello || '').trim());
  return i === -1 ? null : i + 1;
};

// Quarti mancanti rispetto alla consegna (0 se e' tornata con piu' o uguale).
export function quartiMancanti(consegna, rientro) {
  const a = quartiCarburante(consegna);
  const b = quartiCarburante(rientro);
  return a === null || b === null ? 0 : Math.max(0, a - b);
}

// Km percorsi, o null se mancano i km o il rientro e' inferiore alla consegna.
export function kmPercorsi(kmConsegna, kmRientro) {
  const a = Number(kmConsegna);
  const b = Number(kmRientro);
  if (kmConsegna === '' || kmRientro === '' || kmConsegna == null || kmRientro == null) return null;
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : null;
}

// Giorni in piu' da far pagare per il ritardo: giorni contati con l'ora
// effettiva di rientro (e la tolleranza) meno quelli della prenotazione.
// Le prenotazioni senza ore contano solo le date.
export function giorniInPiu({ prenotazione = {}, dataRientro, oraRientro, tolleranza }) {
  const di = giorno(prenotazione.dataInizio);
  const df = giorno(prenotazione.dataFine);
  const dr = giorno(dataRientro);
  if (!di || !df || !dr) return 0;
  const conOre = Boolean(prenotazione.oraInizio && prenotazione.oraFine);
  const toll = tolleranza ?? prenotazione.tolleranzaMinuti ?? 0;
  const previsti = calcolaGiorniNoleggio(di, df, prenotazione.oraInizio, prenotazione.oraFine, toll);
  const effettivi = calcolaGiorniNoleggio(di, dr, conOre ? prenotazione.oraInizio : undefined, conOre ? oraRientro : undefined, toll);
  return Math.max(0, effettivi - previsti);
}

// Ora entro cui si poteva rientrare senza giorni in piu' ("9:29"), o null.
export function rientroEntro(prenotazione = {}, tolleranza) {
  const m = /^(\d{2}):(\d{2})$/.exec(prenotazione.oraFine || '');
  if (!m) return null;
  const toll = tolleranza ?? prenotazione.tolleranzaMinuti ?? 0;
  const tot = Number(m[1]) * 60 + Number(m[2]) + (Number(toll) || 0);
  if (tot >= 1440) return null;
  return `${Math.floor(tot / 60)}:${String(tot % 60).padStart(2, '0')}`;
}

// Franchigia danni della protezione scelta: il cliente non paga di piu'.
export const tettoDanno = (prenotazione) => (typeof prenotazione?.protezione?.danni === 'number' ? prenotazione.protezione.danni : null);

// Righe di addebito proposte dal passo 1. Ogni riga: { id, nome, dettaglio,
// importo (numero o null), attiva }. Il costo del danno non si sa: resta vuoto.
// `prezzi` sono quelli di «Addebiti al rientro» (normalizzati).
export function proponiAddebiti({
  prenotazione = {}, prezzi, dataRientro, oraRientro, carburante, chiaviTornate,
  nonTornati = [], danno = '', tolleranza,
}) {
  const righe = [];
  const giorni = giorniInPiu({ prenotazione, dataRientro, oraRientro, tolleranza });
  if (giorni > 0) {
    const prezzoGiorno = parseFloat(prenotazione.prezzoGiornaliero) || 0;
    righe.push({
      id: 'ritardo',
      nome: `Ritardo: ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'} in più`,
      dettaglio: `${giorni} × ${prezzoGiorno.toLocaleString('it-IT', { minimumFractionDigits: 2 })} € (prezzo al giorno della prenotazione)`,
      importo: arrotonda(giorni * prezzoGiorno),
      attiva: true,
    });
  }
  const quarti = quartiMancanti(prenotazione.schedaVeicolo?.carburante, carburante);
  if (quarti > 0) {
    righe.push({
      id: 'rifornimento',
      nome: 'Rifornimento',
      dettaglio: `Consegnata ${prenotazione.schedaVeicolo?.carburante}, tornata a ${carburante} · ${quarti} ${quarti === 1 ? 'quarto' : 'quarti'} × ${prezzi.rifornimentoQuarto.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €`,
      importo: arrotonda(quarti * prezzi.rifornimentoQuarto),
      attiva: true,
    });
  }
  if (String(danno).trim()) {
    const tetto = tettoDanno(prenotazione);
    righe.push({
      id: 'danno',
      nome: `Danno: ${String(danno).trim().replace(/^./, (c) => c.toLowerCase())}`,
      dettaglio: tetto === null ? 'Scrivi il costo della riparazione' : `Scrivi il costo della riparazione · con la protezione scelta il cliente paga al massimo ${tetto.toLocaleString('it-IT', { useGrouping: 'always' })} €`,
      importo: null,
      attiva: true,
    });
  }
  nonTornati.filter((n) => n.addebita).forEach((n) => {
    righe.push({ id: `mancante:${n.nome}`, nome: `${n.nome} non tornato`, dettaglio: 'Oggetto della dotazione mancante', importo: prezzi.oggettoMancante, attiva: true });
  });
  const consegnate = Number(prenotazione.schedaVeicolo?.dotazione?.chiaviConsegnate) || 0;
  const mancanoChiavi = consegnate > 0 && chiaviTornate != null ? Math.max(0, consegnate - Number(chiaviTornate)) : 0;
  if (mancanoChiavi > 0) {
    righe.push({
      id: 'chiave',
      nome: mancanoChiavi === 1 ? 'Chiave non restituita' : `${mancanoChiavi} chiavi non restituite`,
      dettaglio: `${mancanoChiavi} × ${prezzi.chiave.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €`,
      importo: arrotonda(mancanoChiavi * prezzi.chiave),
      attiva: true,
    });
  }
  righe.push({ id: 'pulizia', nome: 'Pulizia straordinaria', dettaglio: "Spunta se l'auto è tornata molto sporca", importo: prezzi.pulizia, attiva: false });
  return righe;
}

// Importo di una riga come numero (vuoto o sbagliato = 0).
const valore = (r) => {
  const n = leggiEuro(r.importo);
  return n === null || Number.isNaN(n) || n < 0 ? 0 : n;
};

// Errori delle righe attive: ogni riga attiva ha bisogno di un importo.
export function erroriAddebiti(righe = []) {
  const errori = {};
  righe.filter((r) => r.attiva).forEach((r) => {
    const n = leggiEuro(r.importo);
    if (n === null) errori[r.id] = 'Scrivi l\'importo.';
    else if (Number.isNaN(n) || n < 0) errori[r.id] = 'Scrivi un importo, es. 25';
  });
  return errori;
}

// Righe che contano, con l'importo come numero: le sole da salvare. Il danno
// non supera la franchigia della protezione (tetto).
export function addebitiAttivi(righe = [], tettoDannoEuro = null) {
  return righe.filter((r) => r.attiva).map((r) => {
    let importo = arrotonda(valore(r));
    if (r.id === 'danno' && tettoDannoEuro !== null) importo = Math.min(importo, tettoDannoEuro);
    return { id: r.id, nome: r.nome, importo };
  });
}

export const totaleAddebiti = (righe = [], tettoDannoEuro = null) => arrotonda(addebitiAttivi(righe, tettoDannoEuro).reduce((s, r) => s + r.importo, 0));

// Cauzione: si sblocca tutta o si trattiene una parte (di norma il totale
// degli addebiti). Se gli addebiti superano la cauzione resta da pagare la
// differenza. Il gestionale registra soltanto: POS e Stripe si fanno a mano.
export function esitoCauzione({ cauzione, totale, trattieni }) {
  const c = typeof cauzione === 'number' ? cauzione : 0;
  const richiesto = trattieni === undefined || trattieni === null ? 0 : Math.max(0, leggiEuro(trattieni) || 0);
  const trattenuta = arrotonda(Math.min(c, richiesto));
  return {
    importo: c,
    trattenuta,
    sbloccata: arrotonda(c - trattenuta),
    restano: arrotonda(Math.max(0, totale - trattenuta)),
  };
}
