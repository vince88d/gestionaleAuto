import { db, auth } from '../components/firebase';
import {
  collection, getDocs, doc, writeBatch, setDoc, updateDoc, deleteDoc, deleteField,
  serverTimestamp, query, where, onSnapshot,
} from 'firebase/firestore';
import { readTariffe } from './firestoreTariffe';
import { applicaTariffe, perSalvataggio } from '../utils/tariffe';
import { spostaFotoDanniSuStorage } from './storageFoto';

const VEICOLI_COLLECTION = 'veicoli';

// Un veicolo "eliminato" (soft delete, vedi eliminaVeicolo) resta nel
// database ma va nascosto da ogni lista/ricerca normale: si vede solo nel
// Cestino.
const nonEliminato = (v) => !v.eliminato;

// Ogni veicolo esce con il prezzo della sua categoria (tariffe), così schede,
// dettaglio e prenotazione usano tutti lo stesso prezzo. Il prezzo scritto sul
// veicolo resta in `prezzoVeicolo` e viene rimesso a posto da salvaVeicolo.
// Se le tariffe non si leggono si usano i prezzi dei veicoli, come prima.
export async function readVeicoli() {
  const snapshot = await getDocs(collection(db, VEICOLI_COLLECTION));
  const veicoli = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter(nonEliminato);
  try {
    return applicaTariffe(veicoli, await readTariffe());
  } catch (error) {
    console.error('Tariffe non lette, uso i prezzi dei veicoli:', error);
    return veicoli;
  }
}

// Elenco veicoli in tempo reale, senza applicare le tariffe: per la pagina
// Tariffe, che ha bisogno solo di sapere quante auto ha ogni categoria e non
// deve dipendere anche dalle tariffe (che è lei stessa a modificare).
export function ascoltaVeicoli(onDati, onErrore) {
  return onSnapshot(
    collection(db, VEICOLI_COLLECTION),
    (snapshot) => onDati(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter(nonEliminato)),
    onErrore,
  );
}

// Solo i veicoli nel Cestino (eliminato: true), per la pagina Eliminati.
export function ascoltaVeicoliEliminati(onDati, onErrore) {
  return onSnapshot(
    query(collection(db, VEICOLI_COLLECTION), where('eliminato', '==', true)),
    (snapshot) => onDati(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onErrore,
  );
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

// Non cancella il veicolo: lo nasconde (va nel Cestino). Recuperabile con
// ripristinaVeicolo entro 6 mesi, poi la pulizia automatica lo cancella per
// davvero (vedi Cloud Function pulisciEliminatiScaduti).
export async function eliminaVeicolo(id) {
  await updateDoc(doc(db, VEICOLI_COLLECTION, id), {
    eliminato: true,
    eliminatoDa: auth.currentUser?.email || '',
    eliminatoIl: serverTimestamp(),
  });
}

// Toglie il veicolo dal Cestino: torna visibile come prima.
export async function ripristinaVeicolo(id) {
  await updateDoc(doc(db, VEICOLI_COLLECTION, id), {
    eliminato: deleteField(),
    eliminatoDa: deleteField(),
    eliminatoIl: deleteField(),
  });
}

// Cancellazione vera, senza ritorno: solo dal Cestino, scelta esplicita dello
// staff (o dalla pulizia automatica dopo 6 mesi).
export async function eliminaVeicoloDefinitivo(id) {
  await deleteDoc(doc(db, VEICOLI_COLLECTION, id));
}

// Sospende il veicolo dal noleggio (incidente, riparazione, fermo deciso dal
// gestore): resta in flotta ma esce dal conteggio delle auto noleggiabili, su
// sito e gestionale. Scrive solo questi campi, senza toccare il resto del
// documento. Si riattiva a mano con riattivaVeicolo.
export async function sospendiVeicolo(id, motivo = '') {
  // Data come testo (non serverTimestamp): la stessa copia resta nello stato
  // dell'app e non cambia tipo se il veicolo viene poi risalvato per intero.
  const campi = {
    sospeso: true,
    sospesoDa: auth.currentUser?.email || '',
    sospesoIl: new Date().toISOString(),
  };
  const testo = String(motivo || '').trim();
  if (testo) campi.sospesoMotivo = testo;
  await updateDoc(doc(db, VEICOLI_COLLECTION, id), campi);
  return campi;
}

export async function riattivaVeicolo(id) {
  await updateDoc(doc(db, VEICOLI_COLLECTION, id), {
    sospeso: deleteField(),
    sospesoMotivo: deleteField(),
    sospesoDa: deleteField(),
    sospesoIl: deleteField(),
  });
}
