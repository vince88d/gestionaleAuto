import React, { useState, useEffect } from 'react';
import './Booking.css';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import BookingForm from '../components/BookingForm';
import SchedaVeicoloModal from '../components/SchedaModalOpen';
import RiepilogoPrenotazioneModal from '../components/RiepilogoPrenotazioneModal';
import InfoModal from '../components/InfoModal';
import { ToastContainer,toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { Search, Info, CheckCircle, AlertCircle } from 'lucide-react';
import Modal from 'react-modal';
import "../components/BookingForm.css";
import { useDispatch,useSelector } from 'react-redux';
import{
  setPrenotazioni,
  addPrenotazione,
  updatePrenotazione,
  deletePrenotazione,
} from '../store/prenotazioniSlice';
Modal.setAppElement('#root');



function Bookings() {
  const prenotazioni = useSelector((state) => state.prenotazioni);
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
        dispatch(setPrenotazioni(dati));
      } catch (error) {
        console.error("Errore lettura locale:", error);
      } finally {
        setLoading(false);
      }
    };
  
    caricaPrenotazioni();
  }, []);
  


  const showFeedback = (message, type = 'success') => {
    if (type === 'success') {
      toast.success(message);
    } else {
      toast.error(message);
    }
  };

  const resetModal = () => {
    setModalIsOpen(false);
    setIsAddingNewBooking(false);
    setEditingIndex(null);
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
      emailCliente:'',
    });
    setSchedaVeicolo( {
      carburante: '',
      kmIniziali: '',
      danni: '',
      accessori: {
        cric: false,
        triangolo: false,
        giubbotto: false,
      },
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
  const handleDelete = async (index) => {
    const conferma = window.confirm("Sei sicuro di voler eliminare questa prenotazione?");
    if (!conferma) return;
  
    try {
      const nuovaLista = prenotazioni.filter((_, i) => i !== index);
      dispatch(deletePrenotazione(prenotazioni[index].id));
      await window.electronAPI.writePrenotazioni(nuovaLista);
      showFeedback("Prenotazione eliminata con successo.", "success");
    } catch (error) {
      console.error("Errore durante eliminazione:", error);
      showFeedback("Errore nell'eliminazione", "error");
    }
  };
  

  const handleBookingSubmit = (data) => {
    const giorni = calcGiorni(data.dataInizio, data.dataFine);
    const totale = giorni * parseFloat(data.prezzoGiornaliero || 0);
  
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
  
    setFormData({ ...data, prezzoTotale: totale });
  
    setModalIsOpen(false);        // Chiudo il primo modal
    setSchedaModalOpen(true);     // Apro la scheda veicolo
  };
  

  const groupPrenotazioniByDate = () => {
    const dateMap = {};
    prenotazioni.forEach((p) => {
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
    return Object.entries(dateMap).map(([date, data]) => ({
      title: ` ${data.count}`,
      date,
      extendedProps: { bookings: data.bookings, count: data.count },
      className: 'booking-dot-event',
    }));
  };

  const handleDateClick = (arg) => {
    const dateStr = arg.dateStr;
    const prenotazioniDelGiorno = prenotazioni.filter(
      (p) =>
        new Date(p.dataInizio).toISOString().split('T')[0] <= dateStr &&
        new Date(p.dataFine).toISOString().split('T')[0] >= dateStr
    );
    setSelectedDate(dateStr);
    if (prenotazioniDelGiorno.length > 0) {
      setPrenotazioniGiorno(prenotazioniDelGiorno);
      setIsAddingNewBooking(false);
    } else {
      setPrenotazioniGiorno([]);
      setIsAddingNewBooking(true);
    }
    setModalIsOpen(true);
  };

  const handleEventClick = (info) => {
    setSelectedDate(info.event.startStr);
    setPrenotazioniGiorno(info.event.extendedProps.bookings);
    setIsAddingNewBooking(false);
    setModalIsOpen(true);
  };

  const prenotazioniFiltrate = prenotazioni.filter((p) => {
    const query = search.toLowerCase().trim();
    return (
      p.cliente.toLowerCase().includes(query) ||
      p.targa.toLowerCase().includes(query) ||
      p.veicolo.toLowerCase().includes(query)
    );
  });

  


  const handleSaveSchedaVeicolo = () => {
    setFormData(prev => ({
      ...prev,
      schedaVeicolo: schedaVeicolo
    }));
    setSchedaModalOpen(false);
    setRiepilogoOpen(true);
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
        
        const aggiornata = { ...nuovaPrenotazione, id };
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
        };
        
        prenotazioniAggiornate = [...prenotazioni, nuovaConId];
        dispatch(addPrenotazione(nuovaConId));
        showFeedback("Prenotazione aggiunta con successo", "success");
      }
  
      await window.electronAPI.writePrenotazioni(prenotazioniAggiornate);
  
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

  <Modal
    isOpen={modalIsOpen}
onRequestClose={resetModal}
  className="calendar-modal"
    overlayClassName="calendar-overlay"
  >
    <button onClick={resetModal} style={{ float: 'right', border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
    {isAddingNewBooking ? (
      <div>
        <h2>{editingIndex !== null ? 'Modifica Prenotazione' : 'Aggiungi Prenotazione'}</h2> {/* Aggiorna il titolo */}
        
        <BookingForm onSubmit={handleBookingSubmit} initialValues = {formData} />

        
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
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setIsAddingNewBooking(true)}>Aggiungi</button>
          </div>
        ) : (
          <div>
            <p>Nessuna prenotazione per questa data.</p>
            <button onClick={() => setIsAddingNewBooking(true)}>Aggiungi</button>
          </div>
        )}
        
      </div>
    )}
  </Modal>
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
          <th>Azioni</th>
        </tr>
      </thead>
      <tbody>
        {prenotazioniFiltrate.map((p, index) => (
          <tr key={index}>
            <td>{p.cliente}</td>
            <td>{p.emailCliente}</td>
            <td>{p.veicolo}</td>
            <td>{p.targa}</td>
            <td>{p.dataInizio}</td>
            <td>{p.dataFine}</td>
            <td>{p.prezzoTotale}</td>
            <td>
            <button className="edit-btn" onClick={() => {
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
    }
  });
  setEditingIndex(index);
  setIsAddingNewBooking(true);
  setModalIsOpen(true);
}}>Modifica</button>

              <button className="delete-btn" onClick={() => handleDelete(index)}>Elimina</button>
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

</div>    
);
}

export default Bookings;