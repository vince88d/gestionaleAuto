import React, { useRef, useState } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { caricaFotoDanno } from '../lib/storageFoto';
import '../components/schedaModal.css';

const ACCESSORI = [
  ['cric', 'Cric'],
  ['triangolo', 'Triangolo'],
  ['giubbotto', 'Giubbotto'],
  ['ruotaScorta', 'Ruota di scorta'],
  ['cavoRicarica', 'Cavo ricarica'],
  ['cateneNeve', 'Catene da neve'],
];

// Primo passo della consegna: stato del veicolo quando lo si da' al cliente.
// Il secondo passo e' il riepilogo con contratto e PDF.
function SchedaVeicoloModal({
  isOpen,
  onRequestClose,
  prenotazione,
  schedaVeicolo,
  setSchedaVeicolo,
  patente,
  onPatenteChange,
  onSave,
}) {
  const [uploading, setUploading] = useState(false);
  const inputFoto = useRef(null);
  // La patente si chiede solo se la prenotazione non ce l'ha (es. arrivata dal sito).
  const chiediPatente = Boolean(prenotazione) && !prenotazione.patente;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('accessori.')) {
      const key = name.split('.')[1];
      setSchedaVeicolo((prev) => ({
        ...prev,
        accessori: { ...prev.accessori, [key]: type === 'checkbox' ? checked : value },
      }));
    } else {
      setSchedaVeicolo((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Prima la foto finiva in una cartella del PC e nella prenotazione restava un
  // percorso che dagli altri computer non si apriva: ora va su Storage (danni/).
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const indirizzo = await caricaFotoDanno(file);
      setSchedaVeicolo((prev) => ({ ...prev, fotoDanni: indirizzo }));
    } catch (err) {
      console.error('Errore caricamento foto danni:', err);
      toast.error(err.message || 'Foto non caricata, riprova.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      closeTimeoutMS={300}
      className={{ base: 'Modal', afterOpen: 'Modal--after-open', beforeClose: 'Modal--before-close' }}
      overlayClassName={{ base: 'Overlay', afterOpen: 'Overlay--after-open', beforeClose: 'Overlay--before-close' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Consegna del veicolo</h2>
        <button type="button" onClick={onRequestClose} className="simple-btn" aria-label="Chiudi">✖</button>
      </div>

      {prenotazione && (
        <p style={{ margin: '0 0 1rem', color: '#475569' }}>
          <strong>{prenotazione.cliente}</strong> · {prenotazione.veicolo} ({prenotazione.targa}) ·
          dal {prenotazione.dataInizio} al {prenotazione.dataFine}
        </p>
      )}

      <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        {chiediPatente && (
          <>
            <label htmlFor="consegna-patente">Numero patente (controllata in sede)</label>
            <input
              id="consegna-patente"
              type="text"
              value={patente || ''}
              onChange={(e) => onPatenteChange(e.target.value)}
              placeholder="Es. AB1234567"
              required
            />
          </>
        )}

        <label htmlFor="consegna-carburante">Livello carburante</label>
        <select id="consegna-carburante" name="carburante" value={schedaVeicolo.carburante} onChange={handleChange} required>
          <option value="">Seleziona</option>
          <option value="1/4">1/4</option>
          <option value="1/2">1/2</option>
          <option value="3/4">3/4</option>
          <option value="Pieno">Pieno</option>
        </select>

        <label htmlFor="consegna-km">Km alla consegna</label>
        <input id="consegna-km" type="number" min="0" name="kmIniziali" value={schedaVeicolo.kmIniziali} onChange={handleChange} required />

        <label>Accessori presenti</label>
        <div className="accessori-wrapper">
          {ACCESSORI.map(([chiave, nome]) => (
            <label key={chiave}>
              <input
                type="checkbox"
                name={`accessori.${chiave}`}
                checked={Boolean(schedaVeicolo.accessori?.[chiave])}
                onChange={handleChange}
              /> {nome}
            </label>
          ))}
          <label>
            Altro accessorio:
            <input
              type="text"
              name="accessori.altro"
              value={schedaVeicolo.accessori?.altro || ''}
              onChange={handleChange}
              placeholder="Es. Seggiolino bimbi"
            />
          </label>
        </div>

        <label htmlFor="consegna-danni">Danni già presenti</label>
        <textarea id="consegna-danni" name="danni" value={schedaVeicolo.danni} onChange={handleChange} rows={3} placeholder="Descrizione dei danni..." />

        <label>Foto dei danni (opzionale)</label>
        <input ref={inputFoto} type="file" accept="image/*" hidden onChange={handleImageUpload} />
        <button type="button" onClick={() => inputFoto.current?.click()} disabled={uploading}>
          {uploading ? 'Caricamento…' : schedaVeicolo.fotoDanni ? 'Cambia foto' : 'Carica foto'}
        </button>
        {schedaVeicolo.fotoDanni && (
          <img src={schedaVeicolo.fotoDanni} alt="Danni" className="preview" />
        )}

        <button type="submit" disabled={uploading}>
          {uploading ? 'Attendi…' : 'Avanti: riepilogo e contratto'}
        </button>
      </form>
    </Modal>
  );
}

export default SchedaVeicoloModal;
