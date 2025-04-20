import React from 'react';
import Modal from 'react-modal';

function SchedaVeicoloModal({ isOpen, onRequestClose, schedaVeicolo, setSchedaVeicolo, onSave }) {
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

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      className="Modal"
      overlayClassName="Overlay"
    >
      <button onClick={onRequestClose} style={{ float: 'right', border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
      <h2>Scheda Veicolo</h2>

      <form className="booking-form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
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
        <div>
          <label><input type="checkbox" name="accessori.cric" checked={schedaVeicolo.accessori.cric} onChange={handleChange} /> Cric</label>
          <label><input type="checkbox" name="accessori.triangolo" checked={schedaVeicolo.accessori.triangolo} onChange={handleChange} /> Triangolo</label>
          <label><input type="checkbox" name="accessori.giubbotto" checked={schedaVeicolo.accessori.giubbotto} onChange={handleChange} /> Giubbotto</label>
        </div>

        <label>Danni visibili</label>
        <textarea name="danni" value={schedaVeicolo.danni} onChange={handleChange} rows={3} placeholder="Descrizione dei danni presenti..." />

        <button type="submit">Salva Scheda</button>
      </form>
    </Modal>
  );
}

export default SchedaVeicoloModal;
