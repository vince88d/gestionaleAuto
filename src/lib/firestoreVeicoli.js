import { db } from '../components/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { readTariffe } from './firestoreTariffe';
import { applicaTariffe, perSalvataggio } from '../utils/tariffe';

const VEICOLI_COLLECTION = 'veicoli';

// Ogni veicolo esce con il prezzo della sua categoria (tariffe), così schede,
// dettaglio e prenotazione usano tutti lo stesso prezzo. Il prezzo scritto sul
// veicolo resta in `prezzoVeicolo` e viene rimesso a posto da writeVeicoli.
// Se le tariffe non si leggono si usano i prezzi dei veicoli, come prima.
export async function readVeicoli() {
  const snapshot = await getDocs(collection(db, VEICOLI_COLLECTION));
  const veicoli = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  try {
    return applicaTariffe(veicoli, await readTariffe());
  } catch (error) {
    console.error('Tariffe non lette, uso i prezzi dei veicoli:', error);
    return veicoli;
  }
}

export async function writeVeicoli(nuovaLista) {
  const snapshot = await getDocs(collection(db, VEICOLI_COLLECTION));
  const idEsistenti = new Set(snapshot.docs.map((d) => d.id));
  const idNuovi = new Set(nuovaLista.map((v) => v.id));

  const batch = writeBatch(db);

  nuovaLista.forEach((veicolo) => {
    // La tariffa di categoria non deve finire dentro il documento del veicolo.
    const { id, ...dati } = perSalvataggio(veicolo);
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
