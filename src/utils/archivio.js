// Regole della pagina Archivio (funzioni pure, testate).
import { pagataSulSito, occupantiTranne } from './regolePrenotazione';
import { prezzoPrenotazione } from './dashboard';

const giorno = (valore) => (valore ? String(valore).slice(0, 10) : '');

// Annullamento vero di una prenotazione confermata (dal cliente con il link o
// dallo staff, con l'eventuale rimborso). Il sito segna 'annullata' anche i
// pagamenti abbandonati a meta' checkout: quelli non hanno `annullataDa` e
// nell'Archivio non servono.
export const eAnnullamento = (p) => p?.status === 'annullata' && Boolean(p.annullataDa);

// Data dell'annullamento: dal sito arriva come Timestamp di Firestore.
export function dataAnnullamento(p) {
  const valore = p?.annullataIl;
  if (!valore) return '';
  const data = typeof valore.toDate === 'function' ? valore.toDate() : new Date(valore);
  return Number.isNaN(data.getTime()) ? '' : data.toISOString();
}

// Un noleggio pagato sul sito resta per i conti (e per il pagamento su
// Stripe): si puo' ripristinare ma non eliminare.
export const puoEliminareDaArchivio = (p) => !pagataSulSito(p);

// Campi da scrivere per rimettere attivo un noleggio concluso: si tolgono
// tutti i dati della riconsegna (data di rientro, danni, foto, riparazione).
export const CAMPI_RIPRISTINO = {
  status: 'attiva',
  dataRientroEffettiva: null,
  descrizioneDanno: '',
  fotoDanni: null,
  daRiparare: false,
  riparatoIn: null,
};

// Un'altra prenotazione attiva che occupa lo stesso veicolo nelle date del
// noleggio da ripristinare (null se il veicolo e' libero).
export function conflittoRipristino(prenotazione, prenotazioni = []) {
  if (!prenotazione?.targa) return null;
  const inizio = giorno(prenotazione.dataInizio);
  const fine = giorno(prenotazione.dataFine);
  return occupantiTranne(prenotazioni, prenotazione.id).find(
    (p) => p.targa === prenotazione.targa && giorno(p.dataInizio) <= fine && giorno(p.dataFine) >= inizio
  ) || null;
}

// Ricerca su piu' parole: cliente, email, codice fiscale, veicolo, targa, categoria.
export function cercaArchivio(prenotazioni = [], testo = '') {
  const parole = testo.toLowerCase().split(/\s+/).filter(Boolean);
  return prenotazioni.filter((p) => {
    const t = [p.cliente, p.emailCliente, p.codiceFiscale, p.veicolo, p.targa, p.categoria]
      .filter(Boolean).join(' ').toLowerCase();
    return parole.every((parola) => t.includes(parola));
  });
}

// Dal noleggio finito (o annullato) piu' di recente.
export const ordinaPerRecenti = (prenotazioni = []) =>
  prenotazioni.slice().sort((a, b) => giorno(b.dataFine).localeCompare(giorno(a.dataFine)));

// Importo per l'elenco: il pagato (o concordato); per gli annullati anche
// quanto e' stato rimborsato e trattenuto.
export function importiArchivio(p) {
  return {
    totale: Number(prezzoPrenotazione(p)) || 0,
    rimborsato: Number(p.rimborsato) || 0,
    trattenuto: Number(p.penaleTrattenuta) || 0,
  };
}
