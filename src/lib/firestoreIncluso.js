import { useEffect, useState } from 'react';
import { db, auth } from '../components/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { normalizzaIncluso, preparaIncluso } from '../utils/incluso';

// Voci di «Cosa e' incluso nel noleggio» (impostazioni/incluso): le legge anche
// il sito (vedi utils/incluso.js).
const INCLUSO_DOC = ['impostazioni', 'incluso'];

// In tempo reale. `dati` sono quelli grezzi del documento (undefined se mai salvato).
export function ascoltaIncluso(onDati, onErrore) {
  return onSnapshot(
    doc(db, ...INCLUSO_DOC),
    (snapshot) => onDati({ dati: snapshot.data(), esiste: snapshot.exists() }),
    onErrore,
  );
}

export async function salvaIncluso(form) {
  await setDoc(doc(db, ...INCLUSO_DOC), {
    ...preparaIncluso(form),
    aggiornatoIl: serverTimestamp(),
    aggiornatoDa: auth.currentUser?.email || '',
  });
}

// null finche' non arrivano.
export function useIncluso() {
  const [incluso, setIncluso] = useState(null);
  useEffect(() => ascoltaIncluso(({ dati }) => setIncluso(normalizzaIncluso(dati)), (e) => {
    console.error('Errore lettura delle voci incluse:', e);
    setIncluso(normalizzaIncluso(undefined));
  }), []);
  return incluso;
}
