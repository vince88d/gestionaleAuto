import { db } from '../components/firebase';
import { collection, getDocs, doc, writeBatch, setDoc, deleteDoc } from 'firebase/firestore';
import { readTariffe } from './firestoreTariffe';
import { applicaTariffe, perSalvataggio } from '../utils/tariffe';
import { spostaFotoDanniSuStorage } from './storageFoto';

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

// Salva UN veicolo (il suo documento e basta). Da preferire a writeVeicoli:
// quella riscrive tutta la flotta con la copia locale e cancella i veicoli che
// non vede, quindi con due postazioni aperte chi salva per ultimo cancella i
// veicoli aggiunti dall'altra nel frattempo.
// Prima di scrivere sposta su Storage le foto dei danni ancora incorporate nel
// documento (limite Firestore di 1 MB per documento). Restituisce il veicolo
// salvato, con gli indirizzi delle foto al posto dei dati incorporati.
export async function salvaVeicolo(veicolo) {
  // Solo i campi che ci sono: un campo undefined fa rifiutare a Firestore
  // l'intero salvataggio.
  const conFoto = { ...veicolo };
  for (const campo of ['danni', 'storicoRiparazioni']) {
    if (Array.isArray(veicolo[campo])) conFoto[campo] = await spostaFotoDanniSuStorage(veicolo[campo]);
  }
  const { id, ...dati } = perSalvataggio(conFoto);
  await setDoc(doc(db, VEICOLI_COLLECTION, id), dati);
  return conFoto;
}

export async function eliminaVeicolo(id) {
  await deleteDoc(doc(db, VEICOLI_COLLECTION, id));
}

// Riscrive tutta la flotta: usata ancora da InfoModal e Booking (che rileggono
// la flotta subito prima). Per i salvataggi dalla pagina Veicoli usare
// salvaVeicolo / eliminaVeicolo.
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
