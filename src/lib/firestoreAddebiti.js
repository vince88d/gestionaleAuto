import { useEffect, useState } from 'react';
import { db, auth } from '../components/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { normalizzaAddebiti, preparaAddebiti } from '../utils/addebiti';

// Prezzi fissi degli addebiti al rientro (impostazioni/addebiti), solo staff.
// Il sito non li legge.
const ADDEBITI_DOC = ['impostazioni', 'addebiti'];

export function ascoltaAddebiti(onDati, onErrore) {
  return onSnapshot(
    doc(db, ...ADDEBITI_DOC),
    (snapshot) => onDati(normalizzaAddebiti(snapshot.data())),
    onErrore,
  );
}

export async function salvaAddebiti(form) {
  await setDoc(doc(db, ...ADDEBITI_DOC), {
    ...preparaAddebiti(form),
    aggiornatoIl: serverTimestamp(),
    aggiornatoDa: auth.currentUser?.email || '',
  });
}

// Prezzi per la finestra di rientro. Finche' non arrivano (o se la lettura
// fallisce) valgono quelli di partenza.
export function useAddebiti() {
  const [prezzi, setPrezzi] = useState(() => normalizzaAddebiti(undefined));
  useEffect(() => ascoltaAddebiti(setPrezzi, (e) => console.error('Errore lettura addebiti:', e)), []);
  return prezzi;
}
