import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setPrenotazioni } from '../store/prenotazioniSlice';
import { Info,Trash2, ShieldAlert } from 'lucide-react';
import { ricaricaPrenotazioni } from '../utils/ricaricaPrenotazioni';
import InfoModal from '../components/InfoModal';
import ConfirmDialog from '../components/ConfirmDialog';
import '../styles/ArchivioPrenotazioni.css';

function ArchivioPrenotazioni() {
  const dispatch = useDispatch();
  const prenotazioni = useSelector(state => state.prenotazioni);
  const [search, setSearch] = useState('');
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [dettagliPrenotazione, setDettagliPrenotazione] = useState(null);
  const [isLoading, setIsLoading] = useState(false); 
  const prenotazioniCompletate = prenotazioni.filter(p => p.status === 'completata');
  const [otpLogs, setOtpLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('prenotazioni');
  const [paginaOTP, setPaginaOTP] = useState(1);
  const [paginaPrenotazioni, setPaginaPrenotazioni] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState(null);


  const otpFiltrati = otpLogs.filter(log => {
  const query = search.toLowerCase().trim();
  return (
    log.cliente?.toLowerCase().includes(query) ||
    log.email?.toLowerCase().includes(query) ||
    log.codiceFiscale?.toLowerCase().includes(query) ||
    log.targa?.toLowerCase().includes(query)
  );
});
 const righePerPagina = 10;
const startIndex = (paginaOTP - 1) * righePerPagina;
const endIndex = startIndex + righePerPagina;
const logDaMostrare = otpFiltrati.slice(startIndex, endIndex);


const numeroPagine = Math.ceil(otpFiltrati.length / righePerPagina);

  const prenotazioniFiltrate = prenotazioniCompletate.filter(p => {
  const query = search.toLowerCase().trim();
    return (
      p.cliente.toLowerCase().includes(query) ||
      p.targa.toLowerCase().includes(query) ||
      p.veicolo.toLowerCase().includes(query)
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
    const fetchOtpLogs = async () => {
      const logs = await window.electronAPI.readOtpLogs();
      setOtpLogs(logs);
    };

    if (activeTab === 'otp') {
      fetchOtpLogs();
    }
  }, [activeTab, prenotazioni]);

  
useEffect(() => {
  setPaginaOTP(1);
  setPaginaPrenotazioni(1);
}, [search, activeTab]);


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
    p.id === id
      ? {
          ...p,
          status: 'attiva',
          danniFinali: '',             // cancella descrizione danni
          fotoDanni: null,             // cancella immagini
          daRiparare: false            // rimuove flag riparazione
        }
      : p
  );

  await window.electronAPI.writePrenotazioni(updatedList);
  
    // ✅ Carica i clienti
  const clienti = await window.electronAPI.readClienti();

  // ✅ Trova il cliente associato e svuota lo storicoDanni
  const prenotazioneRipristinata = prenotazioni.find(p => p.id === id);
 const clientiAggiornati = clienti.map(cliente => {
  if (cliente.codiceFiscale !== prenotazioneRipristinata.codiceFiscale) return cliente;

 const nuovoStorico = (cliente.storicoDanni || []).filter(danno =>
  danno.riferimentoPrenotazione !== prenotazioneRipristinata.id
);

  return {
    ...cliente,
    storicoDanni: nuovoStorico
  };
});

  await window.electronAPI.writeClienti(clientiAggiornati);
  await ricaricaPrenotazioni(dispatch);
};

  const executeConfirmedAction = () => {
    if (actionToConfirm) {
      actionToConfirm.action(actionToConfirm.payload); // Esegue l'azione salvata
    }
    setConfirmOpen(false);
    setActionToConfirm(null);
  };

  const handleDeleteOtpLog = (logTimestamp) => {
    setActionToConfirm({
      message: "Sei sicuro di voler eliminare questo log di conferma? L'azione è irreversibile.",
      action: confermaEliminazioneSingoloOtp, // La funzione che farà il lavoro
      payload: logTimestamp, // L'ID da passare alla funzione
    });
    setConfirmOpen(true);
  };

  const handleClearAllOtpLogs = () => {
    setActionToConfirm({
      message: "ATTENZIONE! Stai per eliminare l'intero archivio delle conferme OTP. Questa azione è definitiva e non può essere annullata. Continuare?",
      action: confermaSvuotaArchivioOtp,
      payload: null,
    });
    setConfirmOpen(true);
  };
  
  
  const handleDelete = (id) => {
    setActionToConfirm({
      message: "Sei sicuro di voler eliminare definitivamente questa prenotazione archiviata?",
      action: confermaEliminazionePrenotazione,
      payload: id,
    });
    setConfirmOpen(true);
  };

    const confermaEliminazioneSingoloOtp = async (logTimestamp) => {
    const result = await window.electronAPI.deleteSingleOtpLog(logTimestamp);
    if (result.success) {
      setOtpLogs(prevLogs => prevLogs.filter(log => log.confermatoIl !== logTimestamp));
    } else {
      alert(`Errore: ${result.message}`);
    }
  };

  const confermaSvuotaArchivioOtp = async () => {
    const result = await window.electronAPI.clearOtpLogs();
    if (result.success) {
      setOtpLogs([]);
    } else {
      alert(`Errore: ${result.message}`);
    }
  };

  const confermaEliminazionePrenotazione = async (id) => {
    const prenotazioneDaEliminare = prenotazioni.find(p => p.id === id);
    if (!prenotazioneDaEliminare) return;
    
    const logCorrispondente = otpLogs.find(log => 
      log.codiceFiscale === prenotazioneDaEliminare.codiceFiscale && 
      log.targa === prenotazioneDaEliminare.targa
    );

    if (logCorrispondente) {
      await window.electronAPI.deleteSingleOtpLog(logCorrispondente.confermatoIl);
    }

    const updatedList = prenotazioni.filter(p => p.id !== id);
    await window.electronAPI.writePrenotazioni(updatedList);
    await ricaricaPrenotazioni(dispatch);
  };

  return (
<div className="archivio-container">
  <h1>Archivio Prenotazioni Completate</h1>

  {/* HEADER STICKY */}
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
    <div className="tabs">
      <button onClick={() => setActiveTab('prenotazioni')} className={activeTab === 'prenotazioni' ? 'active' : ''}>Prenotazioni</button>
      <button onClick={() => setActiveTab('otp')} className={activeTab === 'otp' ? 'active' : ''}>Conferme OTP</button>
    </div>
  </div>

  <div className="table-tabs-wrapper">
{activeTab === 'prenotazioni' && (
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
            {prenotazioniDaMostrare.map((p, index) => (
              <tr key={p.id}>
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
)}
   

   {activeTab === 'otp' && (
        <div className="table-responsive">
            <div className="otp-actions-header">
                <h3>Archivio Conferme Clienti (OTP)</h3>
                <button className="clear-all-btn" onClick={handleClearAllOtpLogs} title="Elimina permanentemente tutti i log">
                  <ShieldAlert size={18} /> Svuota Archivio OTP
                </button>
            </div>
          <table className="booking-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Email</th>
                <th>Codice Fiscale</th>
                <th>Targa</th>
                <th>Periodo</th>
                <th>Prezzo</th>
                <th>Codice OTP</th>
                <th>Confermato il</th>
                <th>IP</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {logDaMostrare.map((log, index) => (
  <tr key={index}>
    <td>{log.cliente}</td>
    <td>{log.email}</td>
    <td>{log.codiceFiscale}</td>
    <td>{log.targa}</td>
    <td>{log.dataInizio} → {log.dataFine}</td>
    <td>{log.prezzoTotale} €</td>
    <td>{log.otpUsato}</td>
    <td>{new Date(log.confermatoIl).toLocaleString()}</td>
    <td>{log.ip}</td>
    <td>
    <button className="delete-btn-icon" onClick={() => handleDeleteOtpLog(log.confermatoIl)} title="Elimina questo log">
    <Trash2 size={18} />
    </button>                  
    </td>
  </tr>
              ))}
            </tbody>
          </table>
<div className="pagination">
  {[...Array(numeroPagine)].map((_, i) => (
    <button
      key={i}
      className={paginaOTP === i + 1 ? 'active' : ''}
      onClick={() => setPaginaOTP(i + 1)}
    >
      {i + 1}
    </button>
  ))}
</div>


        </div>
      )}
</div>
   <InfoModal
        isOpen={infoModalOpen}
        onClose={closeInfoModal}
        prenotazione={dettagliPrenotazione}
        soloLettura = {true}
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
