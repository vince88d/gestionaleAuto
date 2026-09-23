import { db } from '../components/firebase';
import { collection, getDocs, doc, writeBatch, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { readTariffe } from './firestoreTariffe';
import { applicaTariffe, perSalvataggio } from '../utils/tariffe';
import { spostaFotoDanniSuStorage } from './storageFoto';

const VEICOLI_COLLECTION = 'veicoli';

// Ogni veicolo esce con il prezzo della sua categoria (tariffe), così schede,
// dettaglio e prenotazione usano tutti lo stesso prezzo. Il prezzo scritto sul
// veicolo resta in `prezzoVeicolo` e viene rimesso a posto da salvaVeicolo.
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

// Salva UN veicolo (il suo documento e basta). Prima c'era writeVeicoli, che
// riscriveva tutta la flotta con la copia locale e cancellava i veicoli che non
// vedeva: con due postazioni aperte chi salvava per ultimo cancellava i
// veicoli aggiunti dall'altra nel frattempo.
// Prima di scrivere sposta su Storage le foto dei danni ancora incorporate nel
// documento (limite Firestore di 1 MB per documento). Restituisce il veicolo
// salvato, con gli indirizzi delle foto al posto dei dati incorporati.
//
// `targaPrecedente`: se la targa e' cambiata, le prenotazioni con la vecchia
// targa passano alla nuova nella stessa scrittura del veicolo (le prenotazioni
// sono legate al veicolo solo dalla targa: altrimenti si staccherebbero).
export async function salvaVeicolo(veicolo, { targaPrecedente } = {}) {
  // Solo i campi che ci sono: un campo undefined fa rifiutare a Firestore
  // l'intero salvataggio.
  const conFoto = { ...veicolo };
  for (const campo of ['danni', 'storicoRiparazioni']) {
    if (Array.isArray(veicolo[campo])) conFoto[campo] = await spostaFotoDanniSuStorage(veicolo[campo]);
  }
  const { id, ...dati } = perSalvataggio(conFoto);

  if (targaPrecedente && targaPrecedente !== dati.targa) {
    const prenotazioni = await getDocs(
      query(collection(db, 'prenotazioni'), where('targa', '==', targaPrecedente))
    );
    const batch = writeBatch(db);
    batch.set(doc(db, VEICOLI_COLLECTION, id), dati);
    prenotazioni.forEach((d) => batch.update(d.ref, { targa: dati.targa }));
    await batch.commit();
    return conFoto;
  }

  await setDoc(doc(db, VEICOLI_COLLECTION, id), dati);
  return conFoto;
}

export async function eliminaVeicolo(id) {
  await deleteDoc(doc(db, VEICOLI_COLLECTION, id));
}
