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
import { Search, Info, CheckCircle, AlertCircle, Edit3, Trash2 } from 'lucide-react';
import BookingModal from '../components/BookingModal';
import "../components/BookingForm.css";
import { useDispatch,useSelector } from 'react-redux';
import ConcludiPrenotazioneModal from '../components/ConcludiPrenotazioneModal';
import { useLocation } from 'react-router-dom';
import { readPrenotazioni, writePrenotazioni, isPrenotazioneVisibile } from '../lib/firestorePrenotazioni';
import { readVeicoli, writeVeicoli } from '../lib/firestoreVeicoli';
import { readHolds } from '../lib/firestoreHolds';
import { readClienti, writeClienti } from '../lib/firestoreClienti';
import{
  setPrenotazioni,
  addPrenotazione,
  updatePrenotazione,
  deletePrenotazione,
} from '../store/prenotazioniSlice';







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
  const clienti = useSelector((state) => state.clienti);
  const [concludiModalOpen, setConcludiModalOpen] = useState(false);
  const [prenotazioneDaConcludere, setPrenotazioneDaConcludere] = useState(null);
  const [paginaPrenotazioni, setPaginaPrenotazioni] = useState(1);
  const [paginaClienti, setPaginaClienti] = useState(1);
  const [filtroAttivo, setFiltroAttivo] = useState('');
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
}, [search]);


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
    schedaModalOpen ||
    riepilogoOpen ||
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
    if (!hasDraftBooking() && !schedaModalOpen && !riepilogoOpen) {
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

  const normalizzaData = (value) => {
    if (!value) return null;
    const data = new Date(value);
    if (Number.isNaN(data.getTime())) return null;
    data.setHours(0, 0, 0, 0);
    return data;
  };

  const getGiorniAllaScadenza = (dataFine) => {
    const fine = normalizzaData(dataFine);
    const oggi = normalizzaData(new Date());
    if (!fine || !oggi) return 0;
    return Math.round((fine - oggi) / (1000 * 60 * 60 * 24));
  };

  const getClasseScadenza = (dataFine) => {
    const giorni = getGiorniAllaScadenza(dataFine);
    if (giorni <= 0) return 'riga-scadenza-urgente';
    if (giorni === 1) return 'riga-scadenza-domani';
    if (giorni <= 2) return 'riga-scadenza-prossima';
    return '';
  };

  const getTestoScadenza = (dataFine) => {
    const giorni = getGiorniAllaScadenza(dataFine);
    if (giorni < 0) return `Scaduta da ${Math.abs(giorni)} gg`;
    if (giorni === 0) return 'Scade oggi';
    if (giorni === 1) return 'Scade domani';
    return `${giorni} giorni`;
  };

  const calcGiorni = (inizio, fine) => {
    const start = new Date(inizio);
    const end = new Date(fine);
    const diff = end - start;
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  };

  const openInfoModal = (prenotazione) => {
    setDettagliPrenotazione(prenotazione);
    setInfoModalOpen(true);
  };

  const closeInfoModal = () => {
    setDettagliPrenotazione(null);
    setInfoModalOpen(false);
  };

  const handleDelete = (index) => {
    setDeleteIndex(index);
    setConfirmOpen(true);
  };

  
  const handleBookingSubmit = (data) => {
  const giorni = calcGiorni(data.dataInizio, data.dataFine);
  const totale = giorni * parseFloat(data.prezzoGiornaliero || 0);

  const codiceFiscaleUpper = data.codiceFiscale?.toUpperCase() || '';

  const sovrapposta = prenotazioni.some((p, i) => {
    if (editingIndex !== null && i === editingIndex) return false;
    if (p.targa !== data.targa) return false;
    if (p.status === 'completata') return false; 

    const inizioA = new Date(p.dataInizio);
    const fineA = new Date(p.dataFine);
    const inizioB = new Date(data.dataInizio);
    const fineB = new Date(data.dataFine);

    return (
      (inizioB <= fineA && inizioB >= inizioA) ||
      (fineB >= inizioA && fineB <= fineA) ||
      (inizioB <= inizioA && fineB >= fineA)
    );
  });

  if (sovrapposta) {
    showFeedback("Prenotazione sovrapposta per la stessa targa.", "error");
    return;
  }

  const prenotazioneCorrente = editingIndex !== null ? prenotazioni[editingIndex] : null;

  setFormData({
    ...data,
    id: prenotazioneCorrente?.id,
    status: prenotazioneCorrente?.status || 'attiva',
    codiceFiscale: codiceFiscaleUpper,
    prezzoTotale: totale,
  });

  setModalIsOpen(false);
  setTimeout(() => {
    const root = document.getElementById('root');
    if (root) root.removeAttribute('aria-hidden');
  }, 50);
  setSchedaModalOpen(true);
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


  const handleSaveSchedaVeicolo = () => {
    setFormData(prev => ({
      ...prev,
      schedaVeicolo: schedaVeicolo
    }));
    setSchedaModalOpen(false);
    setRiepilogoOpen(true);
  };

  const handleConfermaPrenotazioneCompletata = async () => {
    try {
      const prenotazioniAggiornate = await readPrenotazioni();
      dispatch(setPrenotazioni(prenotazioniAggiornate));
      showFeedback(
        editingIndex !== null
          ? "Prenotazione modificata con successo"
          : "Prenotazione aggiunta con successo",
        "success"
      );
    } catch (error) {
      console.error("Errore aggiornamento stato prenotazioni:", error);
      showFeedback("Prenotazione confermata, ma non Ã¨ stato possibile aggiornare la vista.", "error");
    }

    setFormData({
      cliente: '',
      codiceFiscale: '',
      patente: '',
      veicolo: '',
      targa: '',
      dataInizio: '',
      dataFine: '',
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

    setEditingIndex(null);
    setModalIsOpen(false);
    setTimeout(() => {
      const root = document.getElementById('root');
      if (root) root.removeAttribute('aria-hidden');
    }, 50);
    setSchedaModalOpen(false);
    setRiepilogoOpen(false);
  };

  const confermaEliminazione = async () => {
    const index = deleteIndex;
    if (index === null) return;
    setConfirmOpen(false);
  
    try {
      const nuovaLista = [...prenotazioni];
      const [prenotazioneEliminata] = nuovaLista.splice(index, 1);
      dispatch(deletePrenotazione(prenotazioneEliminata.id));
      await writePrenotazioni(nuovaLista);
      dispatch(setPrenotazioni(nuovaLista));
      resetModal();
      showFeedback("Prenotazione eliminata con successo.", "success");
    } catch (error) {
      console.error("Errore durante eliminazione:", error);
      showFeedback("Errore nell'eliminazione", "error");
    } finally {
      setDeleteIndex(null);
    }
  };
  

  const confermaPrenotazione = async () => {
    const nuovaPrenotazione = {
      ...formData,
      schedaVeicolo: { ...schedaVeicolo },
    };
  
    let prenotazioniAggiornate = [];
  
    setLoading(true);
  
    try {
      if (editingIndex !== null) {
        // Modifica esistente
        const id = prenotazioni[editingIndex].id;
        if (!id) throw new Error("ID mancante");
        
        const aggiornata = { ...nuovaPrenotazione, id,  status: prenotazioni[editingIndex].status || 'attiva'  };
        prenotazioniAggiornate = prenotazioni.map((p, i) =>
          i === editingIndex ? aggiornata : p
        );
  
        dispatch(updatePrenotazione(aggiornata));
        showFeedback("Prenotazione modificata con successo", "success");
      } else {
        // Nuova prenotazione
        const nuovaConId = {
          ...nuovaPrenotazione,
          id: crypto.randomUUID(),
          status: 'attiva',
        };
        
        prenotazioniAggiornate = [...prenotazioni, nuovaConId];
        dispatch(addPrenotazione(nuovaConId));
        showFeedback("Prenotazione aggiunta con successo", "success");
      }
  
      await writePrenotazioni(prenotazioniAggiornate);
      setSelectedDate(prev => prev);

    } catch (error) {
      console.error("Errore nel salvataggio:", error);
      showFeedback("Errore durante il salvataggio", "error");
      return;
    } finally {
      setLoading(false);
    }
  
  
    // --- 🚀 Dopo il salvataggio:
    setFormData({
      cliente: '',
      codiceFiscale: '',
      patente: '',
      veicolo: '',
      targa: '',
      dataInizio: '',
      dataFine: '',
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
  
    setEditingIndex(null);
    setModalIsOpen(false);
    setTimeout(() => {
      const root = document.getElementById('root');
      if (root) root.removeAttribute('aria-hidden');
    }, 50);
    setSchedaModalOpen(false);
    setRiepilogoOpen(false);
  };
const handleBackToForm = () => {
  setSchedaModalOpen(false);
  setModalIsOpen(true);

};


const segnaComeCompletata = async (index) => {
  const prenotazione = prenotazioni[index];
  const now = new Date().toISOString();
  

  const aggiornata = { 
    ...prenotazione,
     status: 'completata',
    dataRientroEffettiva: now,
  };

  const nuovePrenotazioni = prenotazioni.map((p, i) =>
    i === index ? aggiornata : p
  );

  dispatch(updatePrenotazione(aggiornata));
  await writePrenotazioni(nuovePrenotazioni);
  dispatch(setPrenotazioni(nuovePrenotazioni));
  showFeedback("Prenotazione conclusa", "success");
  

 // Forza il ricalcolo della disponibilità
 const nuovaDisponibilità = getAvailableVehiclesForDate(
  prenotazione.dataInizio, // usa la data originale di inizio
  formData?.targa,
  true // forza il calcolo come nuova prenotazione
);

setAvailableVehiclesForBooking(nuovaDisponibilità);

// Se stavi visualizzando la data originale, forza il refresh
if (selectedDate === prenotazione.dataInizio) {
  setSelectedDate(null);
  setTimeout(() => setSelectedDate(prenotazione.dataInizio), 50);
}
};

const confermaConclusioneConDanni = async ({ descrizioneDanno, daRiparare, fotoDanni }) => {
  const now = new Date().toISOString();
  const prenotazione = prenotazioneDaConcludere;

  const aggiornata = {
    ...prenotazione,
    status: 'completata',
    dataRientroEffettiva: now,
    descrizioneDanno,
    daRiparare,
    fotoDanni: fotoDanni || null,
  };

  const nuovePrenotazioni = prenotazioni.map((p) =>
    p.id === aggiornata.id ? aggiornata : p
  );

  dispatch(updatePrenotazione(aggiornata));
  await writePrenotazioni(nuovePrenotazioni);
  dispatch(setPrenotazioni(nuovePrenotazioni));

  if (descrizioneDanno?.trim()) {
    const clienti = await readClienti();
    const idxCliente = clienti.findIndex(c =>
      c.codiceFiscale === prenotazione.codiceFiscale ||
      c.email === prenotazione.emailCliente
    );

    if (idxCliente !== -1) {
      clienti[idxCliente].storicoDanni = clienti[idxCliente].storicoDanni || [];
      clienti[idxCliente].storicoDanni.push({
        data: now,
        descrizioneDanno,
        veicolo: prenotazione.veicolo,
        targa: prenotazione.targa,
        riferimentoPrenotazione: prenotazione.id,
      });
      await writeClienti(clienti);
      dispatch(setClienti(clienti));
    }

if (daRiparare && prenotazione.targa) {
  const veicoli = await readVeicoli();
  const index = veicoli.findIndex(v => v.targa === prenotazione.targa);

  if (index !== -1) {
    const nuovoDanno = {
      descrizione: descrizioneDanno,
      data: now,
      daRiparare: true,
      riparato: false,
      foto: fotoDanni || [],
      riferimentoPrenotazione: prenotazione.id,
    };

    veicoli[index].danni = veicoli[index].danni || [];
    veicoli[index].danni.push(nuovoDanno);

    await writeVeicoli(veicoli);
    showFeedback("Danno salvato nel veicolo", "success");
  }
}
 }
  showFeedback("Prenotazione conclusa con esito registrato.");
  setConcludiModalOpen(false);
  setPrenotazioneDaConcludere(null);
};

const concludiPrenotazioniScadute = async () => {
  const daConcludere = prenotazioniAttive.filter((p) => getGiorniAllaScadenza(p.dataFine) <= 0);

  if (daConcludere.length === 0) {
    showFeedback("Non ci sono prenotazioni da concludere oggi.", "error");
    return;
  }

  const now = new Date().toISOString();
  const idsDaConcludere = new Set(daConcludere.map((p) => p.id));
  const nuovePrenotazioni = prenotazioni.map((p) =>
    idsDaConcludere.has(p.id)
      ? {
          ...p,
          status: 'completata',
          dataRientroEffettiva: now,
        }
      : p
  );

  try {
    dispatch(setPrenotazioni(nuovePrenotazioni));
    await writePrenotazioni(nuovePrenotazioni);
    showFeedback(`${daConcludere.length} prenotazioni concluse automaticamente.`, "success");
  } catch (error) {
    console.error("Errore conclusione multipla prenotazioni:", error);
    showFeedback("Errore durante la conclusione multipla.", "error");
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

const prenotazioniAttiveFiltrate = prenotazioniAttive.filter(p =>
  p.cliente.toLowerCase().includes(search.toLowerCase()) ||
  p.targa.toLowerCase().includes(search.toLowerCase()) ||
  p.veicolo.toLowerCase().includes(search.toLowerCase())||
  p.emailCliente.toLowerCase().includes(search.toLowerCase())
);
const ricercaAttiva = search.trim();
const prenotazioniDaConcludereOggi = prenotazioniAttive.filter((p) => getGiorniAllaScadenza(p.dataFine) <= 0);
const numeroPagine = Math.ceil(prenotazioniAttiveFiltrate.length / righePerPagina);


return (
  <div className="bookings-container">
  {feedbackMessage && (
      <div className={`feedback ${feedbackType}`}>
        {feedbackType === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
        <span>{feedbackMessage}</span>
      </div>
    )}
  <h1 className="title">Gestione Prenotazioni</h1>
  
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
                    <p><strong>Prezzo:</strong> {prenotazione.prezzoTotale} €</p>
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
      <div className="bookings-deadline-summary">
        <span className="deadline-chip deadline-chip-urgent">
          A 0 giorni: {prenotazioniDaConcludereOggi.length}
        </span>
        <span className="deadline-chip deadline-chip-soon">
          In scadenza: {prenotazioniAttive.filter((p) => {
            const giorni = getGiorniAllaScadenza(p.dataFine);
            return giorni === 1 || giorni === 2;
          }).length}
        </span>
      </div>
      <button
        type="button"
        className="bulk-complete-btn"
        onClick={concludiPrenotazioniScadute}
        disabled={prenotazioniDaConcludereOggi.length === 0}
      >
        Concludi tutte a 0 giorni
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
            <th>Scadenza</th>
            <th>Azioni</th>            
          </tr>
        </thead>
        <tbody>
          
  {prenotazioniAttiveFiltrate.length === 0 ? (
    <tr>
      <td colSpan="9" style={{ textAlign: 'center', fontStyle: 'italic', color: '#888' }}>
        Nessuna prenotazione trovata.
      </td>
    </tr>
  ) : (
    prenotazioniAttiveFiltrate
      .slice((paginaPrenotazioni - 1) * righePerPagina, paginaPrenotazioni * righePerPagina)
      .map((p, index) => (
              <tr key={index} className={getClasseScadenza(p.dataFine)}>
                <td>{p.cliente}</td>
                <td>{p.emailCliente}</td>
                <td>{p.veicolo}</td>
                <td>{p.targa}</td>
                <td>{p.dataInizio}</td>
                <td>{p.dataFine}</td>
                <td>{p.prezzoTotale}</td>
                <td>
                  <span className={`deadline-badge ${getClasseScadenza(p.dataFine)}`}>
                    {getTestoScadenza(p.dataFine)}
                  </span>
                </td>
                <td className="table-actions-cell">
                   <button className="info-btn" onClick={() => openInfoModal(p)}><Info size={18} /></button>
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
                </td>
              </tr>
            ))
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
    onConcludi={(p) => {
      const index = prenotazioni.findIndex(item => item.id === p.id);
      
     setInfoModalOpen(false);          
    setModalIsOpen(false);            
    setPrenotazioneDaConcludere(p);   
    setConcludiModalOpen(true);      
    setForceRenderKey(prev => prev + 1); 
    }}
      />
    <SchedaVeicoloModal
    isOpen={schedaModalOpen}
    onRequestClose={() => setSchedaModalOpen(false)}
    schedaVeicolo={schedaVeicolo}
    setSchedaVeicolo={setSchedaVeicolo}
    onSave={handleSaveSchedaVeicolo}
    onBack={handleBackToForm}
  />
  
  <RiepilogoPrenotazioneModal
    isOpen={riepilogoOpen}
    onClose={handleRequestCancelBooking}
    formData={formData}
    schedaVeicolo={formData.schedaVeicolo}
    onConferma={handleConfermaPrenotazioneCompletata}
  />
  
  <ConfirmDialog
    open={confirmOpen}
    onCancel={() => setConfirmOpen(false)}
    onConfirm={confermaEliminazione}
    message="Sei sicuro di voler eliminare questa prenotazione?"
    title="Elimina Prenotazione"
    confirmLabel="Elimina"
    tone="danger"
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
