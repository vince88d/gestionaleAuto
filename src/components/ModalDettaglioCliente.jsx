// ModalDettaglioCliente.jsx
import React, { useState } from 'react';
import Modal from 'react-modal';
import { X } from 'lucide-react';
import StoricoNoleggiTable from './StoricoNoleggiTable';
import { useSelector } from 'react-redux';
import { isPrenotazioneVisibile } from '../lib/firestorePrenotazioni';
import '../styles/ModalDettaglioCliente.css';


function ModalDettaglioCliente({ show, onClose, cliente }) {
    const prenotazioni = useSelector((state) => state.prenotazioni || []);
    const [showAll, setShowAll] = useState(false);
    const [showAllDanni, setShowAllDanni] = useState(false);
    const [showAllNoleggi, setShowAllNoleggi] = useState(false);


    if (!cliente) return null;

    const storicoCliente = prenotazioni.filter(
      (p) => p.codiceFiscale?.toUpperCase() === cliente.codiceFiscale?.toUpperCase() && isPrenotazioneVisibile(p)
    );

  return (
    <Modal
  isOpen={show}
  onRequestClose={onClose}
  contentLabel="Dettaglio Cliente"
  className={{ base: 'Modal', afterOpen: 'Modal--after-open', beforeClose: 'Modal--before-close' }}
  overlayClassName="modal-overlay"
  
>
  <div className="modal-content">
    <div className="modal-header">
      <h2>Dettaglio Cliente</h2>
      <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
    </div>

    {/* Dati Cliente */}
    <div className="form-section">
      <h3>Dati Personali</h3>
      <p><strong>Nome:</strong> {cliente.nome}</p>
      <p><strong>Cognome:</strong> {cliente.cognome}</p>
      <p><strong>Codice Fiscale:</strong> {cliente.codiceFiscale}</p>
      <p><strong>Indirizzo:</strong> {cliente.indirizzo}</p>
      <p><strong>Luogo di nascita:</strong> {cliente.luogoNascita}</p>
      <p><strong>Data di nascita:</strong> {cliente.dataNascita}</p>
    </div>

    <div className="form-section">
      <h3>Contatti</h3>
      <p><strong>Email:</strong> {cliente.email}</p>
      <p><strong>Telefono:</strong> {cliente.telefono}</p>
      <p><strong>Cellulare:</strong> {cliente.cellulare}</p>
    </div>

    <div className="form-section">
      <h3>Documenti</h3>
      <p><strong>Tipo Documento:</strong> {cliente.tipoDocumento}</p>
      <p><strong>Numero:</strong> {cliente.documento}</p>
      <p><strong>Rilasciato da:</strong> {cliente.rilasciatoDaDocumento}</p>
      <p><strong>Data rilascio:</strong> {cliente.rilascioDocumento}</p>
      <p><strong>Data scadenza:</strong> {cliente.scadenzaDocumento}</p>
    </div>

    <div className="form-section">
      <h3>Patente</h3>
      <p><strong>Numero:</strong> {cliente.patente}</p>
      <p><strong>Rilasciata da:</strong> {cliente.rilasciataDaPatente}</p>
      <p><strong>Data rilascio:</strong> {cliente.rilascioPatente}</p>
      <p><strong>Data scadenza:</strong> {cliente.scadenzaPatente}</p>
    </div>

    {cliente.ragioneSociale && (
      <div className="form-section">
        <h3>Dati Aziendali</h3>
        <p><strong>Ragione Sociale:</strong> {cliente.ragioneSociale}</p>
        <p><strong>Partita IVA:</strong> {cliente.piva}</p>
        <p><strong>PEC:</strong> {cliente.pec}</p>
        <p><strong>Codice Univoco SDI:</strong> {cliente.codiceUnivoco}</p>
      </div>
    )}
 

<div className="form-section">
  <h3>Storico Noleggi</h3>
  {storicoCliente.length > 0 ? (
    <>
      <StoricoNoleggiTable
        noleggi={showAllNoleggi ? storicoCliente : storicoCliente.slice(0, 3)}
        contratti={cliente.contratti || []}
      />

      {storicoCliente.length > 3 && (
        <button
          onClick={() => setShowAllNoleggi(prev => !prev)}
          style={{
            marginTop: '0.5rem',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            color: '#2563eb'
          }}
        >
          {showAllNoleggi ? 'Nascondi' : 'Visualizza tutti'}
        </button>
      )}
    </>
  ) : (
    <p>Nessun noleggio registrato.</p>
  )}
</div>




   

 </div>
</Modal>

  );
}

export default ModalDettaglioCliente;
