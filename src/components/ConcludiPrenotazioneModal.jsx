import React, { useRef, useState } from 'react';
import Modal from 'react-modal';
import { Upload, X } from 'lucide-react';
import { formattaData } from '../utils/scadenze';
import '../styles/ConcludiPrenotazioneModal.css';
import '../styles/Prenotazione.css';

// Riconsegna del veicolo: chiude il noleggio e registra gli eventuali danni.
function ConcludiPrenotazioneModal({ isOpen, onClose, onConferma, prenotazione }) {
  const [descrizione, setDescrizione] = useState('');
  const [daRiparare, setDaRiparare] = useState(false);
  const [immaginiDanni, setImmaginiDanni] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const inputFoto = useRef(null);

  const svuota = () => {
    setDescrizione('');
    setDaRiparare(false);
    setImmaginiDanni([]);
  };

  const handleConferma = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      await onConferma({
        descrizioneDanno: descrizione,
        daRiparare,
        fotoDanni: immaginiDanni.length > 0 ? immaginiDanni : null,
        idPrenotazione: prenotazione?.id,
      });
      svuota();
    } finally {
      setSalvando(false);
    }
  };

  const handleAnnulla = () => {
    if (salvando) return;
    svuota();
    onClose();
  };

  // Le foto restano qui come anteprima; alla conferma vanno su Storage.
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => setImmaginiDanni((prev) => [...prev, event.target.result]);
      reader.readAsDataURL(file);
    });
  };

  const scheda = prenotazione?.schedaVeicolo || {};

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleAnnulla}
      contentLabel="Concludi il noleggio"
      className={{ base: 'Modal pz-modal', afterOpen: 'Modal--after-open', beforeClose: 'Modal--before-close' }}
      overlayClassName={{ base: 'Overlay', afterOpen: 'Overlay--after-open', beforeClose: 'Overlay--before-close' }}
      ariaHideApp={false}
    >
      <div className="pz">
        <header className="pz-testa">
          <div>
            <h2 className="pz-titolo">Riconsegna e chiusura</h2>
            {prenotazione && (
              <span className="pz-sottotitolo">
                {prenotazione.cliente} · {prenotazione.veicolo} ({prenotazione.targa}) ·
                {' '}{formattaData(prenotazione.dataInizio)} → {formattaData(prenotazione.dataFine)}
              </span>
            )}
          </div>
          <button type="button" className="pz-chiudi" onClick={handleAnnulla} aria-label="Chiudi">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pz-corpo">
          {(scheda.kmIniziali || scheda.carburante || scheda.danni) && (
            <section className="pz-sezione">
              <h3 className="pz-titolo-sezione">Alla consegna era così</h3>
              <dl className="pz-dati">
                <div><dt>Km</dt><dd>{scheda.kmIniziali ? Number(scheda.kmIniziali).toLocaleString('it-IT') : '—'}</dd></div>
                <div><dt>Carburante</dt><dd>{scheda.carburante || '—'}</dd></div>
                <div><dt>Danni già presenti</dt><dd>{scheda.danni || 'Nessuno'}</dd></div>
              </dl>
            </section>
          )}

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Danni nuovi</h3>
            <label className="pz-campo">
              <span className="pz-etichetta">Descrizione</span>
              <textarea
                value={descrizione}
                onChange={(e) => setDescrizione(e.target.value)}
                rows={3}
                placeholder="Es. graffio sul paraurti posteriore. Lascia vuoto se il veicolo è rientrato senza danni."
              />
            </label>
            <label className="pz-opzione" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={daRiparare} onChange={(e) => setDaRiparare(e.target.checked)} />
              <span>
                Da riparare
                <span className="pz-aiuto" style={{ display: 'block' }}>
                  Il veicolo apparirà in «Da fare» sulla Dashboard finché non lo segni riparato.
                </span>
              </span>
            </label>
            <div className="pz-foto">
              {immaginiDanni.map((img, index) => (
                <img key={img.slice(-32) + index} src={img} alt={`Danno ${index + 1}`} />
              ))}
              <input ref={inputFoto} type="file" accept="image/*" multiple hidden onChange={handleFileChange} />
              <button type="button" className="vd-btn" onClick={() => inputFoto.current?.click()}>
                <Upload size={16} aria-hidden="true" /> {immaginiDanni.length ? 'Aggiungi altre foto' : 'Aggiungi foto'}
              </button>
              {immaginiDanni.length > 0 && (
                <button type="button" className="pz-link" style={{ alignSelf: 'center', color: '#c0392b' }} onClick={() => setImmaginiDanni([])}>
                  Togli le foto
                </button>
              )}
            </div>
          </section>
        </div>

        <footer className="pz-piede">
          <button type="button" className="vd-btn" onClick={handleAnnulla} disabled={salvando}>Annulla</button>
          <button type="button" className="vd-btn vd-btn--successo" onClick={handleConferma} disabled={salvando}>
            {salvando ? 'Salvataggio…' : 'Concludi il noleggio'}
          </button>
        </footer>
      </div>
    </Modal>
  );
}

export default ConcludiPrenotazioneModal;
