import { useEffect, useState } from 'react';
import { db, auth } from '../components/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { normalizzaCopiaCartacea, COPIA_CARTACEA_SPENTA } from '../utils/copiaCartacea';

// Copia cartacea dei documenti (impostazioni/copiaCartacea): solo staff.
const COPIA_DOC = ['impostazioni', 'copiaCartacea'];

export function ascoltaCopiaCartacea(onDati, onErrore) {
  return onSnapshot(
    doc(db, ...COPIA_DOC),
    (snapshot) => onDati(normalizzaCopiaCartacea(snapshot.data())),
    onErrore,
  );
}

// Accendere registra la presa visione (chi e quando); spegnere la lascia
// scritta nel documento, cosi' resta traccia di chi l'aveva attivata.
export async function salvaCopiaCartacea(attiva) {
  const dati = attiva
    ? { attiva: true, presaVisioneDa: auth.currentUser?.email || '', presaVisioneIl: new Date().toISOString() }
    : { attiva: false };
  await setDoc(doc(db, ...COPIA_DOC), { ...dati, aggiornatoIl: serverTimestamp() }, { merge: true });
}

// Per la consegna: spenta finche' non arriva il dato (e se la lettura fallisce).
export function useCopiaCartacea() {
  const [dati, setDati] = useState(COPIA_CARTACEA_SPENTA);
  useEffect(() => ascoltaCopiaCartacea(setDati, (e) => {
    console.error('Errore lettura copia cartacea:', e);
    setDati(COPIA_CARTACEA_SPENTA);
  }), []);
  return dati;
}
