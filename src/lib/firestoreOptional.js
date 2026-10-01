import { db, auth } from '../components/firebase';
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { normalizzaOptional, preparaOptional } from '../utils/optional';

// Catalogo degli optional a pagamento: un documento per optional nella
// collezione `optional`, cosi' due postazioni che modificano optional diversi
// non si sovrascrivono a vicenda. Il sito legge solo quelli con `sulSito`
// (vedi regole Firestore in formiarent). Ogni prenotazione salva nome e prezzo
// pagati: cambiare il catalogo non tocca le prenotazioni gia' fatte.
const OPTIONAL = 'optional';
const chi = () => auth.currentUser?.email || '';

// Catalogo in tempo reale, senza quelli tolti dall'elenco.
export function ascoltaOptional(onDati, onErrore) {
  return onSnapshot(
    collection(db, OPTIONAL),
    (snapshot) => onDati(
      snapshot.docs
        .filter((d) => !d.data().archiviato)
        .map((d) => normalizzaOptional({ id: d.id, ...d.data() })),
    ),
    onErrore,
  );
}

// Nuovo optional (id generato) o modifica di uno esistente: in modifica si
// aggiornano solo i campi del form, il resto del documento resta com'e'.
export async function salvaOptional(dati) {
  const campi = preparaOptional(dati);
  if (dati.id) {
    await updateDoc(doc(db, OPTIONAL, dati.id), { ...campi, aggiornatoIl: serverTimestamp(), aggiornatoDa: chi() });
    return { id: dati.id, ...campi };
  }
  const nuovo = doc(collection(db, OPTIONAL));
  await setDoc(nuovo, { ...campi, archiviato: false, creatoIl: serverTimestamp(), creatoDa: chi() });
  return { id: nuovo.id, ...campi };
}

// "Togli dall'elenco": non si cancella (le prenotazioni passate lo citano),
// sparisce dal catalogo, dal sito e dai nuovi moduli.
export async function togliOptional(id) {
  await updateDoc(doc(db, OPTIONAL, id), { archiviato: true, sulSito: false, archiviatoIl: serverTimestamp(), archiviatoDa: chi() });
}
