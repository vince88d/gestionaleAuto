import { db } from '../components/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { normalizzaTariffe } from '../utils/tariffe';

// Prezzo al giorno di ogni categoria, letto anche dal sito e dal server per calcolare
// il totale da pagare. Documento: impostazioni/tariffe → { prezziGiorno: { "City Car": 25 } }
const TARIFFE_DOC = ['impostazioni', 'tariffe'];

export async function readTariffe() {
  const snapshot = await getDoc(doc(db, ...TARIFFE_DOC));
  return normalizzaTariffe(snapshot.data()?.prezziGiorno);
}

// Sostituisce tutte le tariffe: una categoria assente dall'elenco non ha più tariffa.
export async function writeTariffe(prezziGiorno) {
  await setDoc(doc(db, ...TARIFFE_DOC), { prezziGiorno, aggiornatoIl: serverTimestamp() });
  return true;
}
