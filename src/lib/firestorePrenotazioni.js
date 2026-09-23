import { db } from '../components/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { readClienti, aggiungiContrattoCliente } from './firestoreClienti';
import { calcolaGiorniNoleggio } from '../utils/giorniNoleggio';
import { senzaUndefined } from '../utils/senzaUndefined';

const PRENOTAZIONI_COLLECTION = 'prenotazioni';

// Stati creati dal sito durante il checkout che non rappresentano una
// prenotazione reale: il cliente ha iniziato il pagamento ma non l'ha mai
// completato (hold ancora in corso, scaduto o pagamento fallito). Restano
// nel documento Firestore (servono alla Cloud Function per gestire l'hold),
// ma vanno esclusi da qualunque lista mostrata allo staff con
// isPrenotazioneVisibile — vedi Dashboard.jsx, Booking.jsx,
// ArchivioPrenotazioni.jsx, Vehicles.jsx.
//
// Non filtrare invece qui in readPrenotazioni(): lo stato Redux deve avere
// tutte le prenotazioni, ogni pagina filtra quello che mostra.
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

// --- Salvataggi di UNA prenotazione -------------------------------------
// Prima c'era writePrenotazioni, che riscriveva tutta la collezione con la
// copia locale e cancellava i documenti che non vedeva. Il sito pero' crea
// prenotazioni e ne cambia lo stato di continuo (pagamento confermato,
// annullamento dal link del cliente): con la copia vecchia si cancellavano
// prenotazioni pagate o si rimettevano "attive" quelle annullate e rimborsate.

// Errore di una prenotazione cambiata (o sparita) nel frattempo.
export class PrenotazioneCambiata extends Error {
  constructor(messaggio) {
    super(messaggio);
    this.name = 'PrenotazioneCambiata';
  }
}

// Aggiorna solo i campi passati. Con `statoAtteso` prima rilegge il documento
// e si ferma se lo stato non e' piu' quello che lo staff aveva a schermo (es.
// il cliente l'ha annullata dal sito mentre la pagina era aperta).
export async function aggiornaPrenotazione(id, campi, { statoAtteso } = {}) {
  const riferimento = doc(db, PRENOTAZIONI_COLLECTION, id);
  await runTransaction(db, async (transazione) => {
    const attuale = await transazione.get(riferimento);
    if (!attuale.exists()) {
      throw new PrenotazioneCambiata('La prenotazione non esiste più: forse è stata eliminata da un\'altra postazione.');
    }
    const stato = attuale.data().status;
    if (statoAtteso && stato !== statoAtteso) {
      throw new PrenotazioneCambiata(
        stato === 'annullata'
          ? 'La prenotazione è stata annullata nel frattempo (forse dal cliente dal sito): ricarica la pagina.'
          : 'La prenotazione è stata modificata nel frattempo: ricarica la pagina e riprova.'
      );
    }
    transazione.update(riferimento, senzaUndefined(campi));
  });
  return campi;
}

export async function eliminaPrenotazione(id) {
  await deleteDoc(doc(db, PRENOTAZIONI_COLLECTION, id));
}

// Messaggio da mostrare allo staff per un errore di salvataggio.
export function messaggioErrorePrenotazione(error, generico = 'Errore durante il salvataggio.') {
  return error instanceof PrenotazioneCambiata ? error.message : generico;
}


// Assegna il veicolo fisico a una prenotazione arrivata dal sito (che riserva
// solo la categoria) e, se disponibile, registra la patente controllata in
// sede. Aggiorna solo questi campi con updateDoc.
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
// Salva la prenotazione confermata dal riepilogo (nuova o modificata).
// - Modifica: in una transazione rilegge il documento e si ferma se nel
//   frattempo e' cambiato lo stato (es. il cliente l'ha annullata dal sito e
//   ha gia' avuto il rimborso): prima la si rimetteva "attiva" sovrascrivendola.
// - Il contratto si aggiunge solo al documento del cliente interessato (prima
//   si riscrivevano tutti i clienti).
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
    const riferimento = doc(db, PRENOTAZIONI_COLLECTION, id);
    if (prenotazione.id) {
      await runTransaction(db, async (transazione) => {
        const attuale = await transazione.get(riferimento);
        if (!attuale.exists()) {
          throw new PrenotazioneCambiata('La prenotazione non esiste più: forse è stata eliminata da un\'altra postazione.');
        }
        const stato = attuale.data().status;
        if (prenotazione.status && stato !== prenotazione.status) {
          throw new PrenotazioneCambiata(
            stato === 'annullata'
              ? 'La prenotazione è stata annullata nel frattempo (forse dal cliente dal sito): le modifiche non sono state salvate.'
              : 'La prenotazione è stata modificata nel frattempo: ricarica la pagina e riprova.'
          );
        }
        transazione.set(riferimento, senzaUndefined(dati), { merge: true });
      });
    } else {
      await setDoc(riferimento, senzaUndefined(dati), { merge: true });
    }

    try {
      const clienti = await readClienti();
      const cliente = clienti.find(
        (c) => c.codiceFiscale?.toUpperCase() === bookingRecord.codiceFiscale?.toUpperCase()
      );
      if (cliente?.id) {
        await aggiungiContrattoCliente(cliente.id, {
          contratto: null,
          data: new Date().toISOString(),
          targa: bookingRecord.targa || '',
        });
      }
    } catch (error) {
      // La prenotazione e' salvata: il contratto sul cliente e' secondario.
      console.error('Contratto non registrato sul cliente:', error);
    }

    return { success: true, booking: bookingRecord };
  } catch (error) {
    console.error('Errore conferma prenotazione:', error);
    return { success: false, message: messaggioErrorePrenotazione(error, error.message) };
  }
}

// Segna come riparato il danno rilevato alla riconsegna di una prenotazione.
// Aggiorna solo quei due campi del documento (prima il cambio restava solo
// nella schermata e si perdeva riaprendo il gestionale).
export async function segnaDannoPrenotazioneRiparato(prenotazioneId, riparatoIn = new Date().toISOString()) {
  await updateDoc(doc(db, PRENOTAZIONI_COLLECTION, prenotazioneId), { daRiparare: false, riparatoIn });
  return { daRiparare: false, riparatoIn };
}
