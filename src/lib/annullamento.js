import { httpsCallable } from 'firebase/functions';
import { functions } from '../components/firebase';

const annullaPrenotazioneCallable = httpsCallable(functions, 'annullaPrenotazione');

// Annulla una prenotazione pagata online e rimborsa l'intero importo su Stripe
// (Cloud Function `annullaPrenotazione`, riservata allo staff: usa l'utente
// loggato). Se il rimborso non riesce la funzione lancia un errore e la
// prenotazione resta attiva. Restituisce l'importo rimborsato in euro.
export async function annullaConRimborso(prenotazioneId) {
  const { data } = await annullaPrenotazioneCallable({ prenotazioneId });
  return { rimborsato: data.rimborsato || 0, giaRimborsato: Boolean(data.giaRimborsato) };
}

// Il messaggio d'errore leggibile per lo staff (la funzione già lo scrive in italiano).
export function messaggioErroreRimborso(err) {
  if (err?.code === 'functions/permission-denied' || err?.code === 'functions/unauthenticated') {
    return "Non hai i permessi per annullare: accedi di nuovo come staff.";
  }
  // L'SDK di Firebase aggiunge " [codice HTTP]" in coda al messaggio: lo togliamo.
  return err?.message?.replace(/\s*\[\d{3}\]$/, '') || 'Impossibile annullare la prenotazione, riprova.';
}
