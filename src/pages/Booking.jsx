import React, { useState, useEffect } from 'react';
import './Booking.css';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import BookingForm from '../components/BookingForm';
import SchedaVeicoloModal from '../components/SchedaModalOpen';
import RiepilogoPrenotazioneModal from '../components/RiepilogoPrenotazioneModal';
import InfoModal from '../components/InfoModal';
import {toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ConfirmDialog from '../components/ConfirmDialog';

import { Search, Info, CheckCircle, AlertCircle } from 'lucide-react';
import BookingModal from '../components/BookingModal';
import "../components/BookingForm.css";
import { useDispatch,useSelector } from 'react-redux';
import{
  setPrenotazioni,
  addPrenotazione,
  updatePrenotazione,
  deletePrenotazione,
} from '../store/prenotazioniSlice';







function Bookings() {
  const prenotazioni = useSelector((state) => state.prenotazioni);
  const prenotazioniAttive = prenotazioni.filter(p => p.status !== 'completata');
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
  const [availableVehiclesForBooking, setAvailableVehiclesForBooking] = useState([]);
  const [forceRenderKey, setForceRenderKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
const [deleteIndex, setDeleteIndex] = useState(null);


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
    const caricaPrenotazioni = async () => {
      setLoading(true);
      try {
        const dati = await window.electronAPI.readPrenotazioni();
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
        const datiVeicoli = await window.electronAPI.readVeicoli();
        
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


  const getAvailableVehiclesForDate = (date, currentTarga = null, isNewBooking = true) => {
    if (!date) {
     console.log('Nessuna data fornita per il filtro dei veicoli.');
     return [];
    }
  
    return availableVehicles.filter(vehicle => {
      const isAlreadyBooked = prenotazioni.some(prenotazione => {
        if (prenotazione.targa !== vehicle.targa) return false;
      
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


  const resetModal = () => {
    console.log('Reset modal chiamato');
    setModalIsOpen(false);
    setSchedaModalOpen(false);
    setRiepilogoOpen(false);
  
    setTimeout(() => {
      const root = document.getElementById('root');
      if (root) root.removeAttribute('aria-hidden');
      console.log('aria-hidden rimosso:', root.getAttribute('aria-hidden'));
  
      // Sposta il focus su un elemento visibile
      const focusableElement = document.querySelector('.search-input-enhanced');
      if (focusableElement) {
        focusableElement.focus();
        console.log('Focus spostato su:', focusableElement);
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
      accessori: { cric: false, triangolo: false, giubbotto: false },
    });
  };

  
  const exportToCSV = () => {
    const header = [
      "Cliente", "Codice Fiscale", "Patente", "Veicolo", "Targa",
      "Data Inizio", "Data Fine", "Prezzo Giornaliero", "Prezzo Totale"
    ];
    const rows = prenotazioni.map(p => [
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

  setFormData({ ...data, codiceFiscale: codiceFiscaleUpper, prezzoTotale: totale });

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
      accessori: { cric: false, triangolo: false, giubbotto: false },
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
     setSchedaVeicolo({ carburante: '', kmIniziali: '', danni: '', accessori: { cric: false, triangolo: false, giubbotto: false } });
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

  const confermaEliminazione = async () => {
    const index = deleteIndex;
    if (index === null) return;
    setConfirmOpen(false);
  
    try {
      const nuovaLista = [...prenotazioni];
      const [prenotazioneEliminata] = nuovaLista.splice(index, 1);
      dispatch(deletePrenotazione(prenotazioneEliminata.id));
      await window.electronAPI.writePrenotazioni(nuovaLista);
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
  
      await window.electronAPI.writePrenotazioni(prenotazioniAggiornate);
      setSelectedDate(prev => prev);

    } catch (error) {
      console.error("Errore nel salvataggio:", error);
      showFeedback("Errore durante il salvataggio", "error");
      return;
    } finally {
      setLoading(false);
    }
  
    inviaEmailPrenotazioneIPC(nuovaPrenotazione);
  
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
  
  
 // Funzione per inviare email tramite IPC al Main Process
 const inviaEmailPrenotazioneIPC = (prenotazione) => {
  const azienda = JSON.parse(localStorage.getItem('datiAzienda')) || {};

  if (window.electronAPI?.sendBookingEmail) {
    window.electronAPI.sendBookingEmail({
      bookingData: prenotazione,
      companyData: azienda,
    });
  }
  


  console.log('Richiesta invio email inviata al main process.');
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
  await window.electronAPI.writePrenotazioni(nuovePrenotazioni);
  dispatch(setPrenotazioni(nuovePrenotazioni));
  showFeedback("Prenotazione conclusa", "success");
  

// Allineo la data selezionata per forzare il recalcolo
if (!selectedDate || selectedDate !== prenotazione.dataInizio) {
  setSelectedDate(prenotazione.dataInizio);
}

// Ricalcola la disponibilità dopo la modifica
const nuovaDisponibilità = getAvailableVehiclesForDate(
  prenotazione.dataInizio, // usa direttamente la data coerente
  formData?.targa,
  isAddingNewBooking
);
setAvailableVehiclesForBooking(nuovaDisponibilità);
  
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

return (
  <div className="bookings-container">
  {feedbackMessage && (
      <div className={`feedback ${feedbackType}`}>
        {feedbackType === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
        <span>{feedbackMessage}</span>
      </div>
    )}
  <h1 className="title">Gestione Prenotazioni</h1>
  
  <div className="search-bar">
      <Search className="search-icon" />
      <input
        type="text"
        placeholder="Cerca per cliente, targa o veicolo..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-input-enhanced"
      />
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
    <button onClick={exportToCSV} className="export-btn">📁 Esporta CSV</button>
  </div>
    <h2 className="subtitle">Calendario Prenotazioni</h2>
  
    <div className="calendar-wrapper">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
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
      />
    </div>
  
    <BookingModal key={forceRenderKey} open={modalIsOpen} onClose={resetModal}>
    {isAddingNewBooking ? (
      <div>
        <h2>{editingIndex !== null ? 'Modifica Prenotazione' : 'Aggiungi Prenotazione'}</h2>
        <BookingForm
          onSubmit={handleBookingSubmit}
          initialValues={formData}
          availableVehicles={availableVehiclesForBooking}
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
                      className="edit-btn"
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
                          }
                        });
                        const globalIndex = prenotazioni.findIndex(p => p === prenotazione);
                        setEditingIndex(globalIndex);
                        setIsAddingNewBooking(true);
                        setSelectedDate(prenotazione.dataInizio);
                        setModalIsOpen(true);
                      }}
                    >
                      Modifica
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(prenotazioni.findIndex(p => p === prenotazione))}
                    >
                      Elimina
                    </button>
                    <button
                      className="complete-btn"
                      onClick={() => segnaComeCompletata(prenotazioni.findIndex(p => p === prenotazione))}
                    >
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
                accessori: { cric: false, triangolo: false, giubbotto: false },
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
                accessori: { cric: false, triangolo: false, giubbotto: false },
              });
              setEditingIndex(null);
              setIsAddingNewBooking(true);
            }}>Aggiungi</button>
  
          </div>
        )}
      </div>
    )}
  </BookingModal>
  
  
    <div className="table-responsive">
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
            <th>Termina tra</th>
            <th>Azioni</th>            
          </tr>
        </thead>
        <tbody>
          {prenotazioniAttive
            .filter(p =>
              p.cliente.toLowerCase().includes(search.toLowerCase()) ||
              p.targa.toLowerCase().includes(search.toLowerCase()) ||
              p.veicolo.toLowerCase().includes(search.toLowerCase())
            )
            .map((p, index) => (
              <tr key={index} className={
                p.dataFine === new Date().toISOString().split('T')[0]
                  ? 'riga-scadenza-oggi'
                  : p.dataFine === new Date(Date.now() + 86400000).toISOString().split('T')[0]
                  ? 'riga-scadenza-domani'
                  : ''
              }>
                <td>{p.cliente}</td>
                <td>{p.emailCliente}</td>
                <td>{p.veicolo}</td>
                <td>{p.targa}</td>
                <td>{p.dataInizio}</td>
                <td>{p.dataFine}</td>
                <td>{p.prezzoTotale}</td>
                <td>{calcGiorni(new Date(), p.dataFine)} giorni</td>
                <td>
                   <button className="info-btn" onClick={() => openInfoModal(p)}><Info size={18} /></button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
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
        accessori: { cric: false, triangolo: false, giubbotto: false },
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
      segnaComeCompletata(index);
      setInfoModalOpen(false);
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
    onClose={() => setRiepilogoOpen(false)}
    formData={formData}
    schedaVeicolo={schedaVeicolo}
    onConferma={confermaPrenotazione}
  />
  
  <ConfirmDialog
    open={confirmOpen}
    onCancel={() => setConfirmOpen(false)}
    onConfirm={confermaEliminazione}
    message="Sei sicuro di voler eliminare questa prenotazione?"
  />
  
  </div>
  
  );
}


export default Bookings;