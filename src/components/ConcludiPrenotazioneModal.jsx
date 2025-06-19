import React, { useState } from 'react';
import Modal from 'react-modal';
import '../styles/ConcludiPrenotazioneModal.css'; // Se vuoi stilizzarlo

function ConcludiPrenotazioneModal({ isOpen, onClose, onConferma, prenotazione }) {
  const [descrizione, setDescrizione] = useState('');
  const [daRiparare, setDaRiparare] = useState(false);
  const [immaginiDanni, setImmaginiDanni] = useState([]);


  const handleConferma = () => {
 onConferma({ 
  descrizioneDanno: descrizione, 
  daRiparare,
  fotoDanni: immaginiDanni.length > 0 ? immaginiDanni : null,
  idPrenotazione: prenotazione?.id
});
    setDescrizione('');
    setDaRiparare(false);
    setImmaginiDanni([]);

  };

  const handleAnnulla = () => {
    setDescrizione('');
    setDaRiparare(false);
    setImmaginiDanni([]);
    onClose();
  };
const handleFileChange = (e) => {
    const files = Array.from(e.target.files);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImmaginiDanni(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleAnnulla}
      contentLabel="Concludi Prenotazione"
      className="modal"
      overlayClassName="overlay"
      ariaHideApp={false}
    >
      <h2>Concludi Prenotazione</h2>

      {prenotazione && (
        <div className="prenotazione-dettagli">
          <p><strong>Cliente:</strong> {prenotazione.cliente}</p>
          <p><strong>Veicolo:</strong> {prenotazione.veicolo} ({prenotazione.targa})</p>
          <p><strong>Periodo:</strong> {prenotazione.dataInizio} → {prenotazione.dataFine}</p>
        </div>
      )}

      <div className="form-group">
        <label>Note / Danni riscontrati</label>
        <textarea
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          placeholder="Es. graffi su paraurti posteriore..."
        />
      </div>
<div className="form-group switch-wrapper">
  <label className="switch-label">Il danno richiede riparazione:</label>
  <label className="switch">
    <input
      type="checkbox"
      checked={daRiparare}
      onChange={(e) => setDaRiparare(e.target.checked)}
    />
    <span className="slider round"></span>
  </label>
</div>


 <div className="form-group">
        <label>Allega Foto Danni (opzionale)</label>
        <input type="file" accept="image/*" multiple onChange={handleFileChange} />
        <div className="preview-container">
          {immaginiDanni.map((img, index) => (
            <img key={index} src={img} alt={`danno-${index}`} style={{ width: '100px', marginTop: '10px' }} />
          ))}
        </div>
      </div>


      <div className="modal-actions">
        <button onClick={handleAnnulla} className="btn btn-secondary">Annulla</button>
        <button onClick={handleConferma} className="btn btn-primary">Conferma</button>
      </div>
    </Modal>
  );
}

export default ConcludiPrenotazioneModal;
