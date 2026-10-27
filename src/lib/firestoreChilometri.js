import { useEffect, useState } from 'react';
import { db, auth } from '../components/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { normalizzaFormule } from '../utils/chilometri';

// Formule dei chilometri (impostazioni/chilometri, vedi utils/chilometri.js).
// Le contiene i supplementi (prezzi): le legge solo lo staff; il sito le riceve
// dalla Cloud Function leggiFormuleSito (senza prezzi in «Solo richieste»).
const CHILOMETRI_DOC = ['impostazioni', 'chilometri'];

export function ascoltaChilometri(onDati, onErrore) {
  return onSnapshot(doc(db, ...CHILOMETRI_DOC), (s) => onDati(normalizzaFormule(s.data())), onErrore);
}

// `dati` = { formule: [...] } (da schemaAFormule).
export async function salvaChilometri(dati) {
  await setDoc(doc(db, ...CHILOMETRI_DOC), {
    ...normalizzaFormule(dati),
    aggiornatoIl: serverTimestamp(),
    aggiornatoDa: auth.currentUser?.email || '',
  });
}

// Formule per la nuova prenotazione: finche' non arrivano vale «Km illimitati».
export function useFormuleKm() {
  const [formule, setFormule] = useState(() => normalizzaFormule(undefined).formule);
  useEffect(() => ascoltaChilometri((d) => setFormule(d.formule), (e) => console.error('Errore lettura formule km:', e)), []);
  return formule;
}
