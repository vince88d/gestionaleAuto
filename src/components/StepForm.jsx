import React, { useState, useEffect } from 'react';
import '../pages/Booking.css';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import StepForm from '../components/StepForm';
import { Search, Info } from 'lucide-react';
import Modal from 'react-modal';
Modal.setAppElement('#root');

function Bookings() {
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [dettagliPrenotazione, setDettagliPrenotazione] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [prenotazioniGiorno, setPrenotazioniGiorno] = useState([]);
  const [isAddingNewBooking, setIsAddingNewBooking] = useState(false);
  const [search, setSearch] = useState('');

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
  });

  const [schedaVeicolo, setSchedaVeicolo] = useState({
    carburante: '',
    kmIniziali: '',
    danni: '',
    accessori: {
      cric: false,
      triangolo: false,
      giubbotto: false,
    },
  });

  useEffect(() => {
    const stored = localStorage.getItem('prenotazioni');
    if (stored) setPrenotazioni(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem('prenotazioni', JSON.stringify(prenotazioni));
  }, [prenotazioni]);

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
      prezzoTotale: ''
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

    const csvContent = [header, ...rows]
      .map(e => e.map(v => `"${v}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "prenotazioni.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    const conferma = window.confirm("Sei sicuro di voler eliminare questa prenotazione?");
    if (!conferma) return;
    const updated = prenotazioni.filter((_, i) => i !== index);
    setPrenotazioni(updated);
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
    const query = search.toLowerCase();
    return (
      p.cliente.toLowerCase().includes(query) ||
      p.targa.toLowerCase().includes(query) ||
      p.veicolo.toLowerCase().includes(query)
    );
  });

  return (
    <div className="bookings-container"> 
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

      {isAddingNewBooking && (
        <StepForm
          formData={formData}
          setFormData={setFormData}
          schedaVeicolo={schedaVeicolo}
          setSchedaVeicolo={setSchedaVeicolo}
          onConferma={(datiFinali) => {
            if (editingIndex !== null) {
              const updated = [...prenotazioni];
              updated[editingIndex] = datiFinali;
              setPrenotazioni(updated);
              setEditingIndex(null);
            } else {
              setPrenotazioni([...prenotazioni, datiFinali]);
            }
            setIsAddingNewBooking(false);
            resetModal();
          }}
        />
      )}

      <div className="table-responsive">
        <table className="booking-table">
          <thead>
            <tr>
              <th>Cliente</th>
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
                <td>{p.veicolo}</td>
                <td>{p.targa}</td>
                <td>{p.dataInizio}</td>
                <td>{p.dataFine}</td>
                <td>{p.prezzoTotale}</td>
                <td>
                  <button className="edit-btn" onClick={() => {
                    const giorni = calcGiorni(p.dataInizio, p.dataFine);
                    setFormData({ ...p, prezzoTotale: giorni * parseFloat(p.prezzoGiornaliero || 0) });
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

      <Modal
        isOpen={infoModalOpen}
        onRequestClose={closeInfoModal}
      className={{
    base: 'Modal',
    afterOpen: 'Modal--after-open',
    beforeClose: 'Modal--before-close',
  }}
  overlayClassName={{
    base: 'Overlay',
    afterOpen: 'Overlay--after-open',
    beforeClose: 'Overlay--before-close',
  }}
      >
        <button onClick={closeInfoModal} style={{ float: 'right', border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
        {dettagliPrenotazione && (
          <div className="booking-info-full">
            <h2>Dettagli Prenotazione</h2>
            <p><strong>Cliente:</strong> {dettagliPrenotazione.cliente}</p>
            <p><strong>Codice Fiscale:</strong> {dettagliPrenotazione.codiceFiscale}</p>
            <p><strong>Patente:</strong> {dettagliPrenotazione.patente}</p>
            <p><strong>Veicolo:</strong> {dettagliPrenotazione.veicolo}</p>
            <p><strong>Targa:</strong> {dettagliPrenotazione.targa}</p>
            <p><strong>Dal:</strong> {dettagliPrenotazione.dataInizio}</p>
            <p><strong>Al:</strong> {dettagliPrenotazione.dataFine}</p>
            <p><strong>Prezzo al giorno:</strong> {dettagliPrenotazione.prezzoGiornaliero} €</p>
            <p><strong>Totale:</strong> {dettagliPrenotazione.prezzoTotale} €</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Bookings;