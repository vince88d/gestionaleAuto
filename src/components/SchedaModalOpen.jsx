import React, { useState } from 'react';
import Modal from 'react-modal';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from './firebase'; // assicurati del path
import '../components/schedaModal.css';


function SchedaVeicoloModal({ isOpen, onRequestClose, schedaVeicolo, setSchedaVeicolo, onSave }) {
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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    setUploading(true);
    try {
      const storageRef = ref(storage, `danni/${Date.now()}-${file.name}`);      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      console.log("url dell immagine caricata",url);
  
      setSchedaVeicolo(prev => ({
        ...prev,
        fotoDanni: url
      }));
    } catch (error) {
      console.error("Errore durante l'upload dell'immagine:", error);
      // Mostra un messaggio di errore all'utente
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} className="Modal" overlayClassName="Overlay">
      <button onClick={onRequestClose} style={{ float: 'right' }}>✖</button>
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
        <input type="file" accept="image/*" onChange={handleImageUpload} />
        {uploading && <p>Caricamento in corso...</p>}
        {schedaVeicolo.fotoDanni && (
           <img src={schedaVeicolo.fotoDanni} alt="Danni" className="preview" />
        )}

        <button type="submit" disabled={uploading}>
         {uploading ? "Attendi...":"Salva Scheda"}
          </button>
      </form>
    </Modal>
  );
}

export default SchedaVeicoloModal;
