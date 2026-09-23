import { db } from '../components/firebase';
import { collection, getDocs, doc, writeBatch, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { senzaUndefined } from '../utils/senzaUndefined';

const CLIENTI_COLLECTION = 'clienti';

// I clienti non hanno mai avuto un campo "id" nel gestionale: venivano
// distinti dal codice fiscale. Usiamo quello (normalizzato) come id del
// documento Firestore, così restano coerenti col controllo di duplicati
// già esistente nell'app.
const normalizzaCodiceFiscale = (value) => (value || '').trim().toUpperCase();

function idClienteDa(cliente) {
  return cliente.id || normalizzaCodiceFiscale(cliente.codiceFiscale) || crypto.randomUUID();
}

export async function readClienti() {
  const snapshot = await getDocs(collection(db, CLIENTI_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Salva UN cliente (il suo documento): da preferire a writeClienti, che
// riscrive tutti i clienti e cancella quelli che non vede.
export async function salvaCliente(cliente) {
  const id = idClienteDa(cliente);
  const { id: _ignora, ...dati } = cliente;
  await setDoc(doc(db, CLIENTI_COLLECTION, id), senzaUndefined(dati));
  return { ...cliente, id };
}

// Aggiunge una voce allo storico danni di un cliente senza toccare il resto.
export async function aggiungiDannoCliente(clienteId, voce) {
  await updateDoc(doc(db, CLIENTI_COLLECTION, clienteId), { storicoDanni: arrayUnion(voce) });
}

// Aggiunge un contratto all'elenco di un cliente senza toccare il resto.
export async function aggiungiContrattoCliente(clienteId, voce) {
  await updateDoc(doc(db, CLIENTI_COLLECTION, clienteId), { contratti: arrayUnion(voce) });
}

// Riscrive tutti i clienti: NON usare per i salvataggi normali (vedi salvaCliente).
export async function writeClienti(nuovaLista) {
  const snapshot = await getDocs(collection(db, CLIENTI_COLLECTION));
  const idEsistenti = new Set(snapshot.docs.map((d) => d.id));
  const idNuovi = new Set(nuovaLista.map(idClienteDa));

  const batch = writeBatch(db);

  nuovaLista.forEach((cliente) => {
    const id = idClienteDa(cliente);
    const { id: _ignora, ...dati } = cliente;
    batch.set(doc(db, CLIENTI_COLLECTION, id), dati);
  });

  idEsistenti.forEach((id) => {
    if (!idNuovi.has(id)) {
      batch.delete(doc(db, CLIENTI_COLLECTION, id));
    }
  });

  await batch.commit();
  return true;
}
