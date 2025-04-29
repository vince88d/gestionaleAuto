import React, { useState } from 'react';
import Modal from 'react-modal';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from './firebase'; // assicurati del path
import '../components/schedaModal.css';

function SchedaVeicoloModal({ isOpen, onRequestClose, schedaVeicolo, setSchedaVeicolo, onSave, onBack }) {
  const [uploading, setUploading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('accessori.')) {
      const key = name.split('.')[1];
      setSchedaVeicolo(prev => ({
        ...prev,
        accessori: {
          ...prev.accessori,
          [key]: checked
        }
      }));
    } else {
      setSchedaVeicolo(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleImageUpload = async () => {
    const filePaths = await window.electronAPI.selezionaImmagine();
    if (!filePaths || !filePaths[0]) return;

    setUploading(true);
    try {
      const localUrl = await window.electronAPI.salvaImmagineLocale(filePaths[0]);
      setSchedaVeicolo(prev => ({ ...prev, fotoDanni: localUrl }));
    } catch (err) {
      console.error("Errore durante salvataggio immagine:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      closeTimeoutMS={300} 
      className={{
        base: 'Modal',
        afterOpen: 'Modal--after-open',
        beforeClose: 'Modal--before-close'
      }}
      overlayClassName={{
        base: 'Overlay',
        afterOpen: 'Overlay--after-open',
        beforeClose: 'Overlay--before-close'
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <button onClick={onBack} className="simple-btn">← Indietro</button>
        <button onClick={onRequestClose} className="simple-btn">✖</button>
      </div>

      <h2>Scheda Veicolo</h2>

      <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <label>Livello Carburante</label>
        <select name="carburante" value={schedaVeicolo.carburante} onChange={handleChange} required>
          <option value="">Seleziona</option>
          <option value="1/4">1/4</option>
          <option value="1/2">1/2</option>
          <option value="3/4">3/4</option>
          <option value="Pieno">Pieno</option>
        </select>

        <label>Km Iniziali</label>
        <input type="number" name="kmIniziali" value={schedaVeicolo.kmIniziali} onChange={handleChange} required />

        <label>Accessori presenti</label>
        <div className="accessori-wrapper">
          <label><input type="checkbox" name="accessori.cric" checked={schedaVeicolo.accessori.cric} onChange={handleChange} /> Cric</label>
          <label><input type="checkbox" name="accessori.triangolo" checked={schedaVeicolo.accessori.triangolo} onChange={handleChange} /> Triangolo</label>
          <label><input type="checkbox" name="accessori.giubbotto" checked={schedaVeicolo.accessori.giubbotto} onChange={handleChange} /> Giubbotto</label>
        </div>

        <label>Danni visibili</label>
        <textarea name="danni" value={schedaVeicolo.danni} onChange={handleChange} rows={3} placeholder="Descrizione dei danni..." />

        <label>Foto dei Danni (opzionale)</label>
        <button type="button" onClick={handleImageUpload}>
          Carica Immagine
        </button>
        {uploading && <p>Caricamento in corso...</p>}
        {schedaVeicolo.fotoDanni && (
          <img src={schedaVeicolo.fotoDanni} alt="Danni" className="preview" />
        )}

        <button type="submit" disabled={uploading}>
          {uploading ? "Attendi..." : "Salva Scheda"}
        </button>
      </form>
    </Modal>
  );
}

export default SchedaVeicoloModal;
