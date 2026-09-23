// Regole della pagina Prenotazioni (funzioni pure, testate).
import { calcolaGiorniNoleggio } from './giorniNoleggio';
import { veicoloLibero, disponibiliPerCategoria } from './disponibilitaCategoria';
import { daAssegnare } from './assegnazioneVeicolo';
import { prezzoPrenotazione } from './dashboard';

const STATI_NON_OCCUPANTI = ['annullata', 'completata', 'richiesta-sito', 'scaduta', 'pagamento-fallito'];
const giorno = (valore) => (valore ? String(valore).slice(0, 10) : '');

// Prenotazione pagata sul sito: il prezzo e' quello pagato, non si ricalcola.
export const pagataSulSito = (p) => Boolean(p && (p.paymentIntentId || p.origine === 'sito'));

// Controlli prima di salvare una prenotazione nuova (`originale` assente) o
// modificata. Restituisce { errore } oppure { prezzoTotale } da salvare.
export function controllaPrenotazione({ dati, originale = null, veicoli = [], prenotazioni = [], holds = [], oggi }) {
  const inizio = giorno(dati.dataInizio);
  const fine = giorno(dati.dataFine);
  if (!inizio || !fine) return { errore: 'Inserisci la data di inizio e di fine.' };
  if (fine < inizio) return { errore: 'La data di fine è prima di quella di inizio.' };
  // Una prenotazione nuova non puo' partire nel passato; una esistente gia'
  // iniziata si puo' ancora correggere (es. allungare il rientro).
  const inizioCambiato = !originale || giorno(originale.dataInizio) !== inizio;
  if (inizioCambiato && inizio < oggi) return { errore: 'La data di inizio è già passata.' };

  // Dopo la consegna il cliente ha in mano quel veicolo: km, carburante e
  // contratto sono suoi. Cambiarlo qui lascerebbe una scheda sbagliata.
  if (originale && eConsegnata(originale) && dati.targa !== originale.targa) {
    return { errore: 'Il veicolo è già stato consegnato al cliente: non si può cambiare da qui.' };
  }

  const veicolo = veicoli.find((v) => v.targa && v.targa === dati.targa);
  if (veicolo) {
    // Contano solo le prenotazioni che occupano davvero: non le annullate, non
    // le richieste del sito non pagate/scadute, non i noleggi conclusi, e non
    // quella che si sta modificando.
    const occupanti = occupantiTranne(prenotazioni, originale?.id);
    if (!veicoloLibero(veicolo, inizio, fine, veicoli, occupanti, holds)) {
      const nome = [veicolo.marca, veicolo.modello].filter(Boolean).join(' ') || veicolo.targa;
      return {
        errore: `${nome} (${veicolo.targa}) non è libero in quelle date: è già prenotato, oppure la categoria ${veicolo.categoria || ''} è piena per le prenotazioni del sito.`.replace('  ', ' '),
      };
    }
  }

  if (originale && pagataSulSito(originale)) {
    return { prezzoTotale: prezzoPrenotazione(originale) };
  }
  const giorni = calcolaGiorniNoleggio(inizio, fine);
  return { prezzoTotale: giorni * (parseFloat(dati.prezzoGiornaliero) || 0) };
}

// Prenotazioni che occupano davvero un veicolo (niente annullate, pagamenti
// del sito falliti o scaduti, noleggi conclusi), tolta quella in modifica.
export const occupantiTranne = (prenotazioni, idEscluso) =>
  (prenotazioni || []).filter((p) => !STATI_NON_OCCUPANTI.includes(p.status) && (!idEscluso || p.id !== idEscluso));

// Per la scelta del veicolo nel form: 'libero', 'occupato' (la sua targa ha
// gia' un noleggio in quelle date) o 'categoria-piena' (hold e prenotazioni del
// sito non ancora assegnate hanno preso tutti i posti della categoria).
// Senza date non si sa: 'da-verificare'.
export function statoVeicoloNelPeriodo({ veicolo, inizio, fine, veicoli, prenotazioni, holds, idEscluso }) {
  const da = giorno(inizio);
  const a = giorno(fine);
  if (!da || !a || a < da) return 'da-verificare';
  const occupanti = occupantiTranne(prenotazioni, idEscluso);
  const occupatoPerTarga = occupanti.some(
    (p) => veicolo.targa && p.targa === veicolo.targa && giorno(p.dataInizio) <= a && giorno(p.dataFine) >= da
  );
  if (occupatoPerTarga) return 'occupato';
  if (veicolo.categoria && disponibiliPerCategoria(veicolo.categoria, da, a, veicoli, occupanti, holds) <= 0) {
    return 'categoria-piena';
  }
  return 'libero';
}

// Giorni ('AAAA-MM-GG') in cui quel veicolo e' gia' noleggiato: nel
// calendario del form non si possono scegliere.
export function giorniOccupati({ targa, prenotazioni, idEscluso }) {
  if (!targa) return [];
  const giorni = [];
  occupantiTranne(prenotazioni, idEscluso)
    .filter((p) => p.targa === targa && p.dataInizio && p.dataFine)
    .forEach((p) => {
      const d = new Date(`${giorno(p.dataInizio)}T12:00:00`);
      const fine = giorno(p.dataFine);
      for (let i = 0; i < 400; i += 1) {
        const g = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (g > fine) break;
        giorni.push(g);
        d.setDate(d.getDate() + 1);
      }
    });
  return giorni;
}

// Consegnata: il veicolo e' stato dato al cliente (scheda con km e carburante
// compilata). Le prenotazioni fatte prima di separare prenotazione e consegna
// hanno la scheda ma non `consegnataIl`: valgono come consegnate.
export const eConsegnata = (p) => Boolean(p?.consegnataIl || p?.schedaVeicolo?.kmIniziali);

const conVeicolo = (p) => p?.status === 'attiva' && Boolean(p.targa) && !daAssegnare(p);

// Si consegna un noleggio attivo con il veicolo assegnato e non ancora dato.
export const puoConsegnare = (p) => conVeicolo(p) && !eConsegnata(p);

// Si conclude (riconsegna) solo un noleggio gia' consegnato.
export const puoConcludere = (p) => conVeicolo(p) && eConsegnata(p);

// A che punto e' una prenotazione attiva, per i filtri della pagina.
export function faseLavoro(p, oggi) {
  if (!eConsegnata(p)) return 'da-consegnare';
  return giorno(p.dataFine) < oggi ? 'da-concludere' : 'in-corso';
}

// Cosa ricordare sulla riga: il ritiro se non e' ancora consegnata, il
// rientro se il cliente ha il veicolo. `livello` colora la riga.
export function promemoria(p, oggi) {
  const consegnata = eConsegnata(p);
  const data = giorno(consegnata ? p.dataFine : p.dataInizio);
  if (!data || !oggi) return { testo: '—', livello: '' };
  const giorni = Math.round((Date.parse(data) - Date.parse(oggi)) / 86400000);
  const cosa = consegnata ? 'Rientro' : 'Ritiro';
  if (giorni < 0) {
    return {
      testo: consegnata ? `Rientro scaduto da ${-giorni} gg` : `Ritiro passato da ${-giorni} gg`,
      livello: 'urgente',
    };
  }
  if (giorni === 0) return { testo: `${cosa} oggi`, livello: 'urgente' };
  if (giorni === 1) return { testo: `${cosa} domani`, livello: 'domani' };
  return { testo: `${cosa} tra ${giorni} gg`, livello: giorni === 2 ? 'prossima' : '' };
}

// "Concludi in blocco": solo i noleggi finiti da ieri o prima (quelli che
// finiscono oggi il veicolo magari non e' ancora rientrato).
export function daConcludereInBlocco(prenotazioni, oggi) {
  return (prenotazioni || []).filter((p) => puoConcludere(p) && giorno(p.dataFine) < oggi);
}

export { senzaUndefined } from './senzaUndefined';
