import React, { useState, useEffect,useRef } from 'react';
import './Booking.css';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import itLocale from '@fullcalendar/core/locales/it';
import BookingForm from '../components/BookingForm';
import SchedaVeicoloModal from '../components/SchedaModalOpen';
import RiepilogoPrenotazioneModal from '../components/RiepilogoPrenotazioneModal';
import InfoModal from '../components/InfoModal';
import {toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ConfirmDialog from '../components/ConfirmDialog';
import { setClienti } from '../store/clientiSlice';
import {
  Search, Info, CheckCircle, AlertCircle, Edit3, Trash2, KeyRound, Plus, List, CalendarDays, Download,
} from 'lucide-react';
import BookingModal from '../components/BookingModal';
import "../components/BookingForm.css";
import { useDispatch,useSelector } from 'react-redux';
import ConcludiPrenotazioneModal from '../components/ConcludiPrenotazioneModal';
import PrenotazioniDaAssegnare from '../components/PrenotazioniDaAssegnare';
import AnnullaConPenaleModal from '../components/AnnullaConPenaleModal';
import { calcolaGiorniNoleggio } from '../utils/giorniNoleggio';
import { useLocation } from 'react-router-dom';
import {
  readPrenotazioni, isPrenotazioneVisibile, isPagataOnline,
  aggiornaPrenotazione, eliminaPrenotazione, messaggioErrorePrenotazione, salvaPrenotazione,
} from '../lib/firestorePrenotazioni';
import { annullaConRimborso, messaggioErroreRimborso } from '../lib/annullamento';
import { readVeicoli } from '../lib/firestoreVeicoli';
import { readHolds } from '../lib/firestoreHolds';
import { readClienti, aggiungiDannoCliente } from '../lib/firestoreClienti';
import { fotoIncorporataSuStorage } from '../lib/storageFoto';
import {
  controllaPrenotazione, puoConcludere, puoConsegnare, daConcludereInBlocco, faseLavoro, promemoria,
} from '../utils/regolePrenotazione';
import { prezzoPrenotazione } from '../utils/dashboard';
import { daAssegnare } from '../utils/assegnazioneVeicolo';
import { giornoLocale, formattaData } from '../utils/scadenze';
import{
  setPrenotazioni,
  addPrenotazione,
  updatePrenotazione,
  deletePrenotazione,
} from '../store/prenotazioniSlice';







// Filtri della tabella: a che punto e' il lavoro su ogni prenotazione.
const FILTRI_FASE = [
  { chiave: 'tutte', etichetta: 'Tutte' },
  { chiave: 'da-consegnare', etichetta: 'Da consegnare' },
  { chiave: 'in-corso', etichetta: 'In corso' },
  { chiave: 'da-concludere', etichetta: 'Finiti da concludere' },
];

const ETICHETTA_FASE = {
  'da-consegnare': 'Da consegnare',
  'in-corso': 'In corso',
  'da-concludere': 'Da concludere',
};

// '2026-09-23' -> '2026-09-24'
const giornoDopo = (giorno) => {
  const d = new Date(`${giorno}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return giornoLocale(d);
};

const VISTA_SALVATA = 'prenotazioni-vista';
const leggiVista = () => {
  try {
    return localStorage.getItem(VISTA_SALVATA) === 'calendario' ? 'calendario' : 'elenco';
  } catch {
    return 'elenco';
  }
};

const schedaVuota = () => ({
  carburante: '',
  kmIniziali: '',
  danni: '',
  accessori: {
    cric: false, triangolo: false, giubbotto: false, ruotaScorta: false,
    cavoRicarica: false, cateneNeve: false, altro: '',
  },
});

function Bookings() {
  const prenotazioni = useSelector((state) => state.prenotazioni);
  // Solo per la visualizzazione (calendario, tabella, contatori): esclude anche
  // i tentativi di checkout dal sito non andati a buon fine. Non usare questa
  // lista per scrivere su Firestore, va usato sempre `prenotazioni` (vedi nota
  // in firestorePrenotazioni.js).
  const prenotazioniAttive = prenotazioni.filter(p => p.status !== 'completata' && isPrenotazioneVisibile(p));
  const dispatch = useDispatch();
  const [editingIndex, setEditingIndex] = useState(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [dettagliPrenotazione, setDettagliPrenotazione] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [prenotazioniGiorno, setPrenotazioniGiorno] = useState([]);
  const [isAddingNewBooking, setIsAddingNewBooking] = useState(false);
  const [search, setSearch] = useState('');
  const [riepilogoOpen, setRiepilogoOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [feedbackType, setFeedbackType] = useState('success');
  const [loading, setLoading] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [holds, setHolds] = useState([]);
  const [availableVehiclesForBooking, setAvailableVehiclesForBooking] = useState([]);
  const [forceRenderKey, setForceRenderKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState(null);
  // Prenotazione pagata online da annullare con rimborso su Stripe.
  const [daRimborsare, setDaRimborsare] = useState(null);
  const [rimborsoInCorso, setRimborsoInCorso] = useState(false);
  const clienti = useSelector((state) => state.clienti);
  const [concludiModalOpen, setConcludiModalOpen] = useState(false);
  const [prenotazioneDaConcludere, setPrenotazioneDaConcludere] = useState(null);
  const [confermaInBlocco, setConfermaInBlocco] = useState(null);
  const [paginaPrenotazioni, setPaginaPrenotazioni] = useState(1);
  const [paginaClienti, setPaginaClienti] = useState(1);
  const [filtroFase, setFiltroFase] = useState('tutte');
  // Elenco o calendario: si ricorda l'ultima scelta su questo computer.
  const [vista, setVista] = useState(leggiVista);
  const cambiaVista = (nuova) => {
    setVista(nuova);
    try { localStorage.setItem(VISTA_SALVATA, nuova); } catch { /* niente */ }
  };
  const [salvandoPrenotazione, setSalvandoPrenotazione] = useState(false);
  // Prenotazione che si sta consegnando (scheda veicolo -> riepilogo).
  const [consegnaDi, setConsegnaDi] = useState(null);
  const [patenteConsegna, setPatenteConsegna] = useState('');
  const location = useLocation();
  const righePerPagina = 10;
  const listaRef = useRef(null);
  const searchInputRef = useRef(null);

  const [formData, setFormData] = useState({
    cliente: '',
    codiceFiscale: '',
    patente: '',
    veicolo: '',
    targa: '',
    dataInizio: '',
    dataFine: '',
    prezzoGiornaliero: '', 
    prezzoTotale: '',
    emailCliente:'',
  });

   

  const [schedaModalOpen, setSchedaModalOpen] = useState(false);
  const [schedaVeicolo, setSchedaVeicolo] = useState({
    carburante: '',
    kmIniziali: '',
    danni: '',
accessori: {
  cric: false,
  triangolo: false,
  giubbotto: false,
  ruotaScorta: false,
  cavoRicarica: false,
  cateneNeve: false,
  altro: ''
}
  }); 
  
  
  const showFeedback = (message, type = 'success') => {
    if (type === 'success') {
      toast.success(message);
    } else {
      toast.error(message);
    }
  };
  
  useEffect(() => {
  setPaginaPrenotazioni(1);
}, [search, filtroFase]);


  useEffect(() => {
    let cleanup;
    if (window.electronAPI?.onEmailStatus) {
      cleanup = window.electronAPI.onEmailStatus(({ success, message }) => {
        showFeedback(message, success ? 'success' : 'error');
      });
    }
  
    return () => {
      if (cleanup) cleanup(); // ✅ Rimuove correttamente il listener
    };
  }, []);

useEffect(() => {
  if (location.state?.targaSelezionata) {
    const {
      targaSelezionata,
      modelloSelezionato,
      prezzoSelezionato,
      dataSelezionata,
    } = location.state;

    setFormData((prev) => ({
      ...prev,
      targa: targaSelezionata,
      veicolo: modelloSelezionato || '',
      prezzoGiornaliero: prezzoSelezionato || '',
      dataInizio: dataSelezionata || '',
      dataFine: dataSelezionata || '',
    }));

    setSelectedDate(dataSelezionata || null);
    setIsAddingNewBooking(true);
    setModalIsOpen(true);
  }
}, [location.state]);
  
  useEffect(() => {
    const caricaClienti = async () => {
      try {
        const dati = await readClienti();
        dispatch(setClienti(dati || []));
      } catch (err) {
        console.error("Errore caricamento clienti:", err);
      }
    };
    caricaClienti();
  }, [dispatch]);
  

  useEffect(() => {
    const caricaPrenotazioni = async () => {
      setLoading(true);
      try {
        const dati = await readPrenotazioni();
        console.log("dati caricati:", dati); // Debug
        dispatch(setPrenotazioni(dati));
      } catch (error) {
        console.error("Errore lettura locale:", error);
      } finally {
        setLoading(false);
      }
    };
  
    caricaPrenotazioni();
  }, [dispatch]);
  
  useEffect(() => {
    const caricaVeicoli = async () => {
      try {
        // Usa lo stesso nome usato nell'API (qui usiamo readVeicoli per coerenza)
        const datiVeicoli = await readVeicoli();
        
        if (!Array.isArray(datiVeicoli)) {
          console.error("Dati veicoli non sono un array:", datiVeicoli);
          showFeedback("Formato dati veicoli non valido", "error");
          return;
        }
        
        setAvailableVehicles(datiVeicoli);
        console.log("Veicoli caricati:", datiVeicoli); // Debug
      } catch (error) {
        console.error("Errore lettura veicoli:", error);
        showFeedback("Errore nel caricamento dei veicoli", "error");
      }
    };

    caricaVeicoli();
  }, []);

  // Hold del sito: servono a sapere se un'auto è momentaneamente bloccata da
  // un cliente che sta pagando online, per non farla prenotare due volte.
  useEffect(() => {
    const caricaHolds = async () => {
      try {
        const datiHolds = await readHolds();
        setHolds(datiHolds);
      } catch (error) {
        console.error("Errore lettura hold:", error);
      }
    };

    caricaHolds();
    const interval = setInterval(caricaHolds, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRicerca = (e) => {
  e.preventDefault(); // evita il submit classico
  setPaginaPrenotazioni(1)

  // Scroll dopo un leggero delay
  setTimeout(() => {
    if (listaRef.current) {
      listaRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100);
};


  const getAvailableVehiclesForDate = (date, currentTarga = null, isNewBooking = true) => {
    if (!date) {
     console.log('Nessuna data fornita per il filtro dei veicoli.');
     return [];
    }
  
    return availableVehicles.filter(vehicle => {
      const isAlreadyBooked = prenotazioni.some(prenotazione => {
        if (prenotazione.targa !== vehicle.targa) return false;
      
          // Se la prenotazione è completata, considera solo le date dopo il rientro effettivo
      if (prenotazione.status === 'completata' && prenotazione.dataRientroEffettiva) {
  const rientro = new Date(prenotazione.dataRientroEffettiva);
  const giorno = new Date(date);
  if (giorno >= rientro) return false; // Non blocca più il veicolo
}
        const inizio = new Date(prenotazione.dataInizio);
        const fine = prenotazione.dataRientroEffettiva
          ? new Date(prenotazione.dataRientroEffettiva)
          : new Date(prenotazione.dataFine);
      
        const giorno = new Date(date);
        return inizio <= giorno && fine >= giorno;
      });
      return isNewBooking ? !isAlreadyBooked : !isAlreadyBooked || vehicle.targa === currentTarga;
    });
  };
      

  
   useEffect(() => {
    if (!selectedDate) {
     console.log('Nessuna data selezionata.');
     setAvailableVehiclesForBooking([]); // Assicurati di resettare lo stato
     return;
    }
  
    console.log('Data selezionata:', selectedDate);
    console.log('Targa corrente:', formData?.targa);
    console.log('Modalità nuova prenotazione:', isAddingNewBooking);
  
    const available = getAvailableVehiclesForDate(
     selectedDate,
     formData?.targa,
     isAddingNewBooking
    );
  
   console.log('Veicoli disponibili:', available);
   setAvailableVehiclesForBooking(available);
  
   }, [selectedDate, prenotazioni, availableVehicles, formData?.targa, isAddingNewBooking]);

  useEffect(() => {
    setAvailableVehiclesForBooking(availableVehicles);
  }, [availableVehicles, selectedDate, prenotazioni, formData?.targa, isAddingNewBooking]);


  const resetModal = () => {
    console.log('Reset modal chiamato');
    setModalIsOpen(false);
    setSchedaModalOpen(false);
    setRiepilogoOpen(false);
  
    setTimeout(() => {
      const root = document.getElementById('root');
      if (root) root.removeAttribute('aria-hidden');
      console.log('aria-hidden rimosso:', root.getAttribute('aria-hidden'));
  
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        console.log('Focus spostato su:', searchInputRef.current);
      }
    }, 50);
  
    setFormData({
      cliente: '',
      codiceFiscale: '',
      patente: '',
      veicolo: '',
      targa: '',
      dataInizio: selectedDate || '',
      dataFine: selectedDate || '',
      prezzoGiornaliero: '',
      prezzoTotale: '',
      emailCliente: '',
    });
  
    setSchedaVeicolo({
      carburante: '',
      kmIniziali: '',
      danni: '',
accessori: {
  cric: false,
  triangolo: false,
  giubbotto: false,
  ruotaScorta: false,
  cavoRicarica: false,
  cateneNeve: false,
  altro: ''
}
    });
  };

  const hasDraftBooking = () => (
    isAddingNewBooking ||
    editingIndex !== null ||
    Boolean(
      formData.cliente ||
      formData.codiceFiscale ||
      formData.patente ||
      formData.veicolo ||
      formData.targa ||
      formData.emailCliente
    )
  );

  const handleRequestCancelBooking = () => {
    if (!hasDraftBooking()) {
      resetModal();
      return;
    }

    setCancelConfirmOpen(true);
  };

  const handleConfirmCancelBooking = () => {
    setCancelConfirmOpen(false);
    resetModal();
  };

  
  const exportToCSV = () => {
    const header = [
      "Cliente", "Codice Fiscale", "Patente", "Veicolo", "Targa",
      "Data Inizio", "Data Fine", "Prezzo Giornaliero", "Prezzo Totale"
    ];
    const rows = prenotazioniAttive.map(p => [
      p.cliente, p.codiceFiscale, p.patente, p.veicolo, p.targa,
      p.dataInizio, p.dataFine, p.prezzoGiornaliero, p.prezzoTotale
    ]);
    const csvContent = [header, ...rows].map(e => e.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "prenotazioni.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFeedback("Esportazione completata!");
  };

  const calcGiorni = calcolaGiorniNoleggio;

  const openInfoModal = (prenotazione) => {
    setDettagliPrenotazione(prenotazione);
    setInfoModalOpen(true);
  };

  const closeInfoModal = () => {
    setDettagliPrenotazione(null);
    setInfoModalOpen(false);
  };

  const handleDelete = (index) => {
    // Una prenotazione pagata online non si elimina: il cliente resterebbe
    // addebitato. Si annulla con rimborso su Stripe.
    if (isPagataOnline(prenotazioni[index])) {
      setDaRimborsare(prenotazioni[index]);
      return;
    }
    setDeleteIndex(index);
    setConfirmOpen(true);
  };

  // `penale` (facoltativa): { percentuale } o { importo } da trattenere.
  const confermaRimborso = async (penale) => {
    const prenotazione = daRimborsare;
    if (!prenotazione || rimborsoInCorso) return;
    setRimborsoInCorso(true);
    try {
      const { rimborsato, trattenuto, giaRimborsato } = await annullaConRimborso(prenotazione.id, penale);
      dispatch(updatePrenotazione({
        ...prenotazione,
        status: 'annullata',
        ...(rimborsato > 0 ? { rimborsato } : {}),
        ...(trattenuto > 0 ? { penaleTrattenuta: trattenuto } : {}),
      }));
      setDaRimborsare(null);
      setInfoModalOpen(false);
      showFeedback(
        giaRimborsato
          ? 'Prenotazione annullata (il pagamento risultava già rimborsato su Stripe).'
          : trattenuto > 0
            ? `Prenotazione annullata. Rimborsati ${rimborsato.toFixed(2)} € al cliente, trattenuti ${trattenuto.toFixed(2)} € di penale.`
            : `Prenotazione annullata. Rimborsati ${rimborsato.toFixed(2)} € al cliente.`,
        'success',
      );
    } catch (error) {
      console.error('Errore annullamento con rimborso:', error);
      // La prenotazione resta attiva: nessun rimborso è stato registrato.
      showFeedback(messaggioErroreRimborso(error), 'error');
    } finally {
      setRimborsoInCorso(false);
    }
  };

  
  // Salva subito la prenotazione (nuova o modificata). Km, carburante,
  // accessori e contratto si fanno dopo, il giorno del ritiro, con "Consegna".
  const handleBookingSubmit = async (data) => {
    if (salvandoPrenotazione) return;
    const prenotazioneCorrente = editingIndex !== null ? prenotazioni[editingIndex] : null;

    // Date, veicolo libero (stessa regola di Veicoli e Dashboard: le annullate e
    // le richieste del sito non pagate non bloccano, la categoria piena si') e
    // prezzo: quello pagato sul sito non si ricalcola.
    const esito = controllaPrenotazione({
      dati: data,
      originale: prenotazioneCorrente,
      veicoli: availableVehicles,
      prenotazioni,
      holds,
      oggi: giornoLocale(),
    });
    if (esito.errore) {
      showFeedback(esito.errore, "error");
      return;
    }

    setSalvandoPrenotazione(true);
    try {
      const salvata = await salvaPrenotazione(
        {
          ...data,
          codiceFiscale: data.codiceFiscale?.toUpperCase() || '',
          prezzoTotale: esito.prezzoTotale,
        },
        prenotazioneCorrente,
      );
      dispatch(prenotazioneCorrente ? updatePrenotazione(salvata) : addPrenotazione(salvata));
      showFeedback(prenotazioneCorrente ? "Prenotazione modificata." : "Prenotazione salvata. Al ritiro usa «Consegna».");
      setEditingIndex(null);
      setIsAddingNewBooking(false);
      resetModal();
    } catch (error) {
      console.error("Errore salvataggio prenotazione:", error);
      showFeedback(messaggioErrorePrenotazione(error, "Prenotazione non salvata, riprova."), "error");
    } finally {
      setSalvandoPrenotazione(false);
    }
  };

  const apriNuovaPrenotazione = () => {
    setFormData({
      cliente: '', codiceFiscale: '', patente: '', veicolo: '', targa: '',
      dataInizio: '', dataFine: '', prezzoGiornaliero: '', prezzoTotale: '', emailCliente: '',
    });
    setSelectedDate(null);
    setEditingIndex(null);
    setIsAddingNewBooking(true);
    setModalIsOpen(true);
  };

  // Apre il form con una prenotazione esistente.
  const apriModifica = (prenotazione) => {
    setFormData({ ...prenotazione });
    setEditingIndex(prenotazioni.findIndex((p) => p.id === prenotazione.id));
    setIsAddingNewBooking(true);
    setSelectedDate(prenotazione.dataInizio);
    setInfoModalOpen(false);
    setModalIsOpen(true);
  };

  // Dal riepilogo di un giorno: nuova prenotazione che parte quel giorno.
  const nuovaPerGiorno = () => {
    setFormData({
      cliente: '', codiceFiscale: '', patente: '', veicolo: '', targa: '',
      dataInizio: selectedDate, dataFine: selectedDate, prezzoGiornaliero: '', prezzoTotale: '', emailCliente: '',
    });
    setEditingIndex(null);
    setIsAddingNewBooking(true);
  };

  // --- Consegna: scheda del veicolo, poi riepilogo con contratto e PDF ---
  const avviaConsegna = (prenotazione) => {
    const veicolo = availableVehicles.find((v) => v.targa === prenotazione.targa);
    setConsegnaDi(prenotazione);
    setPatenteConsegna('');
    // I km partono da quelli segnati sul veicolo: si correggono se diversi.
    setSchedaVeicolo({ ...schedaVuota(), kmIniziali: veicolo?.km ?? '' });
    setInfoModalOpen(false);
    setModalIsOpen(false);
    setSchedaModalOpen(true);
  };

  const chiudiConsegna = () => {
    setSchedaModalOpen(false);
    setRiepilogoOpen(false);
    setConsegnaDi(null);
  };

  const handleSaveSchedaVeicolo = () => {
    setSchedaModalOpen(false);
    setRiepilogoOpen(true);
  };

  // La consegna e' salvata: aggiorna subito la tabella. La finestra del
  // riepilogo resta aperta finche' non si chiude (PDF da rifare, ecc.).
  const handleConsegnaSalvata = (campi) => {
    const aggiornata = { ...consegnaDi, ...campi };
    dispatch(updatePrenotazione(aggiornata));
    setConsegnaDi(aggiornata);
  };

  const handleDateClick = (arg) => {
    const dateStr = arg.dateStr;
    setSelectedDate(dateStr);
    setIsAddingNewBooking(true);
    setEditingIndex(null);
    setFormData({
      cliente: '',
      codiceFiscale: '',
      patente: '',
      veicolo: '',
      targa: '',
      dataInizio: dateStr,
      dataFine: dateStr,
      prezzoGiornaliero: '',
      prezzoTotale: '',
      emailCliente: '',
    });
  
    
  
    // Confronto tra giorni 'AAAA-MM-GG' (con toISOString il giorno slittava
    // indietro di uno in Italia).
    const prenotazioniDelGiorno = prenotazioniAttive.filter(
      (p) => String(p.dataInizio).slice(0, 10) <= dateStr && String(p.dataFine).slice(0, 10) >= dateStr
    );
    
    if (prenotazioniDelGiorno.length > 0) {
      setPrenotazioniGiorno(prenotazioniDelGiorno);
      setIsAddingNewBooking(false);
    } else {
      setPrenotazioniGiorno([]);
    }
    
    setModalIsOpen(true);
 
  };

  useEffect(() => {
    if (modalIsOpen) {
      // Timeout per garantire che il modal sia completamente renderizzato
      setTimeout(() => {
        const input = document.querySelector('.calendar-modal input');
        if (input) input.focus();
      }, 100);
    }
  }, [modalIsOpen]);


  // Elimina solo quel documento (prima si riscriveva tutta la collezione).
  const confermaEliminazione = async () => {
    const index = deleteIndex;
    if (index === null) return;
    setConfirmOpen(false);
    const prenotazioneEliminata = prenotazioni[index];

    try {
      await eliminaPrenotazione(prenotazioneEliminata.id);
      dispatch(deletePrenotazione(prenotazioneEliminata.id));
      resetModal();
      showFeedback("Prenotazione eliminata con successo.", "success");
    } catch (error) {
      console.error("Errore durante eliminazione:", error);
      showFeedback("Errore nell'eliminazione", "error");
    } finally {
      setDeleteIndex(null);
    }
  };

// Conclude un noleggio con l'esito della riconsegna.
// - Le foto dei danni vanno su Storage (cartella danni/): prima finivano
//   incorporate nei documenti di prenotazione e veicolo (limite di 1 MB).
// - Il danno resta SOLO sulla prenotazione: la scheda del veicolo lo mostra in
//   "Danni rilevati alle riconsegne" e da li' si segna riparato. Prima veniva
//   copiato anche nei danni del veicolo (con la foto in un campo che la scheda
//   non legge) e la Dashboard lo contava due volte.
// - Si aggiornano solo la prenotazione e la voce nello storico del cliente,
//   invece di riscrivere tutte le prenotazioni, tutti i clienti e la flotta.
const confermaConclusioneConDanni = async ({ descrizioneDanno, daRiparare, fotoDanni }) => {
  const now = new Date().toISOString();
  const prenotazione = prenotazioneDaConcludere;
  if (!prenotazione) return;

  try {
    const foto = fotoDanni ? await Promise.all([].concat(fotoDanni).map(fotoIncorporataSuStorage)) : null;
    const campi = {
      status: 'completata',
      dataRientroEffettiva: now,
      descrizioneDanno: descrizioneDanno || '',
      daRiparare: Boolean(daRiparare),
      fotoDanni: foto && foto.length > 0 ? foto : null,
    };
    await aggiornaPrenotazione(prenotazione.id, campi, { statoAtteso: 'attiva' });
    dispatch(updatePrenotazione({ ...prenotazione, ...campi }));

    if (descrizioneDanno?.trim()) {
      const clienteDelNoleggio = clienti.find((c) =>
        (prenotazione.codiceFiscale && c.codiceFiscale === prenotazione.codiceFiscale) ||
        (prenotazione.emailCliente && c.email === prenotazione.emailCliente)
      );
      if (clienteDelNoleggio?.id) {
        const voce = {
          data: now,
          descrizioneDanno,
          veicolo: prenotazione.veicolo || '',
          targa: prenotazione.targa || '',
          riferimentoPrenotazione: prenotazione.id,
        };
        try {
          await aggiungiDannoCliente(clienteDelNoleggio.id, voce);
          dispatch(setClienti(clienti.map((c) =>
            c.id === clienteDelNoleggio.id ? { ...c, storicoDanni: [...(c.storicoDanni || []), voce] } : c)));
        } catch (error) {
          console.error("Errore storico danni cliente:", error);
          showFeedback("Noleggio concluso, ma non sono riuscito ad aggiornare lo storico danni del cliente.", "error");
        }
      }
    }

    showFeedback("Prenotazione conclusa con esito registrato.");
    setConcludiModalOpen(false);
    setPrenotazioneDaConcludere(null);
  } catch (error) {
    console.error("Errore conclusione prenotazione:", error);
    showFeedback(messaggioErrorePrenotazione(error, "Errore durante la conclusione del noleggio."), "error");
  }
};

// Conclude in blocco i noleggi finiti da ieri o prima (non quelli di oggi: il
// veicolo potrebbe non essere ancora rientrato) e con un veicolo assegnato.
// Chiede conferma e aggiorna le prenotazioni una per una.
const concludiPrenotazioniScadute = () => {
  const daConcludere = daConcludereInBlocco(prenotazioniAttive, giornoLocale());

  if (daConcludere.length === 0) {
    showFeedback("Non ci sono noleggi finiti da concludere.", "error");
    return;
  }

  setConfermaInBlocco(daConcludere);
};

const eseguiConclusioneInBlocco = async () => {
  const daConcludere = confermaInBlocco || [];
  setConfermaInBlocco(null);
  const now = new Date().toISOString();
  const esiti = await Promise.allSettled(
    daConcludere.map(async (p) => {
      const campi = { status: 'completata', dataRientroEffettiva: now };
      await aggiornaPrenotazione(p.id, campi, { statoAtteso: 'attiva' });
      dispatch(updatePrenotazione({ ...p, ...campi }));
    })
  );
  const fallite = esiti.filter((e) => e.status === 'rejected').length;
  if (fallite === 0) {
    showFeedback(`${daConcludere.length} noleggi conclusi.`, "success");
  } else {
    showFeedback(`${daConcludere.length - fallite} noleggi conclusi, ${fallite} non riusciti: ricarica la pagina e riprova.`, "error");
  }
};



if(loading){
  return (
    <div className="bookings-container">
      <div className='spinner-container'>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <div className="spinner" />
        <p>Caricamento in corso...</p>
      </div>
    </div> 
      </div>     
  );
}

const oggi = giornoLocale();
// Ricerca su piu' parole (es. "rossi panda"), come in Veicoli. Le prenotazioni
// del sito possono non avere email o targa: niente crash sui campi vuoti.
const paroleCercate = search.toLowerCase().split(/\s+/).filter(Boolean);
const perRicerca = (p) => [p.cliente, p.targa, p.veicolo, p.emailCliente, p.categoria]
  .filter(Boolean).join(' ').toLowerCase();
const trovate = prenotazioniAttive.filter((p) => paroleCercate.every((parola) => perRicerca(p).includes(parola)));
const contaFase = (chiave) => (chiave === 'tutte' ? trovate.length : trovate.filter((p) => faseLavoro(p, oggi) === chiave).length);
const prenotazioniAttiveFiltrate = trovate
  .filter((p) => filtroFase === 'tutte' || faseLavoro(p, oggi) === filtroFase)
  .sort((a, b) => String(a.dataInizio).localeCompare(String(b.dataInizio)));
const ricercaAttiva = search.trim();
const prenotazioniDaConcludereOggi = daConcludereInBlocco(prenotazioniAttive, oggi);
// Calendario: una barra per prenotazione, dal ritiro alla riconsegna (FullCalendar
// vuole la fine esclusa: il giorno dopo), colorata secondo la fase.
const eventiCalendario = trovate
  .filter((p) => filtroFase === 'tutte' || faseLavoro(p, oggi) === filtroFase)
  .filter((p) => p.dataInizio && p.dataFine)
  .map((p) => ({
    id: p.id,
    title: `${p.cliente || 'Cliente'} · ${p.targa || p.categoria || ''}`,
    start: String(p.dataInizio).slice(0, 10),
    end: giornoDopo(String(p.dataFine).slice(0, 10)),
    allDay: true,
    classNames: ['bk-evento', `fase--${faseLavoro(p, oggi)}`],
    extendedProps: { prenotazione: p },
  }));
const numeroPagine = Math.ceil(prenotazioniAttiveFiltrate.length / righePerPagina);


return (
  <div className="bookings-container">
  {feedbackMessage && (
      <div className={`feedback ${feedbackType}`}>
        {feedbackType === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
        <span>{feedbackMessage}</span>
      </div>
    )}
  <div className="bk-toolbar">
    <div>
      <h1 className="bk-titolo">Prenotazioni</h1>
      <span className="bk-conteggio">
        {prenotazioniAttive.length} {prenotazioniAttive.length === 1 ? 'noleggio attivo' : 'noleggi attivi'}
      </span>
    </div>
    <div className="bk-azioni">
      <form onSubmit={handleRicerca} className="bk-cerca" role="search">
        <Search size={16} aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="search"
          placeholder="Cerca cliente, targa, veicolo…"
          aria-label="Cerca prenotazioni"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>
      <div className="bk-vista" role="tablist" aria-label="Vista">
        <button type="button" role="tab" aria-selected={vista === 'elenco'}
          className={vista === 'elenco' ? 'bk-vista--attiva' : ''} onClick={() => cambiaVista('elenco')}>
          <List size={16} aria-hidden="true" /> Elenco
        </button>
        <button type="button" role="tab" aria-selected={vista === 'calendario'}
          className={vista === 'calendario' ? 'bk-vista--attiva' : ''} onClick={() => cambiaVista('calendario')}>
          <CalendarDays size={16} aria-hidden="true" /> Calendario
        </button>
      </div>
      <button type="button" className="bk-btn" onClick={exportToCSV} title="Esporta le prenotazioni attive in un file CSV">
        <Download size={16} aria-hidden="true" /> CSV
      </button>
      <button type="button" className="bk-btn bk-btn--primario" onClick={apriNuovaPrenotazione}>
        <Plus size={16} aria-hidden="true" /> Nuova prenotazione
      </button>
    </div>
  </div>

  <PrenotazioniDaAssegnare prenotazioni={prenotazioni} veicoli={availableVehicles} />

  <div className="bk-barra">
    <div className="bookings-filtri" role="tablist" aria-label="Filtra per stato">
      {FILTRI_FASE.map(({ chiave, etichetta }) => (
        <button
          key={chiave}
          type="button"
          role="tab"
          aria-selected={filtroFase === chiave}
          className={`bookings-filtro ${filtroFase === chiave ? 'bookings-filtro--attivo' : ''}`}
          onClick={() => setFiltroFase(chiave)}
        >
          {etichetta} <span className="bookings-filtro-conto">{contaFase(chiave)}</span>
        </button>
      ))}
    </div>
    <button
      type="button"
      className="bk-btn"
      onClick={concludiPrenotazioniScadute}
      disabled={prenotazioniDaConcludereOggi.length === 0}
      title="Conclude i noleggi consegnati e finiti da ieri o prima"
    >
      <CheckCircle size={16} aria-hidden="true" /> Concludi i noleggi finiti
    </button>
  </div>

  {vista === 'calendario' ? (
    <div className="bk-calendario">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        locale={itLocale}
        initialView="dayGridMonth"
        height="auto"
        dayMaxEvents={3}
        moreLinkText={(n) => `+${n} altri`}
        moreLinkClick={(info) => { handleDateClick({ dateStr: giornoLocale(info.date) }); return 'none'; }}
        dateClick={handleDateClick}
        eventClick={(info) => openInfoModal(info.event.extendedProps.prenotazione)}
        events={eventiCalendario}
        eventContent={(arg) => (
          <span className="bk-evento-testo" title={arg.event.title}>{arg.event.title}</span>
        )}
        buttonText={{ today: 'Oggi' }}
      />
      <div className="bk-legenda" aria-label="Legenda">
        <span><i className="bk-legenda-punto fase--da-consegnare" /> Da consegnare</span>
        <span><i className="bk-legenda-punto fase--in-corso" /> In corso</span>
        <span><i className="bk-legenda-punto fase--da-concludere" /> Da concludere</span>
        <span className="bk-legenda-nota">Clic su un giorno per vederne i noleggi o crearne uno, su un nome per i dettagli.</span>
      </div>
    </div>
  ) : (
    <div className="bk-elenco" ref={listaRef}>
      <table className="bk-tabella">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Veicolo</th>
            <th>Periodo</th>
            <th className="bk-destra">Prezzo</th>
            <th>Stato</th>
            <th aria-label="Azioni" />
          </tr>
        </thead>
        <tbody>
          {prenotazioniAttiveFiltrate.length === 0 ? (
            <tr>
              <td colSpan="6" className="bk-vuoto">
                {ricercaAttiva ? `Nessuna prenotazione trovata per “${ricercaAttiva}”.` : 'Nessuna prenotazione in questo elenco.'}
              </td>
            </tr>
          ) : (
            prenotazioniAttiveFiltrate
              .slice((paginaPrenotazioni - 1) * righePerPagina, paginaPrenotazioni * righePerPagina)
              .map((p) => {
                const fase = faseLavoro(p, oggi);
                const nota = promemoria(p, oggi);
                const giorniNoleggio = calcGiorni(p.dataInizio, p.dataFine);
                return (
                  <tr key={p.id} onClick={() => openInfoModal(p)} className="bk-riga">
                    <td>
                      <span className="bk-principale">{p.cliente || '—'}</span>
                      {p.emailCliente && <span className="bk-secondario">{p.emailCliente}</span>}
                    </td>
                    <td>
                      <span className="bk-principale">{p.veicolo || p.categoria || '—'}</span>
                      {p.targa && <span className="bk-targa">{p.targa}</span>}
                    </td>
                    <td>
                      <span className="bk-principale">{formattaData(p.dataInizio)} → {formattaData(p.dataFine)}</span>
                      {giorniNoleggio > 0 && (
                        <span className="bk-secondario">{giorniNoleggio} {giorniNoleggio === 1 ? 'giorno' : 'giorni'}</span>
                      )}
                    </td>
                    <td className="bk-destra">
                      <span className="bk-principale">
                        {prezzoPrenotazione(p) ? `€ ${Number(prezzoPrenotazione(p)).toLocaleString('it-IT')}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`fase-badge fase-badge--${fase}`}>
                        {daAssegnare(p) ? 'Veicolo da assegnare' : ETICHETTA_FASE[fase]}
                      </span>
                      <span className={`bk-promemoria bk-promemoria--${nota.livello || 'normale'}`}>{nota.testo}</span>
                    </td>
                    <td className="bk-azioni-riga" onClick={(e) => e.stopPropagation()}>
                      {puoConsegnare(p) && (
                        <button type="button" className="bk-btn bk-btn--piccolo bk-btn--consegna" onClick={() => avviaConsegna(p)} title="Consegna il veicolo">
                          <KeyRound size={15} aria-hidden="true" /> <span className="bk-btn-testo">Consegna</span>
                        </button>
                      )}
                      {puoConcludere(p) && (
                        <button
                          type="button"
                          className="bk-btn bk-btn--piccolo bk-btn--concludi"
                          title="Concludi il noleggio"
                          onClick={() => {
                            setInfoModalOpen(false);
                            setModalIsOpen(false);
                            setPrenotazioneDaConcludere(p);
                            setConcludiModalOpen(true);
                          }}
                        >
                          <CheckCircle size={15} aria-hidden="true" /> <span className="bk-btn-testo">Concludi</span>
                        </button>
                      )}
                      <button type="button" className="bk-btn bk-btn--piccolo bk-btn--icona" onClick={() => openInfoModal(p)} aria-label="Dettagli" title="Dettagli">
                        <Info size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })
          )}
        </tbody>
      </table>
      {numeroPagine > 1 && (
        <div className="bk-pagine">
          {[...Array(numeroPagine)].map((_, i) => (
            <button
              key={i}
              type="button"
              className={paginaPrenotazioni === i + 1 ? 'bk-pagina--attiva' : ''}
              onClick={() => setPaginaPrenotazioni(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )}

    <BookingModal key={forceRenderKey} open={modalIsOpen} onClose={handleRequestCancelBooking} className="pz-dialog">
    {isAddingNewBooking ? (
        <BookingForm
          onSubmit={handleBookingSubmit}
          onAnnulla={handleRequestCancelBooking}
          initialValues={formData}
          availableVehicles={availableVehiclesForBooking}
          veicoli={availableVehicles}
          holds={holds}
          clienti = {clienti}
          prenotazioni={prenotazioni}
          salvando={salvandoPrenotazione}
       />
    ) : (
      <div className="pz">
        <header className="pz-testa">
          <div>
            <h2 className="pz-titolo">Prenotazioni del {formattaData(selectedDate)}</h2>
            <span className="pz-sottotitolo">
              {prenotazioniGiorno.length === 0
                ? 'Nessun noleggio in questo giorno.'
                : `${prenotazioniGiorno.length} ${prenotazioniGiorno.length === 1 ? 'noleggio' : 'noleggi'} in corso o in partenza`}
            </span>
          </div>
        </header>
        <div className="pz-corpo">
          {prenotazioniGiorno.length === 0 ? (
            <p className="pz-vuoto">Nessuna prenotazione per questa data.</p>
          ) : (
            <div className="pz-lista">
              {prenotazioniGiorno.map((prenotazione) => {
                const fase = faseLavoro(prenotazione, oggi);
                return (
                  <div key={prenotazione.id} className="pz-voce">
                    <div className="pz-voce-testo">
                      <span className="pz-voce-nome">{prenotazione.cliente || 'Cliente'}</span>
                      <span className="pz-voce-dettaglio">
                        {prenotazione.veicolo || prenotazione.categoria}{prenotazione.targa ? ` · ${prenotazione.targa}` : ''}
                        {' · '}{formattaData(prenotazione.dataInizio)} → {formattaData(prenotazione.dataFine)}
                        {' · '}{prezzoPrenotazione(prenotazione) || '—'} €
                      </span>
                      <span>
                        <span className={`fase-badge fase-badge--${fase}`}>
                          {daAssegnare(prenotazione) ? 'Veicolo da assegnare' : ETICHETTA_FASE[fase]}
                        </span>
                      </span>
                    </div>
                    <div className="pz-voce-azioni">
                      {puoConsegnare(prenotazione) && (
                        <button type="button" className="vd-btn vd-btn--primario vd-btn--piccolo" onClick={() => avviaConsegna(prenotazione)}>
                          <KeyRound size={15} /> Consegna
                        </button>
                      )}
                      {puoConcludere(prenotazione) && (
                        <button
                          type="button"
                          className="vd-btn vd-btn--successo vd-btn--piccolo"
                          onClick={() => {
                            setModalIsOpen(false);
                            setPrenotazioneDaConcludere(prenotazione);
                            setConcludiModalOpen(true);
                          }}
                        >
                          <CheckCircle size={15} /> Concludi
                        </button>
                      )}
                      <button type="button" className="vd-btn vd-btn--piccolo" onClick={() => apriModifica(prenotazione)}>
                        <Edit3 size={15} /> Modifica
                      </button>
                      <button
                        type="button"
                        className="vd-btn vd-btn--pericolo vd-btn--piccolo"
                        onClick={() => handleDelete(prenotazioni.findIndex((p) => p.id === prenotazione.id))}
                      >
                        <Trash2 size={15} /> {isPagataOnline(prenotazione) ? 'Annulla e rimborsa' : 'Elimina'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <footer className="pz-piede">
          <button type="button" className="vd-btn" onClick={() => setModalIsOpen(false)}>Chiudi</button>
          <button type="button" className="vd-btn vd-btn--primario" onClick={nuovaPerGiorno}>
            <Plus size={16} /> Nuova prenotazione dal {formattaData(selectedDate)}
          </button>
        </footer>
      </div>
    )}
  </BookingModal>

    {/* Modal info dettagliato */}
   <InfoModal
    isOpen={infoModalOpen}
    onClose={closeInfoModal}
    prenotazione={dettagliPrenotazione}
    onModifica={apriModifica}
    onElimina={(p) => {
      const index = prenotazioni.findIndex(item => item.id === p.id);
      handleDelete(index);
      setInfoModalOpen(false);
    }}
    onConsegna={avviaConsegna}
    onConcludi={(p) => {
     setInfoModalOpen(false);          
    setModalIsOpen(false);            
    setPrenotazioneDaConcludere(p);   
    setConcludiModalOpen(true);      
    setForceRenderKey(prev => prev + 1); 
    }}
      />
    <SchedaVeicoloModal
    isOpen={schedaModalOpen}
    onRequestClose={chiudiConsegna}
    prenotazione={consegnaDi}
    schedaVeicolo={schedaVeicolo}
    setSchedaVeicolo={setSchedaVeicolo}
    patente={patenteConsegna}
    onPatenteChange={setPatenteConsegna}
    onSave={handleSaveSchedaVeicolo}
  />

  {consegnaDi && (
    <RiepilogoPrenotazioneModal
      isOpen={riepilogoOpen}
      onClose={chiudiConsegna}
      formData={{ ...consegnaDi, patente: consegnaDi.patente || patenteConsegna.trim().toUpperCase() }}
      schedaVeicolo={schedaVeicolo}
      onConsegnaSalvata={handleConsegnaSalvata}
    />
  )}
  
  <ConfirmDialog
    open={confirmOpen}
    onCancel={() => setConfirmOpen(false)}
    onConfirm={confermaEliminazione}
    message="Sei sicuro di voler eliminare questa prenotazione?"
    title="Elimina Prenotazione"
    confirmLabel="Elimina"
    tone="danger"
  />

  <AnnullaConPenaleModal
    key={daRimborsare?.id || 'nessuna'}
    prenotazione={daRimborsare}
    inCorso={rimborsoInCorso}
    onClose={() => setDaRimborsare(null)}
    onConferma={confermaRimborso}
  />

  <ConfirmDialog
    open={confermaInBlocco !== null}
    onCancel={() => setConfermaInBlocco(null)}
    onConfirm={eseguiConclusioneInBlocco}
    title="Concludere i noleggi finiti?"
    message={confermaInBlocco
      ? `Concludo ${confermaInBlocco.length === 1 ? 'il noleggio finito' : `i ${confermaInBlocco.length} noleggi finiti`} da ieri o prima, senza danni registrati: ${confermaInBlocco.map((p) => `${p.cliente || 'cliente'} (${p.targa})`).join(', ')}. Per un noleggio con danni usa "Concludi" sulla sua riga.`
      : ''}
    confirmLabel="Concludi"
  />

  <ConfirmDialog
    open={cancelConfirmOpen}
    onCancel={() => setCancelConfirmOpen(false)}
    onConfirm={handleConfirmCancelBooking}
    title="Annullare Prenotazione?"
    message="Se annulli ora, i dati inseriti in questa prenotazione verranno scartati. Vuoi continuare?"
    confirmLabel="Sì, annulla"
    tone="danger"
  />

  <ConcludiPrenotazioneModal
  isOpen={concludiModalOpen}
  onClose={() => setConcludiModalOpen(false)}
  onConferma={confermaConclusioneConDanni}
  prenotazione={prenotazioneDaConcludere}
/>

  
  </div>
  
  );
}


export default Bookings;
