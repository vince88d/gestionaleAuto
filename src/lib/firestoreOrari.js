import { useEffect, useState } from 'react';
import { db, auth } from '../components/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { normalizzaOrari, preparaOrari } from '../utils/orari';

// Orari della sede (impostazioni/orari): li legge anche il sito, per
// mostrarli e far scegliere l'ora di ritiro e riconsegna (vedi utils/orari.js).
const ORARI_DOC = ['impostazioni', 'orari'];

// Orari in tempo reale. `esiste` false = mai salvati: si mostrano quelli di
// partenza (gli stessi del sito di oggi).
export function ascoltaOrari(onDati, onErrore) {
  return onSnapshot(
    doc(db, ...ORARI_DOC),
    (snapshot) => onDati({ orari: normalizzaOrari(snapshot.data()), esiste: snapshot.exists() }),
    onErrore,
  );
}

export async function salvaOrari(form) {
  await setDoc(doc(db, ...ORARI_DOC), {
    ...preparaOrari(form),
    aggiornatoIl: serverTimestamp(),
    aggiornatoDa: auth.currentUser?.email || '',
  });
}

// Orari per le altre pagine (es. Nuova prenotazione). null finche' non arrivano.
export function useOrari() {
  const [orari, setOrari] = useState(null);
  useEffect(() => ascoltaOrari(({ orari: o }) => setOrari(o), (e) => {
    console.error('Errore lettura orari:', e);
    setOrari(normalizzaOrari(undefined));
  }), []);
  return orari;
}
