import { useEffect, useState } from 'react';
import { db, auth } from '../components/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { normalizzaFormule, modoEffettivo } from '../utils/chilometri';
import { ascoltaModalitaSito } from './firestoreSito';

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

// Impostazioni dei km per la nuova prenotazione: { modo, modoSalvato, dichiaratiIllimitati, formule }.
// `modo` e' quello che vale davvero (i km scritti dal cliente solo con il sito in
// «Solo richieste»). Finche' non arrivano vale «Km illimitati».
export function useFormuleKm() {
  const [dati, setDati] = useState(() => normalizzaFormule(undefined));
  const [modalita, setModalita] = useState('pagamento');
  useEffect(() => ascoltaChilometri(setDati, (e) => console.error('Errore lettura formule km:', e)), []);
  useEffect(() => ascoltaModalitaSito(setModalita, (e) => console.error('Errore lettura modalita sito:', e)), []);
  return { ...dati, modoSalvato: dati.modo, modo: modoEffettivo(dati.modo, modalita) };
}
