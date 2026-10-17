import { db, auth } from '../components/firebase';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

// Cosa puo' fare il cliente sul sito (documento impostazioni/sito, campo modalita):
//   'pagamento'  vede i prezzi e prenota pagando con carta (come prima)
//   'richiesta'  niente prezzi ne' pagamento: manda una richiesta e lo staff lo
//                richiama (vedi components/RichiesteSito.jsx)
// Documento assente = 'pagamento'. Deve restare allineato al sito
// (formiarent/src/lib/modalitaSito.ts, functions/src/modalitaSito.ts) e alle
// regole Firestore, che in 'richiesta' nascondono i prezzi a chi non e' staff.
const SITO_DOC = ['impostazioni', 'sito'];

export const normalizzaModalita = (dati) => (dati?.modalita === 'richiesta' ? 'richiesta' : 'pagamento');

export function ascoltaModalitaSito(onDati, onErrore) {
  return onSnapshot(doc(db, ...SITO_DOC), (s) => onDati(normalizzaModalita(s.data())), onErrore);
}

// Cambia subito il sito pubblico: chi e quando, come per i prezzi.
export async function salvaModalitaSito(modalita) {
  await setDoc(doc(db, ...SITO_DOC), {
    modalita: modalita === 'richiesta' ? 'richiesta' : 'pagamento',
    aggiornatoIl: serverTimestamp(),
    aggiornatoDa: auth.currentUser?.email || '',
  }, { merge: true });
}
