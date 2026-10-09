import { db, auth } from '../components/firebase';
import {
  doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, deleteField, FieldPath,
} from 'firebase/firestore';
import { normalizzaProtezioni } from '../utils/protezioni';

// Protezioni e cauzione per categoria, lette anche dal sito per mostrarle al
// cliente prima di pagare. Documento: impostazioni/protezioni →
// { perCategoria: { "City Car": { base, totale } }, nonCopre, cauzioneTesto }.
// Si scrive sempre con merge e una categoria alla volta, cosi' due postazioni
// che modificano categorie diverse non si sovrascrivono a vicenda. Ogni
// prenotazione salvera' i valori di quando e' stata fatta.
const PROTEZIONI_DOC = ['impostazioni', 'protezioni'];
const firma = () => ({ aggiornatoIl: serverTimestamp(), aggiornatoDa: auth.currentUser?.email || '' });

export function ascoltaProtezioni(onDati, onErrore) {
  return onSnapshot(
    doc(db, ...PROTEZIONI_DOC),
    (snapshot) => onDati(normalizzaProtezioni(snapshot.data())),
    onErrore,
  );
}

// Salva la stessa protezione su una o piu' categorie (anche "Copia su altre
// categorie"). `protezione` e' gia' normalizzata: ogni campo e' presente,
// quindi il merge sostituisce per intero quelle categorie.
export async function salvaProtezioni(categorie, protezione) {
  const perCategoria = Object.fromEntries(categorie.map((c) => [c, protezione]));
  await setDoc(doc(db, ...PROTEZIONI_DOC), { perCategoria, ...firma() }, { merge: true });
}

// Testi uguali per tutte le categorie (sito e contratto).
export async function salvaTestiProtezioni({ nonCopre, cauzioneTesto }) {
  await setDoc(doc(db, ...PROTEZIONI_DOC), { nonCopre, cauzioneTesto, ...firma() }, { merge: true });
}

// Toglie le protezioni di una categoria appena eliminata dall'elenco.
// FieldPath perche' il nome della categoria puo' contenere spazi o punti.
export async function rimuoviProtezioniCategoria(categoria) {
  const ref = doc(db, ...PROTEZIONI_DOC);
  const snapshot = await getDoc(ref);
  const perCategoria = snapshot.data()?.perCategoria;
  if (!perCategoria || !Object.prototype.hasOwnProperty.call(perCategoria, categoria)) return false;
  const f = firma();
  await updateDoc(ref, new FieldPath('perCategoria', categoria), deleteField(), 'aggiornatoIl', f.aggiornatoIl, 'aggiornatoDa', f.aggiornatoDa);
  return true;
}
