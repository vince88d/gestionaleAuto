import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setPrenotazioni } from '../store/prenotazioniSlice';
import { Info } from 'lucide-react';
import InfoModal from '../components/InfoModal';


function ArchivioPrenotazioni() {
  const dispatch = useDispatch();
  const prenotazioni = useSelector(state => state.prenotazioni);
  const [search, setSearch] = useState('');
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [dettagliPrenotazione, setDettagliPrenotazione] = useState(null);

  const prenotazioniCompletate = prenotazioni.filter(p => p.status === 'completata');

  const prenotazioniFiltrate = prenotazioniCompletate.filter(p => {
    const query = search.toLowerCase().trim();
    return (
      p.cliente.toLowerCase().includes(query) ||
      p.targa.toLowerCase().includes(query) ||
      p.veicolo.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    const caricaPrenotazioni = async () => {
      try {
        const dati = await window.electronAPI.readPrenotazioni();
        dispatch(setPrenotazioni(dati));
      } catch (error) {
        console.error("Errore nel caricamento dell'archivio:", error);
      }
    };

    caricaPrenotazioni();
  }, [dispatch]);

  const openInfoModal = (prenotazione) => {
    setDettagliPrenotazione(prenotazione);
    setInfoModalOpen(true);
  };

  const closeInfoModal = () => {
    setDettagliPrenotazione(null);
    setInfoModalOpen(false);
  };
  const handleRestore = async (id) => {
    const updatedList = prenotazioni.map(p =>
      p.id === id ? { ...p, status: 'attiva' } : p
    );
    dispatch(setPrenotazioni(updatedList));
    await window.electronAPI.writePrenotazioni(updatedList);
  };
  
  const handleDelete = async (id) => {
    const updatedList = prenotazioni.filter(p => p.id !== id);
    dispatch(setPrenotazioni(updatedList));
    await window.electronAPI.writePrenotazioni(updatedList);
  };
  

  return (
    <div className="archivio-container">
      <h1>Archivio Prenotazioni Completate</h1>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Cerca per cliente, targa o veicolo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input-enhanced"
        />
      </div>

      <div className="table-responsive">
        <table className="booking-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Email</th>
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
  <button
    className="info-btn"
    onClick={() => openInfoModal(p)}
    title="Dettagli"
  >
    <Info size={18} />
  </button>
  <button
    className="restore-btn"
    onClick={() => handleRestore(p.id)}
    title="Ripristina"
  >
    ♻️
  </button>
  <button
    className="delete-btn"
    onClick={() => handleDelete(p.id)}
    title="Elimina"
  >
    🗑️
  </button>
</td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InfoModal
        isOpen={infoModalOpen}
        onClose={closeInfoModal}
        prenotazione={dettagliPrenotazione}
      />
    </div>
  );
}

export default ArchivioPrenotazioni;
