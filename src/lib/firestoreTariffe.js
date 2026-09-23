import { db } from '../components/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { normalizzaTariffe } from '../utils/tariffe';

// Prezzo al giorno di ogni categoria, letto anche dal sito e dal server per calcolare
// il totale da pagare. Documento: impostazioni/tariffe → { prezziGiorno: { "City Car": 25 } }
const TARIFFE_DOC = ['impostazioni', 'tariffe'];

export async function readTariffe() {
  const snapshot = await getDoc(doc(db, ...TARIFFE_DOC));
  return normalizzaTariffe(snapshot.data()?.prezziGiorno);
}

// Tariffe in tempo reale: la pagina Tariffe deve accorgersi subito se qualcuno
// le cambia da un'altra postazione, altrimenti rischia di salvare sopra dati
// vecchi senza saperlo.
export function ascoltaTariffe(onDati, onErrore) {
  return onSnapshot(
    doc(db, ...TARIFFE_DOC),
    (snapshot) => onDati(normalizzaTariffe(snapshot.data()?.prezziGiorno)),
    onErrore,
  );
}

// Sostituisce tutte le tariffe: una categoria assente dall'elenco non ha più tariffa.
export async function writeTariffe(prezziGiorno) {
  await setDoc(doc(db, ...TARIFFE_DOC), { prezziGiorno, aggiornatoIl: serverTimestamp() });
  return true;
}
