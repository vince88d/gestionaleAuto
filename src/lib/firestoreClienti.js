import { db } from '../components/firebase';
import {
  collection, getDocs, doc, writeBatch, updateDoc, deleteDoc, arrayUnion, onSnapshot, runTransaction,
} from 'firebase/firestore';
import { senzaUndefined } from '../utils/senzaUndefined';

const CLIENTI_COLLECTION = 'clienti';
const PRENOTAZIONI_COLLECTION = 'prenotazioni';

// I clienti non hanno mai avuto un campo "id" nel gestionale: venivano
// distinti dal codice fiscale. Usiamo quello (normalizzato) come id del
// documento Firestore, così restano coerenti col controllo di duplicati
// già esistente nell'app. L'id pero' non cambia piu' dopo la creazione:
// se si corregge il codice fiscale cambia solo il campo.
export const normalizzaCodiceFiscale = (value) => (value || '').trim().toUpperCase();

// Campi che gestisce il gestionale: storicoDanni e contratti si aggiungono
// solo con arrayUnion (consegna/riconsegna), non si riscrivono dal form.
const CAMPI_NON_DAL_FORM = ['id', 'storicoDanni', 'contratti'];

export class ClienteNonSalvato extends Error {
  constructor(messaggio) {
    super(messaggio);
    this.name = 'ClienteNonSalvato';
  }
}

export function messaggioErroreCliente(error, generico = 'Cliente non salvato, riprova.') {
  return error instanceof ClienteNonSalvato ? error.message : generico;
}

const soloCampiForm = (cliente) =>
  Object.fromEntries(Object.entries(cliente).filter(([chiave]) => !CAMPI_NON_DAL_FORM.includes(chiave)));

export async function readClienti() {
  const snapshot = await getDocs(collection(db, CLIENTI_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Clienti in tempo reale (come le prenotazioni): nuovi clienti o modifiche da
// un'altra postazione arrivano da soli. Restituisce la funzione per smettere.
export function ascoltaClienti(onDati, onErrore) {
  return onSnapshot(
    collection(db, CLIENTI_COLLECTION),
    (snapshot) => onDati(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onErrore,
  );
}

// Crea UN cliente nuovo. Si ferma se esiste gia' un cliente con quel codice
// fiscale (prima lo si sovrascriveva, perdendo contratti e danni).
export async function creaCliente(cliente) {
  const codiceFiscale = normalizzaCodiceFiscale(cliente.codiceFiscale);
  const id = codiceFiscale || crypto.randomUUID();
  const dati = senzaUndefined({
    ...soloCampiForm(cliente),
    codiceFiscale,
    storicoDanni: [],
    contratti: [],
    creatoIl: new Date().toISOString(),
  });
  const riferimento = doc(db, CLIENTI_COLLECTION, id);
  await runTransaction(db, async (transazione) => {
    const esistente = await transazione.get(riferimento);
    if (esistente.exists()) {
      throw new ClienteNonSalvato('Esiste già un cliente con questo codice fiscale.');
    }
    transazione.set(riferimento, dati);
  });
  return { id, ...dati };
}

// Compatibilita': chi salvava un cliente nuovo con salvaCliente.
export const salvaCliente = creaCliente;

// Aggiorna i campi del form di UN cliente (non tocca storico danni e
// contratti). Se il codice fiscale cambia, nella stessa operazione aggiorna
// anche le prenotazioni indicate (`prenotazioniDaAggiornare`, gli id), che
// sono legate al cliente dal codice fiscale: cosi' lo storico non si perde.
export async function aggiornaCliente(id, cliente, { prenotazioniDaAggiornare = [] } = {}) {
  const campi = senzaUndefined({
    ...soloCampiForm(cliente),
    codiceFiscale: normalizzaCodiceFiscale(cliente.codiceFiscale),
    modificatoIl: new Date().toISOString(),
  });
  const batch = writeBatch(db);
  batch.update(doc(db, CLIENTI_COLLECTION, id), campi);
  prenotazioniDaAggiornare.forEach((idPrenotazione) => {
    batch.update(doc(db, PRENOTAZIONI_COLLECTION, idPrenotazione), { codiceFiscale: campi.codiceFiscale });
  });
  await batch.commit();
  return campi;
}

// Aggiorna solo i campi indicati (es. patente completata alla consegna).
export async function aggiornaCampiCliente(id, campi) {
  await updateDoc(doc(db, CLIENTI_COLLECTION, id), senzaUndefined(campi));
}

export async function eliminaCliente(id) {
  await deleteDoc(doc(db, CLIENTI_COLLECTION, id));
}

// Aggiunge una voce allo storico danni di un cliente senza toccare il resto.
export async function aggiungiDannoCliente(clienteId, voce) {
  await updateDoc(doc(db, CLIENTI_COLLECTION, clienteId), { storicoDanni: arrayUnion(voce) });
}

// Toglie dallo storico danni le voci di una prenotazione (es. ripristinata
// dall'Archivio), rileggendo il documento per non perdere voci aggiunte nel
// frattempo.
export async function togliDanniPrenotazioneCliente(clienteId, riferimentoPrenotazione) {
  const riferimento = doc(db, CLIENTI_COLLECTION, clienteId);
  await runTransaction(db, async (transazione) => {
    const attuale = await transazione.get(riferimento);
    if (!attuale.exists()) return;
    const storico = attuale.data().storicoDanni || [];
    const rimasti = storico.filter((d) => d.riferimentoPrenotazione !== riferimentoPrenotazione);
    if (rimasti.length !== storico.length) transazione.update(riferimento, { storicoDanni: rimasti });
  });
}

// Aggiunge un contratto all'elenco di un cliente senza toccare il resto.
export async function aggiungiContrattoCliente(clienteId, voce) {
  await updateDoc(doc(db, CLIENTI_COLLECTION, clienteId), { contratti: arrayUnion(voce) });
}
