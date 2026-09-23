import { db } from '../components/firebase';
import { collection, getDocs, doc, writeBatch, setDoc, updateDoc } from 'firebase/firestore';
import { readClienti, writeClienti } from './firestoreClienti';
import { calcolaGiorniNoleggio } from '../utils/giorniNoleggio';

const PRENOTAZIONI_COLLECTION = 'prenotazioni';

// Stati creati dal sito durante il checkout che non rappresentano una
// prenotazione reale: il cliente ha iniziato il pagamento ma non l'ha mai
// completato (hold ancora in corso, scaduto o pagamento fallito). Restano
// nel documento Firestore (servono alla Cloud Function per gestire l'hold),
// ma vanno esclusi da qualunque lista mostrata allo staff con
// isPrenotazioneVisibile — vedi Dashboard.jsx, Booking.jsx,
// ArchivioPrenotazioni.jsx, Vehicles.jsx.
//
// Non filtrare invece qui in readPrenotazioni(): il suo risultato alimenta
// anche writePrenotazioni() (via lo stato Redux), che sincronizza Firestore
// cancellando ogni documento non presente nella lista passata. Se
// readPrenotazioni() omettesse questi stati, il primo salvataggio fatto dal
// gestionale cancellerebbe da Firestore gli hold del sito ancora in corso.
export const STATI_PRENOTAZIONE_NON_CONFERMATE = ['richiesta-sito', 'scaduta', 'pagamento-fallito'];

// Le prenotazioni annullate (con l'eventuale rimborso già fatto) restano in
// Firestore come storico, ma non compaiono nelle liste di lavoro dello staff.
export function isPrenotazioneVisibile(prenotazione) {
  return (
    prenotazione?.status !== 'annullata' &&
    !STATI_PRENOTAZIONE_NON_CONFERMATE.includes(prenotazione?.status)
  );
}

export { isPagataOnline } from '../utils/pagamentoOnline';

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

// Assegna il veicolo fisico a una prenotazione arrivata dal sito (che riserva
// solo la categoria) e, se disponibile, registra la patente controllata in
// sede. Aggiorna solo questi campi con updateDoc: non passa da
// writePrenotazioni(), che riscrive l'intera collezione.
// Il sito salva il totale pagato in `totale`, mentre il gestionale legge
// `prezzoTotale`/`prezzoGiornaliero`: li allineiamo qui se mancano, senza
// ricalcolare l'importo che il cliente ha già pagato.
export async function assegnaVeicolo({ prenotazione, veicolo, patente }) {
  const aggiornamenti = {
    targa: veicolo.targa,
    veicolo: veicolo.modello,
    veicoloAssegnatoIl: new Date().toISOString(),
  };

  const patentePulita = (patente || '').trim().toUpperCase();
  if (patentePulita) aggiornamenti.patente = patentePulita;

  if (prenotazione.totale != null && !prenotazione.prezzoTotale) {
    const giorni = calcolaGiorniNoleggio(prenotazione.dataInizio, prenotazione.dataFine) || 1;
    aggiornamenti.prezzoTotale = prenotazione.totale;
    aggiornamenti.prezzoGiornaliero = Math.round((prenotazione.totale / giorni) * 100) / 100;
  }

  await updateDoc(doc(db, PRENOTAZIONI_COLLECTION, prenotazione.id), aggiornamenti);
  return { ...prenotazione, ...aggiornamenti };
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

    {
      const clienti = await readClienti();
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
        await writeClienti(clienti);
      }
    }

    return { success: true, booking: bookingRecord };
  } catch (error) {
    console.error('Errore conferma prenotazione:', error);
    return { success: false, message: error.message };
  }
}

// Segna come riparato il danno rilevato alla riconsegna di una prenotazione.
// Aggiorna solo quei due campi del documento (prima il cambio restava solo
// nella schermata e si perdeva riaprendo il gestionale).
export async function segnaDannoPrenotazioneRiparato(prenotazioneId, riparatoIn = new Date().toISOString()) {
  await updateDoc(doc(db, PRENOTAZIONI_COLLECTION, prenotazioneId), { daRiparare: false, riparatoIn });
  return { daRiparare: false, riparatoIn };
}
