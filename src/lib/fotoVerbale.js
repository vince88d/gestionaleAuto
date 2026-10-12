import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import {
  collection, query, where, onSnapshot, getDocs, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, functions, storage } from '../components/firebase';
import { normalizzaFoto, ordinaFoto } from '../utils/fotoVerbale';

// Foto della consegna e del rientro caricate dal telefono (QR). Le Cloud
// Functions stanno nel sito (formiarent, functions/src/fotoVerbale.ts):
// `creaSessioneFoto` e `chiudiSessioneFoto` sono riservate allo staff e usano
// l'utente loggato. Le foto stanno in `fotoVerbali/{id}`.
const creaCallable = httpsCallable(functions, 'creaSessioneFoto');
const chiudiCallable = httpsCallable(functions, 'chiudiSessioneFoto');

// Apre il link a tempo per caricare le foto di una consegna o di un rientro.
// Restituisce { token, url, scadeIlMs }: `url` va nel QR.
export async function creaSessioneFoto(prenotazioneId, fase) {
  const { data } = await creaCallable({ prenotazioneId, fase });
  return { token: data.token, url: data.url, scadeIlMs: data.scadeIlMs };
}

export async function chiudiSessioneFoto(token) {
  await chiudiCallable({ token });
}

// Messaggio leggibile per lo staff.
export function messaggioErroreFoto(errore) {
  if (errore?.code === 'functions/permission-denied' || errore?.code === 'functions/unauthenticated') {
    return 'Non hai i permessi: accedi di nuovo come staff.';
  }
  if (errore?.code === 'functions/not-found' || errore?.code === 'functions/unavailable') {
    return 'Il servizio delle foto non risponde. Controlla la connessione e riprova.';
  }
  return errore?.message?.replace(/\s*\[\d{3}\]$/, '') || 'Non riesco ad aprire il collegamento, riprova.';
}

const domanda = (prenotazioneId, fase) => query(
  collection(db, 'fotoVerbali'), where('prenotazioneId', '==', prenotazioneId), where('fase', '==', fase),
);
const daSnapshot = (snapshot) => ordinaFoto(snapshot.docs.map((d) => normalizzaFoto(d.id, d.data())));

// Foto di una prenotazione e fase, in tempo reale (arrivano da sole dal telefono).
export function ascoltaFoto(prenotazioneId, fase, onDati, onErrore) {
  return onSnapshot(domanda(prenotazioneId, fase), (s) => onDati(daSnapshot(s)), onErrore);
}

// Le stesse foto una volta sola (per il PDF). Vuoto se non si leggono.
export async function leggiFotoVerbale(prenotazioneId, fase) {
  if (!prenotazioneId) return [];
  try {
    return daSnapshot(await getDocs(domanda(prenotazioneId, fase)));
  } catch (errore) {
    console.error('Foto del verbale non lette:', errore);
    return [];
  }
}

export function useFotoVerbale(prenotazioneId, fase) {
  const [stato, setStato] = useState({ foto: [], caricato: false, errore: null });
  useEffect(() => {
    if (!prenotazioneId) return undefined;
    setStato({ foto: [], caricato: false, errore: null });
    return ascoltaFoto(
      prenotazioneId, fase,
      (foto) => setStato({ foto, caricato: true, errore: null }),
      (errore) => setStato({ foto: [], caricato: true, errore }),
    );
  }, [prenotazioneId, fase]);
  return stato;
}

export const aggiornaEtichettaFoto = (id, etichetta) => updateDoc(doc(db, 'fotoVerbali', id), { etichetta });

// Toglie la foto: prima il documento, poi il file (se il file non c'e' piu' non e' un problema).
export async function eliminaFoto(foto) {
  await deleteDoc(doc(db, 'fotoVerbali', foto.id));
  if (foto.path) await deleteObject(ref(storage, foto.path)).catch(() => undefined);
}
