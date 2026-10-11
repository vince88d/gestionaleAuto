import { useEffect, useState } from 'react';
import { db, auth } from '../components/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { normalizzaEtaConducenti, preparaEtaConducenti } from '../utils/etaConducenti';

// Eta' dei conducenti e supplemento giovane conducente
// (impostazioni/etaConducenti): li legge anche il sito (vedi utils/etaConducenti.js).
const ETA_DOC = ['impostazioni', 'etaConducenti'];

// In tempo reale. `dati` sono quelli grezzi del documento (undefined se mai
// salvato): il form li usa per proporre l'esempio al primo uso.
export function ascoltaEtaConducenti(onDati, onErrore) {
  return onSnapshot(
    doc(db, ...ETA_DOC),
    (snapshot) => onDati({ dati: snapshot.data(), esiste: snapshot.exists() }),
    onErrore,
  );
}

export async function salvaEtaConducenti(form) {
  await setDoc(doc(db, ...ETA_DOC), {
    ...preparaEtaConducenti(form),
    aggiornatoIl: serverTimestamp(),
    aggiornatoDa: auth.currentUser?.email || '',
  });
}

// Per le altre pagine (Nuova prenotazione, consegna). null finche' non arrivano.
export function useEtaConducenti() {
  const [eta, setEta] = useState(null);
  useEffect(() => ascoltaEtaConducenti(({ dati }) => setEta(normalizzaEtaConducenti(dati)), (e) => {
    console.error('Errore lettura età dei conducenti:', e);
    setEta(normalizzaEtaConducenti(undefined));
  }), []);
  return eta;
}
