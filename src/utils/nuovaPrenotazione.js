// Regole della finestra "Nuova prenotazione" (funzioni pure, testate).
// Ordine dei passi come ragiona chi sta al banco: quando, quale auto, chi.
import { normalizzaCodiceFiscale } from '../lib/firestoreClienti';
import { calcolaGiorniNoleggio } from './giorniNoleggio';

const giorno = (valore) => (valore ? String(valore).slice(0, 10) : '');
const ISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Scelte rapide della durata. Un giorno di noleggio sono 24 ore (vedi
// giorniNoleggio.js): "1 giorno" = rientro il giorno dopo, alla stessa ora.
export const DURATE_RAPIDE = [
  { chiave: '1g', etichetta: '1 giorno', giorni: 1 },
  { chiave: '3g', etichetta: '3 giorni', giorni: 3 },
  { chiave: '1s', etichetta: '1 settimana', giorni: 7 },
  { chiave: '1m', etichetta: '1 mese', mesi: 1 },
];

// Date per una scelta rapida: parte da `inizio` se c'e', altrimenti da oggi.
export function dateRapide(chiave, inizio, oggi) {
  const durata = DURATE_RAPIDE.find((d) => d.chiave === chiave);
  if (!durata) return null;
  const da = giorno(inizio) || oggi;
  const [a, m, g] = da.split('-').map(Number);
  const fine = new Date(a, m - 1, g);
  if (durata.mesi) {
    fine.setMonth(fine.getMonth() + durata.mesi);
    // 31 gennaio + 1 mese = 28/29 febbraio, non 3 marzo.
    if (fine.getDate() !== g) fine.setDate(0);
  } else {
    fine.setDate(fine.getDate() + durata.giorni);
  }
  return { dataInizio: da, dataFine: ISO(fine) };
}

// Con le ore conta anche l'orario, con la tolleranza della prenotazione.
export const giorniDelNoleggio = (dati) =>
  (giorno(dati.dataInizio) && giorno(dati.dataFine) && giorno(dati.dataFine) >= giorno(dati.dataInizio)
    ? calcolaGiorniNoleggio(giorno(dati.dataInizio), giorno(dati.dataFine), dati.oraInizio, dati.oraFine, dati.tolleranzaMinuti)
    : 0);

// Passi compiuti e passo su cui lavorare (1 quando, 2 auto, 3 cliente).
export function statoPassi(dati) {
  const quando = Boolean(giorniDelNoleggio(dati));
  const auto = Boolean(dati.targa);
  const chi = Boolean((dati.cliente || '').trim());
  const attivo = !quando ? 1 : !auto ? 2 : 3;
  return { quando, auto, chi, attivo };
}

const CF_VALIDO = /^[A-Z0-9]{16}$/;
export const codiceFiscaleValido = (cf) => CF_VALIDO.test(normalizzaCodiceFiscale(cf));

// Errori per campo ({} se si puo' salvare). Codice fiscale, patente ed email
// non sono obbligatori qui: si completano alla consegna. Serve pero' un modo
// per contattare il cliente (telefono o email).
export function validaNuovaPrenotazione(dati) {
  const errori = {};
  const inizio = giorno(dati.dataInizio);
  const fine = giorno(dati.dataFine);
  if (!inizio) errori.dataInizio = 'Scegli il giorno in cui esce.';
  if (!fine) errori.dataFine = 'Scegli il giorno in cui rientra.';
  else if (inizio && fine < inizio) errori.dataFine = 'Il rientro è prima dell\'uscita.';
  else if (inizio === fine && dati.oraInizio && dati.oraFine && dati.oraFine <= dati.oraInizio) {
    errori.dataFine = 'Lo stesso giorno il rientro deve essere dopo l\'uscita.';
  }
  if (!dati.targa) errori.targa = 'Scegli l\'auto.';
  if (!(dati.cliente || '').trim()) errori.cliente = 'Scegli il cliente o scrivi nome e cognome.';
  else if (!(dati.telefono || '').trim() && !(dati.emailCliente || '').trim()) {
    errori.telefono = 'Serve almeno un telefono (o un\'email) per contattarlo.';
  }
  if ((dati.emailCliente || '').trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dati.emailCliente.trim())) {
    errori.emailCliente = 'Email non valida.';
  }
  if ((dati.codiceFiscale || '').trim() && !codiceFiscaleValido(dati.codiceFiscale)) {
    errori.codiceFiscale = 'Il codice fiscale ha 16 lettere e numeri (puoi anche lasciarlo vuoto).';
  }
  const prezzo = parseFloat(dati.prezzoGiornaliero);
  if (dati.targa && !(prezzo > 0)) errori.prezzoGiornaliero = 'Scrivi il prezzo al giorno.';
  return errori;
}

// Dati della prenotazione presi da un cliente dell'anagrafica.
export function datiDaCliente(c) {
  return {
    cliente: [c.nome, c.cognome].filter(Boolean).join(' '),
    telefono: c.telefono || c.cellulare || '',
    emailCliente: c.email || '',
    codiceFiscale: normalizzaCodiceFiscale(c.codiceFiscale),
    patente: (c.patente || '').toUpperCase(),
  };
}

// Il cliente ha gia' i documenti che servono alla consegna?
export const documentiCompleti = (c) => codiceFiscaleValido(c?.codiceFiscale) && Boolean(c?.patente);
