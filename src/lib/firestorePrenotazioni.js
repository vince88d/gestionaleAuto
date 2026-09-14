import { db } from '../components/firebase';
import { collection, getDocs, doc, writeBatch, setDoc } from 'firebase/firestore';

const PRENOTAZIONI_COLLECTION = 'prenotazioni';

export async function readPrenotazioni() {
  const snapshot = await getDocs(collection(db, PRENOTAZIONI_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function writePrenotazioni(nuovaLista) {
  const snapshot = await getDocs(collection(db, PRENOTAZIONI_COLLECTION));
  const idEsistenti = new Set(snapshot.docs.map((d) => d.id));
  const idNuovi = new Set(nuovaLista.map((p) => p.id));

  const batch = writeBatch(db);

  nuovaLista.forEach((prenotazione) => {
    const { id, ...dati } = prenotazione;
    batch.set(doc(db, PRENOTAZIONI_COLLECTION, id), dati);
  });

  idEsistenti.forEach((id) => {
    if (!idNuovi.has(id)) {
      batch.delete(doc(db, PRENOTAZIONI_COLLECTION, id));
    }
  });

  await batch.commit();
  return true;
}

// Aggiorna anche lo storico contratti del cliente corrispondente.
// I clienti non sono ancora migrati su Firestore: quella parte resta
// sui file JSON locali tramite window.electronAPI, finché non si fa
// anche quel passaggio.
export async function confermaPrenotazione({ prenotazione, ip }) {
  try {
    const bookingId = prenotazione.id || crypto.randomUUID();
    const bookingRecord = {
      ...prenotazione,
      id: bookingId,
      status: prenotazione.status || 'attiva',
      schedaVeicolo: prenotazione.schedaVeicolo || {},
      contrattoFirmato: prenotazione.contrattoFirmato || null,
      confermatoIl: new Date().toISOString(),
      ipConferma: ip || null,
    };

    const { id, ...dati } = bookingRecord;
    await setDoc(doc(db, PRENOTAZIONI_COLLECTION, id), dati, { merge: true });

    if (window.electronAPI?.readClienti && window.electronAPI?.writeClienti) {
      const clienti = await window.electronAPI.readClienti();
      const indexCliente = clienti.findIndex(
        (cliente) =>
          cliente.codiceFiscale?.toUpperCase() === bookingRecord.codiceFiscale?.toUpperCase()
      );

      if (indexCliente !== -1) {
        clienti[indexCliente].contratti = clienti[indexCliente].contratti || [];
        clienti[indexCliente].contratti.push({
          contratto: null,
          data: new Date().toISOString(),
          targa: bookingRecord.targa,
        });
        await window.electronAPI.writeClienti(clienti);
      }
    }

    return { success: true, booking: bookingRecord };
  } catch (error) {
    console.error('Errore conferma prenotazione:', error);
    return { success: false, message: error.message };
  }
}
