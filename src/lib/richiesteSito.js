import { httpsCallable } from 'firebase/functions';
import { functions } from '../components/firebase';

// Conferma o rifiuta una richiesta dal sito senza pagamento (Cloud Functions
// riservate allo staff, vedi formiarent/functions/src/richieste.ts). Il server
// manda l'email al cliente e libera l'auto (rifiuto) o la prenota (conferma).
const conferma = httpsCallable(functions, 'confermaRichiestaSito');
const rifiuta = httpsCallable(functions, 'rifiutaRichiestaSito');

export async function confermaRichiestaSito(prenotazioneId, totale) {
  await conferma({ prenotazioneId, totale });
}

export async function rifiutaRichiestaSito(prenotazioneId) {
  await rifiuta({ prenotazioneId });
}

// Il messaggio del server, senza il " [codice HTTP]" che aggiunge l'SDK.
export function messaggioErroreRichiesta(err) {
  if (err?.code === 'functions/permission-denied' || err?.code === 'functions/unauthenticated') {
    return 'Non hai i permessi: accedi di nuovo come staff.';
  }
  return err?.message?.replace(/\s*\[\d{3}\]$/, '') || 'Operazione non riuscita, riprova.';
}
