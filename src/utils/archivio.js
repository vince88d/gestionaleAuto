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

// ---- Periodo, totali ed esportazione ------------------------------------

// Data con cui un elemento dell'archivio "cade" in un periodo: per i noleggi
// conclusi il giorno di fine noleggio, per gli annullati il giorno
// dell'annullamento (o, se manca, quello di inizio).
export function dataDiRiferimento(p) {
  if (eAnnullamento(p)) return giorno(dataAnnullamento(p)) || giorno(p.dataInizio);
  return giorno(p.dataFine);
}

// Anni presenti nell'archivio, dal piu' recente.
export function anniDisponibili(prenotazioni = []) {
  const anni = new Set(prenotazioni.map((p) => dataDiRiferimento(p).slice(0, 4)).filter(Boolean));
  return [...anni].sort().reverse();
}

// `anno` ('' = tutti), `mese` ('' = tutto l'anno, altrimenti '01'...'12').
export function filtraPeriodo(prenotazioni = [], { anno = '', mese = '' } = {}) {
  if (!anno) return prenotazioni;
  const prefisso = mese ? `${anno}-${mese}` : anno;
  return prenotazioni.filter((p) => dataDiRiferimento(p).startsWith(prefisso));
}

const somma = (elenco, campo) => Math.round(elenco.reduce((n, p) => n + importiArchivio(p)[campo], 0) * 100) / 100;

export function riepilogoConclusi(prenotazioni = []) {
  return { numero: prenotazioni.length, incassato: somma(prenotazioni, 'totale') };
}

// Per gli annullati: quanto si era pagato, quanto e' tornato al cliente e
// quanto e' rimasto (le penali).
export function riepilogoAnnullati(prenotazioni = []) {
  return {
    numero: prenotazioni.length,
    pagato: somma(prenotazioni, 'totale'),
    rimborsato: somma(prenotazioni, 'rimborsato'),
    trattenuto: somma(prenotazioni, 'trattenuto'),
  };
}

const origine = (p) => (p.origine === 'sito' ? 'Sito' : 'Ufficio');
const numeroIt = (n) => (n ? String(n).replace('.', ',') : '0');
const dataIt = (valore) => (giorno(valore) ? giorno(valore).split('-').reverse().join('/') : '');

// Righe per il CSV (prima riga = intestazioni). Numeri con la virgola e date
// gg/mm/aaaa, cosi' Excel in italiano li legge bene.
export function righeCsv(prenotazioni = [], tipo = 'conclusi') {
  if (tipo === 'annullati') {
    return [
      ['Cliente', 'Codice fiscale', 'Email', 'Veicolo/Categoria', 'Inizio', 'Fine', 'Annullata il', 'Annullata da', 'Pagato', 'Rimborsato', 'Penale trattenuta'],
      ...prenotazioni.map((p) => {
        const i = importiArchivio(p);
        return [
          p.cliente, p.codiceFiscale, p.emailCliente, p.veicolo || p.categoria, dataIt(p.dataInizio), dataIt(p.dataFine),
          dataIt(dataAnnullamento(p)), p.annullataDa === 'cliente' ? 'Cliente' : 'Staff',
          numeroIt(i.totale), numeroIt(i.rimborsato), numeroIt(i.trattenuto),
        ];
      }),
    ];
  }
  return [
    ['Cliente', 'Codice fiscale', 'Email', 'Veicolo', 'Targa', 'Inizio', 'Fine', 'Rientro', 'Importo', 'Origine', 'Danni alla riconsegna'],
    ...prenotazioni.map((p) => [
      p.cliente, p.codiceFiscale, p.emailCliente, p.veicolo || p.categoria, p.targa, dataIt(p.dataInizio), dataIt(p.dataFine),
      dataIt(p.dataRientroEffettiva), numeroIt(importiArchivio(p).totale), origine(p), p.descrizioneDanno || '',
    ]),
  ];
}

// Testo CSV con il punto e virgola (separatore di Excel in italiano).
export function testoCsv(righe) {
  const cella = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return righe.map((r) => r.map(cella).join(';')).join('\r\n');
}
