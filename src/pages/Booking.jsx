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
import { Search, Info, CheckCircle, AlertCircle, Edit3, Trash2, KeyRound, Plus } from 'lucide-react';
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
import { giornoLocale } from '../utils/scadenze';
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

  const groupPrenotazioniByDate = () => {
    const dateMap = {};
    prenotazioniAttive.forEach((p) => {
      const start = new Date(p.dataInizio);
      const end = new Date(p.dataFine);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (!dateMap[dateStr]) {
          dateMap[dateStr] = { count: 0, bookings: [] };
        }
        dateMap[dateStr].count++;
        dateMap[dateStr].bookings.push(p);
      }
    });
    const events = Object.entries(dateMap).map(([date, data]) => ({
      title: ` ${data.count}`,
      date,
      extendedProps: { bookings: data.bookings, count: data.count },
      className: 'booking-dot-event',
    }));
    console.log("Eventi generati per il calendario:", events);
    return events;
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
  
    
  
    const prenotazioniDelGiorno = prenotazioniAttive.filter(
      (p) =>
        new Date(p.dataInizio).toISOString().split('T')[0] <= dateStr &&
        new Date(p.dataFine).toISOString().split('T')[0] >= dateStr
    );
    
    if (prenotazioniDelGiorno.length > 0) {
      setPrenotazioniGiorno(prenotazioniDelGiorno);
      setIsAddingNewBooking(false);
    } else {
      setPrenotazioniGiorno([]);
    }
    
    setModalIsOpen(true);
 
  };

  const handleEventClick = (info) => {
    const prenotazioniDelGiorno = (info.event.extendedProps.bookings || []).filter(
     (p) => p.status !== 'completata'
    );
  
    setSelectedDate(info.event.startStr);
    setPrenotazioniGiorno(prenotazioniDelGiorno);
    setIsAddingNewBooking(false);
  
    // Popola formData con i dettagli della prima prenotazione (o quella cliccata, se hai un modo per identificarla univocamente)
    if (prenotazioniDelGiorno.length > 0) {
     const primaPrenotazione = prenotazioniDelGiorno[0]; // Prendi la prima come esempio
     const giorni = calcGiorni(primaPrenotazione.dataInizio, primaPrenotazione.dataFine);
     setFormData({
      id: primaPrenotazione.id,
      cliente: primaPrenotazione.cliente,
      codiceFiscale: primaPrenotazione.codiceFiscale,
      patente: primaPrenotazione.patente,
      veicolo: primaPrenotazione.veicolo,
      targa: primaPrenotazione.targa,
      dataInizio: primaPrenotazione.dataInizio,
      dataFine: primaPrenotazione.dataFine,
      prezzoGiornaliero: primaPrenotazione.prezzoGiornaliero,
      prezzoTotale: giorni * parseFloat(primaPrenotazione.prezzoGiornaliero || 0),
      emailCliente: primaPrenotazione.emailCliente,
     });
     setSchedaVeicolo(primaPrenotazione.schedaVeicolo || {
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
     setEditingIndex(prenotazioni.findIndex(p => p.id === primaPrenotazione.id)); // Imposta l'indice di modifica
    } else {
     // Se non ci sono prenotazioni per quel giorno, resetta il form per una nuova prenotazione
     setFormData({
      cliente: '',
      codiceFiscale: '',
      patente: '',
      veicolo: '',
      targa: '',
      dataInizio: info.event.startStr,
      dataFine: info.event.startStr,
      prezzoGiornaliero: '',
      prezzoTotale: '',
      emailCliente: '',
     });
     setSchedaVeicolo({ carburante: '', kmIniziali: '', danni: '', accessori: {
  cric: false,
  triangolo: false,
  giubbotto: false,
  ruotaScorta: false,
  cavoRicarica: false,
  cateneNeve: false,
  altro: ''
} 
});
     setEditingIndex(null);
     setIsAddingNewBooking(true); // Imposta a true se vuoi aggiungere una nuova da qui
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
const numeroPagine = Math.ceil(prenotazioniAttiveFiltrate.length / righePerPagina);


return (
  <div className="bookings-container">
  {feedbackMessage && (
      <div className={`feedback ${feedbackType}`}>
        {feedbackType === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
        <span>{feedbackMessage}</span>
      </div>
    )}
  <div className="bookings-testa">
    <h1>Prenotazioni</h1>
    <button type="button" className="bookings-nuova-btn" onClick={apriNuovaPrenotazione}>
      <Plus size={18} aria-hidden="true" /> Nuova prenotazione
    </button>
  </div>

  <PrenotazioniDaAssegnare prenotazioni={prenotazioni} veicoli={availableVehicles} />

<form onSubmit={handleRicerca} className="bookings-search-form">
  <Search
    size={18}
    style={{
      position: 'absolute',
      left: '10px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#888',
      pointerEvents: 'none',
    }}
  />
  <input
    ref={searchInputRef}
    className="search-input-enhanced"
    type="text"
    placeholder="Cerca per cliente, targa o veicolo..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    style={{
      flex: 1,
      padding: '0.5rem 0.5rem 0.5rem 2rem',
      fontSize: '1rem',
      borderRadius: '6px',
      border: '1px solid #ccc',
    }}
  />
  <button
    type="submit"
    style={{
      marginLeft: '0.5rem',
      padding: '0.5rem 1rem',
      fontSize: '1rem',
      backgroundColor: '#2563eb',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
    }}
  >
    Cerca
  </button>
</form>

{ricercaAttiva && (
  <div className="active-search-banner">
    <span className="active-search-label">Ricerca attiva</span>
    <span className="active-search-term">{ricercaAttiva}</span>
    <button
      type="button"
      className="active-search-count active-search-count-button"
      onClick={() => listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      {prenotazioniAttiveFiltrate.length} risultati
    </button>
  </div>
)}


    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
    <button onClick={exportToCSV} className="export-btn">📁 Esporta CSV</button>
  </div>
    <h2 className="subtitle">Calendario Prenotazioni</h2>
  
    <div className="calendar-wrapper">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        locale={itLocale}
        initialView="dayGridMonth"
        selectable={true}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        events={groupPrenotazioniByDate()}
        eventContent={(arg) => {
          if (arg.event.extendedProps.bookings) {
            return <div className="booking-dot">{arg.event.extendedProps.count}</div>;
          }
          return arg.event.title;
        }}
        buttonText={{ prev: '<', next: '>', today: 'Oggi', month: 'Mese', week: 'Settimana', day: 'Giorno' }}
      />
    </div>
  
    <BookingModal key={forceRenderKey} open={modalIsOpen} onClose={handleRequestCancelBooking}>
    {isAddingNewBooking ? (
      <div>
        <h2>{editingIndex !== null ? 'Modifica Prenotazione' : 'Aggiungi Prenotazione'}</h2>
        <BookingForm
          onSubmit={handleBookingSubmit}
          initialValues={formData}
          availableVehicles={availableVehiclesForBooking}
          veicoli={availableVehicles}
          holds={holds}
          clienti = {clienti}
          prenotazioni={prenotazioni}
          salvando={salvandoPrenotazione}
       />
      </div>
    ) : (
      <div>
        <h2>Prenotazioni del {selectedDate}</h2>
        {prenotazioniGiorno.length > 0 ? (
          <div>
            <div className="booking-cards">
              {prenotazioniGiorno.map((prenotazione, index) => (
                <div key={index} className="booking-card">
                  <div className="booking-info">
                    <p><strong>Cliente:</strong> {prenotazione.cliente}</p>
                    <p><strong>Veicolo:</strong> {prenotazione.veicolo} ({prenotazione.targa})</p>
                    <p><strong>Periodo:</strong> {prenotazione.dataInizio} → {prenotazione.dataFine}</p>
                    <p><strong>Prezzo:</strong> {prezzoPrenotazione(prenotazione)} €</p>
                  </div>
                  <div className="booking-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        const giorni = calcGiorni(prenotazione.dataInizio, prenotazione.dataFine);
                        setFormData({
                          ...prenotazione,
                          prezzoTotale: giorni * parseFloat(prenotazione.prezzoGiornaliero || 0)
                        });
                        setSchedaVeicolo(prenotazione.schedaVeicolo || {
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
                        const globalIndex = prenotazioni.findIndex(p => p === prenotazione);
                        setEditingIndex(globalIndex);
                        setIsAddingNewBooking(true);
                        setSelectedDate(prenotazione.dataInizio);
                        setModalIsOpen(true);
                      }}
                    >
                      <Edit3 size={16} /> 
                                       Modifica
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(prenotazioni.findIndex(p => p === prenotazione))}
                    >
                      <Trash2 size={16} />
                      Elimina
                    </button>
                  {puoConsegnare(prenotazione) && (
                    <button className="btn btn-primary" onClick={() => avviaConsegna(prenotazione)}>
                      <KeyRound size={16} /> Consegna
                    </button>
                  )}
                  {puoConcludere(prenotazione) && (
                  <button
  className="btn btn-success"
  onClick={() => {
    setModalIsOpen(false); // 🔴 chiudi BookingModal
    setPrenotazioneDaConcludere(prenotazione); // ✅ setta prenotazione attuale
    setConcludiModalOpen(true); // ✅ apri modale conclusione
  }}
>
  <CheckCircle size={16}/>
  Concludi
</button>
                  )}
                  </div>
                </div>
              ))}
            </div>
            <button className='btn-newPrenotazione' onClick={() => {
              setFormData({
                cliente: '',
                codiceFiscale: '',
                patente: '',
                veicolo: '',
                targa: '',
                dataInizio: selectedDate,
                dataFine: selectedDate,
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
},
              });
              setEditingIndex(null);
              setIsAddingNewBooking(true);
            }}>Nuova Prenotazione</button>
  
          </div>
        ) : (
          <div>
            <p>Nessuna prenotazione per questa data.</p>
            <button onClick={() => {
              setFormData({
                cliente: '',
                codiceFiscale: '',
                patente: '',
                veicolo: '',
                targa: '',
                dataInizio: selectedDate,
                dataFine: selectedDate,
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
},
              });
              setEditingIndex(null);
              setIsAddingNewBooking(true);
            }}>Aggiungi</button>
  
          </div>
        )}
      </div>
    )}
  </BookingModal>
  
  
    <div className="bookings-table-tools">
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
        className="bulk-complete-btn"
        onClick={concludiPrenotazioniScadute}
        disabled={prenotazioniDaConcludereOggi.length === 0}
      >
        Concludi i noleggi finiti
      </button>
    </div>

    <div className={`table-responsive ${ricercaAttiva ? 'table-responsive-filtered' : ''}`} ref={listaRef}>
      <table className="booking-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Email Cliente</th>
            <th>Veicolo</th>
            <th>Targa</th>
            <th>Inizio</th>
            <th>Fine</th>
            <th>Prezzo (€)</th>
            <th>Stato</th>
            <th>Promemoria</th>
            <th>Azioni</th>            
          </tr>
        </thead>
        <tbody>
          
  {prenotazioniAttiveFiltrate.length === 0 ? (
    <tr>
      <td colSpan="10" style={{ textAlign: 'center', fontStyle: 'italic', color: '#888' }}>
        Nessuna prenotazione trovata.
      </td>
    </tr>
  ) : (
    prenotazioniAttiveFiltrate
      .slice((paginaPrenotazioni - 1) * righePerPagina, paginaPrenotazioni * righePerPagina)
      .map((p) => {
              const fase = faseLavoro(p, oggi);
              const nota = promemoria(p, oggi);
              const classeRiga = nota.livello ? `riga-scadenza-${nota.livello}` : '';
              return (
              <tr key={p.id} className={classeRiga}>
                <td>{p.cliente}</td>
                <td>{p.emailCliente}</td>
                <td>{p.veicolo}</td>
                <td>{p.targa}</td>
                <td>{p.dataInizio}</td>
                <td>{p.dataFine}</td>
                <td>{prezzoPrenotazione(p) || '—'}</td>
                <td>
                  <span className={`fase-badge fase-badge--${fase}`}>
                    {daAssegnare(p) ? 'Veicolo da assegnare' : ETICHETTA_FASE[fase]}
                  </span>
                </td>
                <td>
                  <span className={`deadline-badge ${classeRiga}`}>{nota.testo}</span>
                </td>
                <td className="table-actions-cell">
                   <button className="info-btn" onClick={() => openInfoModal(p)} aria-label="Dettagli"><Info size={18} /></button>
                   {puoConsegnare(p) && (
                   <button className="table-consegna-btn" onClick={() => avviaConsegna(p)}>
                     <KeyRound size={16} />
                     Consegna
                   </button>
                   )}
                   {puoConcludere(p) && (
                   <button
                     className="table-conclude-btn"
                     onClick={() => {
                       setInfoModalOpen(false);
                       setModalIsOpen(false);
                       setPrenotazioneDaConcludere(p);
                       setConcludiModalOpen(true);
                     }}
                   >
                     <CheckCircle size={16} />
                     Concludi
                   </button>
                   )}
                </td>
              </tr>
              );
            })
          )}
        </tbody>
      </table>
      <div className="pagination">
  {[...Array(numeroPagine)].map((_, i) => (
    <button
      key={i}
      className={paginaPrenotazioni === i + 1 ? 'active' : ''}
      onClick={() => setPaginaPrenotazioni(i + 1)}
    >
      {i + 1}
    </button>
  ))}
</div>
    </div>
  
    {/* Modal info dettagliato */}
   <InfoModal
    isOpen={infoModalOpen}
    onClose={closeInfoModal}
    prenotazione={dettagliPrenotazione}
    onModifica={(p) => {
      const index = prenotazioni.findIndex(item => item.id === p.id);
      const giorni = calcGiorni(p.dataInizio, p.dataFine);
      setFormData({ ...p, prezzoTotale: giorni * parseFloat(p.prezzoGiornaliero || 0) });
      setSchedaVeicolo(p.schedaVeicolo || {
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
},
      });
      setEditingIndex(index);
      setIsAddingNewBooking(true);
      setModalIsOpen(true);
      setInfoModalOpen(false);
    }}
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
