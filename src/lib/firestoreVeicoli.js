import { db } from '../components/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

const VEICOLI_COLLECTION = 'veicoli';

export async function readVeicoli() {
  const snapshot = await getDocs(collection(db, VEICOLI_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function writeVeicoli(nuovaLista) {
  const snapshot = await getDocs(collection(db, VEICOLI_COLLECTION));
  const idEsistenti = new Set(snapshot.docs.map((d) => d.id));
  const idNuovi = new Set(nuovaLista.map((v) => v.id));

  const batch = writeBatch(db);

  nuovaLista.forEach((veicolo) => {
    const { id, ...dati } = veicolo;
    batch.set(doc(db, VEICOLI_COLLECTION, id), dati);
  });

  idEsistenti.forEach((id) => {
    if (!idNuovi.has(id)) {
      batch.delete(doc(db, VEICOLI_COLLECTION, id));
    }
  });

  await batch.commit();
  return true;
}
