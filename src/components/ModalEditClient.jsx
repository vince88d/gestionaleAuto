import React from 'react';
import './ModalEditClient.css';

function ModalEditClient({ show, onClose, onSave, clientData, setClientData }) {
  if (!show) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setClientData({ ...clientData, [name]: value });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Modifica Cliente</h2>
        <input type="text" name="nome" value={clientData.nome} onChange={handleChange} placeholder="Nome" />
        <input type="text" name="cognome" value={clientData.cognome} onChange={handleChange} placeholder="Cognome" />
        <input type="email" name="email" value={clientData.email} onChange={handleChange} placeholder="Email" />
        <input type="tel" name="telefono" value={clientData.telefono} onChange={handleChange} placeholder="Telefono" />
        <input type="text" name="documento" value={clientData.documento} onChange={handleChange} placeholder="Documento" />
        <div className="modal-buttons">
          <button onClick={onSave} className="save-btn">Salva</button>
          <button onClick={onClose} className="cancel-btn">Annulla</button>
        </div>
      </div>
    </div>
  );
}

export default ModalEditClient;
