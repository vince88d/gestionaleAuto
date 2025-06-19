// ModalEditClient.jsx
import React from 'react';
import Modal from 'react-modal';
import { X } from 'lucide-react';
import './ModalEditClient.css';

function ModalEditClient({ show, onClose, onSave, clientData, setClientData }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setClientData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Modal
      isOpen={show}
      onRequestClose={onClose}
      contentLabel="Modifica Cliente"
      className={{
        base: 'Modal',
        afterOpen: 'Modal--after-open',
        beforeClose: 'Modal--before-close'
      }}
      overlayClassName="modal-overlay"
      ariaHideApp={false}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2>Modifica Cliente</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Chiudi">
            <X size={20} />
          </button>
        </div>

        <form className="client-form">
          {/* Dati Cliente */}
          <div className="form-section">
            <h3>Dati Cliente</h3>
            <div className="field-group">
              <input type="text" name="nome" placeholder="Nome" value={clientData.nome || ''} onChange={handleChange} />
              <input type="text" name="cognome" placeholder="Cognome" value={clientData.cognome || ''} onChange={handleChange} />
              <input type="text" name="codiceFiscale" placeholder="Codice Fiscale" value={clientData.codiceFiscale || ''} onChange={handleChange} />
              <input type="text" name="indirizzo" placeholder="Indirizzo" value={clientData.indirizzo || ''} onChange={handleChange} />
              <input type="text" name="luogoNascita" placeholder="Luogo di nascita" value={clientData.luogoNascita || ''} onChange={handleChange} />
              <input type="date" name="dataNascita" placeholder="Data di nascita" value={clientData.dataNascita || ''} onChange={handleChange} />
            </div>
          </div>

          {/* Contatti */}
          <div className="form-section">
            <h3>Contatti</h3>
            <div className="field-group">
              <input type="email" name="email" placeholder="Email" value={clientData.email || ''} onChange={handleChange} />
              <input type="tel" name="telefono" placeholder="Telefono Fisso" value={clientData.telefono || ''} onChange={handleChange} />
              <input type="tel" name="cellulare" placeholder="Cellulare" value={clientData.cellulare || ''} onChange={handleChange} />
            </div>
          </div>

          {/* Documenti */}
          <div className="form-section">
            <h3>Documento di Riconoscimento</h3>
            <div className="field-group">
              <select name="tipoDocumento" value={clientData.tipoDocumento || ''} onChange={handleChange}>
                <option value="">Seleziona...</option>
                <option value="CI">Carta d'Identità</option>
                <option value="Passaporto">Passaporto</option>
                <option value="Altro">Altro</option>
              </select>
              <input type="text" name="documento" placeholder="Numero Documento" value={clientData.documento || ''} onChange={handleChange} />
              <input type="text" name="rilasciatoDaDocumento" placeholder="Rilasciato da" value={clientData.rilasciatoDaDocumento || ''} onChange={handleChange} />
              <input type="date" name="rilascioDocumento" value={clientData.rilascioDocumento || ''} onChange={handleChange} />
              <input type="date" name="scadenzaDocumento" value={clientData.scadenzaDocumento || ''} onChange={handleChange} />
            </div>

            <h3 style={{ marginTop: '1.5rem' }}>Patente di Guida</h3>
            <div className="field-group">
              <input type="text" name="patente" placeholder="Numero Patente" value={clientData.patente || ''} onChange={handleChange} />
              <input type="text" name="rilasciataDaPatente" placeholder="Rilasciata da" value={clientData.rilasciataDaPatente || ''} onChange={handleChange} />
              <input type="date" name="rilascioPatente" value={clientData.rilascioPatente || ''} onChange={handleChange} />
              <input type="date" name="scadenzaPatente" value={clientData.scadenzaPatente || ''} onChange={handleChange} />
            </div>
          </div>

          {/* Azienda */}
          <div className="form-section">
            <h3>Dati Aziendali</h3>
            <div className="field-group">
              <input type="text" name="ragioneSociale" placeholder="Ragione Sociale" value={clientData.ragioneSociale || ''} onChange={handleChange} />
              <input type="text" name="piva" placeholder="Partita IVA" value={clientData.piva || ''} onChange={handleChange} />
              <input type="text" name="pec" placeholder="PEC" value={clientData.pec || ''} onChange={handleChange} />
              <input type="text" name="codiceUnivoco" placeholder="Codice Univoco SDI" value={clientData.codiceUnivoco || ''} onChange={handleChange} />
            </div>
          </div>

          <div className="modal-actions">
            <button className="save-btn small" type="button" onClick={onSave}>Salva</button>
            <button className="cancel-btn small" type="button" onClick={onClose}>Annulla</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export default ModalEditClient;
