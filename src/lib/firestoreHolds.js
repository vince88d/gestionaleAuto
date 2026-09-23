import { db } from '../components/firebase';
import { useEffect, useState } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';

const HOLDS_COLLECTION = 'holds';

// Gli hold sono creati/eliminati solo dalle Cloud Function del sito (le
// Firestore rules vietano ai client di scriverli): qui li leggiamo soltanto,
// per sapere quante unità di ogni categoria sono momentaneamente bloccate da
// un cliente che sta pagando online.
export async function readHolds() {
  const snapshot = await getDocs(collection(db, HOLDS_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Hold in tempo reale: un cliente che inizia a pagare sul sito blocca subito
// la categoria anche nel gestionale (prima si rileggevano ogni 30 secondi o
// solo all'apertura della pagina).
export function useHolds() {
  const [holds, setHolds] = useState([]);
  useEffect(() => onSnapshot(
    collection(db, HOLDS_COLLECTION),
    (snapshot) => setHolds(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => console.error('Errore lettura hold del sito:', error),
  ), []);
  return holds;
}
