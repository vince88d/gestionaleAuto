import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Info, Trash2, Recycle } from 'lucide-react';
import { ricaricaPrenotazioni } from '../utils/ricaricaPrenotazioni';
import { aggiornaPrenotazione, eliminaPrenotazione, messaggioErrorePrenotazione } from '../lib/firestorePrenotazioni';
import { readClienti, togliDanniPrenotazioneCliente } from '../lib/firestoreClienti';
import { toast } from 'react-toastify';
import InfoModal from '../components/InfoModal';
import ConfirmDialog from '../components/ConfirmDialog';
import '../styles/ArchivioPrenotazioni.css';

function ArchivioPrenotazioni() {
  const dispatch = useDispatch();
  const prenotazioni = useSelector((state) => state.prenotazioni);
  const [search, setSearch] = useState('');
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [dettagliPrenotazione, setDettagliPrenotazione] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paginaPrenotazioni, setPaginaPrenotazioni] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState(null);

  const prenotazioniCompletate = prenotazioni.filter((prenotazione) => prenotazione.status === 'completata');
  const prenotazioniFiltrate = prenotazioniCompletate.filter((prenotazione) => {
    const query = search.toLowerCase().trim();
    return (
      prenotazione.cliente.toLowerCase().includes(query) ||
      prenotazione.targa.toLowerCase().includes(query) ||
      prenotazione.veicolo.toLowerCase().includes(query)
    );
  });

  const righePerPaginaPrenotazioni = 10;
  const startIndexPren = (paginaPrenotazioni - 1) * righePerPaginaPrenotazioni;
  const endIndexPren = startIndexPren + righePerPaginaPrenotazioni;
  const prenotazioniDaMostrare = prenotazioniFiltrate.slice(startIndexPren, endIndexPren);
  const numeroPaginePren = Math.ceil(prenotazioniFiltrate.length / righePerPaginaPrenotazioni);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        await ricaricaPrenotazioni(dispatch);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [dispatch]);

  useEffect(() => {
    setPaginaPrenotazioni(1);
  }, [search]);

  const openInfoModal = (prenotazione) => {
    setDettagliPrenotazione(prenotazione);
    setInfoModalOpen(true);
  };

  const closeInfoModal = () => {
    setDettagliPrenotazione(null);
    setInfoModalOpen(false);
  };

  // Ripristina un noleggio concluso: aggiorna solo quella prenotazione e lo
  // storico danni del suo cliente (prima si riscrivevano tutte le prenotazioni,
  // cancellando anche quelle arrivate dal sito nel frattempo, e tutti i clienti).
  const handleRestore = async (id) => {
    const prenotazioneRipristinata = prenotazioni.find((prenotazione) => prenotazione.id === id);
    if (!prenotazioneRipristinata) return;
    try {
      await aggiornaPrenotazione(
        id,
        { status: 'attiva', danniFinali: '', fotoDanni: null, daRiparare: false },
        { statoAtteso: 'completata' }
      );

      const clienti = await readClienti();
      const cliente = clienti.find((c) => c.codiceFiscale && c.codiceFiscale === prenotazioneRipristinata.codiceFiscale);
      if (cliente) {
        // Solo le voci di questa prenotazione (prima si riscriveva tutto il cliente).
        await togliDanniPrenotazioneCliente(cliente.id, prenotazioneRipristinata.id);
      }
      await ricaricaPrenotazioni(dispatch);
    } catch (error) {
      console.error('Errore ripristino prenotazione:', error);
      toast.error(messaggioErrorePrenotazione(error, 'Errore durante il ripristino.'));
    }
  };

  const executeConfirmedAction = () => {
    if (actionToConfirm) {
      actionToConfirm.action(actionToConfirm.payload);
    }
    setConfirmOpen(false);
    setActionToConfirm(null);
  };

  const handleDelete = (id) => {
    setActionToConfirm({
      message: 'Sei sicuro di voler eliminare definitivamente questa prenotazione archiviata?',
      action: confermaEliminazionePrenotazione,
      payload: id,
    });
    setConfirmOpen(true);
  };

  // Elimina solo quel documento (prima si riscriveva tutta la collezione).
  const confermaEliminazionePrenotazione = async (id) => {
    try {
      await eliminaPrenotazione(id);
      await ricaricaPrenotazioni(dispatch);
    } catch (error) {
      console.error('Errore eliminazione prenotazione:', error);
      toast.error("Errore nell'eliminazione.");
    }
  };


  return (
    <div className="archivio-container">
      <h1>Archivio Prenotazioni Completate</h1>

      <div className="archivio-header">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Cerca per cliente, targa o veicolo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input-enhanced"
          />
        </div>
      </div>

      <div className="table-tabs-wrapper">
        <div className="table-responsive">
          {isLoading ? (
            <p>Caricamento archivio in corso...</p>
          ) : (
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
                {prenotazioniDaMostrare.map((prenotazione) => (
                  <tr key={prenotazione.id}>
                    <td>{prenotazione.cliente}</td>
                    <td>{prenotazione.emailCliente}</td>
                    <td>{prenotazione.veicolo}</td>
                    <td>{prenotazione.targa}</td>
                    <td>{prenotazione.dataInizio}</td>
                    <td>{prenotazione.dataFine}</td>
                    <td>{prenotazione.prezzoTotale}</td>
                    <td className="archivio-actions-cell">
                      <button
                        className="info-btn"
                        onClick={() => openInfoModal(prenotazione)}
                        title="Dettagli"
                      >
                        <Info size={18} />
                      </button>
                      <button
                        className="restore-btn"
                        onClick={() => handleRestore(prenotazione.id)}
                        title="Ripristina"
                      >
                        <Recycle size={18} color="#4caf50" />
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(prenotazione.id)}
                        title="Elimina"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="pagination">
            {[...Array(numeroPaginePren)].map((_, i) => (
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
      </div>

      <InfoModal
        isOpen={infoModalOpen}
        onClose={closeInfoModal}
        prenotazione={dettagliPrenotazione}
        soloLettura={true}
      />

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => {
          setConfirmOpen(false);
          setActionToConfirm(null);
        }}
        onConfirm={executeConfirmedAction}
        message={actionToConfirm ? actionToConfirm.message : ''}
      />
    </div>
  );
}

export default ArchivioPrenotazioni;
