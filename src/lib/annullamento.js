import { httpsCallable } from 'firebase/functions';
import { functions } from '../components/firebase';

const annullaPrenotazioneCallable = httpsCallable(functions, 'annullaPrenotazione');

// Annulla una prenotazione pagata online e rimborsa su Stripe (Cloud Function
// `annullaPrenotazione`, riservata allo staff: usa l'utente loggato).
// `penale` è facoltativa: { percentuale } oppure { importo } in euro da trattenere
// (solo se prevista dalle condizioni di noleggio); senza, il rimborso è totale.
// Se il rimborso non riesce la funzione lancia un errore e la prenotazione resta
// attiva. Restituisce gli importi in euro.
export async function annullaConRimborso(prenotazioneId, penale) {
  const { data } = await annullaPrenotazioneCallable({ prenotazioneId, ...(penale ? { penale } : {}) });
  return {
    rimborsato: data.rimborsato || 0,
    trattenuto: data.trattenuto || 0,
    giaRimborsato: Boolean(data.giaRimborsato),
  };
}

// Il messaggio d'errore leggibile per lo staff (la funzione già lo scrive in italiano).
export function messaggioErroreRimborso(err) {
  if (err?.code === 'functions/permission-denied' || err?.code === 'functions/unauthenticated') {
    return "Non hai i permessi per annullare: accedi di nuovo come staff.";
  }
  // L'SDK di Firebase aggiunge " [codice HTTP]" in coda al messaggio: lo togliamo.
  return err?.message?.replace(/\s*\[\d{3}\]$/, '') || 'Impossibile annullare la prenotazione, riprova.';
}
