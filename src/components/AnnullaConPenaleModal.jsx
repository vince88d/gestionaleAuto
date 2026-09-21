import React, { useMemo, useState } from 'react';
import Modal from 'react-modal';
import { calcolaPenale } from '../utils/penale';
import '../styles/ConcludiPrenotazioneModal.css'; // classi .modal, .overlay, .btn, .form-group

const PERCENTUALI_RAPIDE = [10, 20, 30, 50];

const euro = (valore) => `${Number(valore).toFixed(2).replace('.', ',')} €`;

const stiliPillola = (attiva) => ({
  padding: '0.45rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.95rem',
  border: attiva ? '2px solid #2c3e50' : '1px solid #ccc',
  background: attiva ? '#2c3e50' : 'white', color: attiva ? 'white' : '#2c3e50',
});

// Annulla una prenotazione pagata online: rimborso totale oppure con una penale
// scelta dal gestore (percentuale rapida, percentuale libera o importo fisso).
// Mostra in anteprima quanto viene trattenuto e quanto torna al cliente.
function AnnullaConPenaleModal({ prenotazione, inCorso, onClose, onConferma }) {
  const [scelta, setScelta] = useState('nessuna'); // 'nessuna' | '10' | ... | 'altra' | 'importo'
  const [valoreLibero, setValoreLibero] = useState('');

  const totale = Number(prenotazione?.totale ?? prenotazione?.prezzoTotale ?? 0);

  const calcolo = useMemo(() => {
    if (scelta === 'nessuna') return calcolaPenale(totale, { tipo: 'nessuna' });
    if (scelta === 'altra') return calcolaPenale(totale, { tipo: 'percentuale', valore: valoreLibero });
    if (scelta === 'importo') return calcolaPenale(totale, { tipo: 'importo', valore: valoreLibero });
    return calcolaPenale(totale, { tipo: 'percentuale', valore: Number(scelta) });
  }, [scelta, valoreLibero, totale]);

  const libero = scelta === 'altra' || scelta === 'importo';
  const puoConfermare = calcolo.valida && (!libero || valoreLibero !== '') && !inCorso;

  const scegli = (nuova) => {
    setScelta(nuova);
    setValoreLibero('');
  };

  return (
    <Modal
      isOpen={Boolean(prenotazione)}
      onRequestClose={inCorso ? undefined : onClose}
      contentLabel="Annulla e rimborsa"
      className="modal"
      overlayClassName="overlay"
      ariaHideApp={false}
    >
      <h2>Annulla la prenotazione</h2>

      {prenotazione && (
        <div className="prenotazione-dettagli">
          <p><strong>Cliente:</strong> {prenotazione.cliente}</p>
          <p><strong>Periodo:</strong> {prenotazione.dataInizio} → {prenotazione.dataFine}</p>
          <p><strong>Pagato online:</strong> {euro(totale)}</p>
        </div>
      )}

      <div className="form-group">
        <label>Penale da trattenere</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }} role="group" aria-label="Penale">
          <button type="button" style={stiliPillola(scelta === 'nessuna')} onClick={() => scegli('nessuna')} aria-pressed={scelta === 'nessuna'}>
            Nessuna (rimborso totale)
          </button>
          {PERCENTUALI_RAPIDE.map((p) => (
            <button key={p} type="button" style={stiliPillola(scelta === String(p))} onClick={() => scegli(String(p))} aria-pressed={scelta === String(p)}>
              {p}%
            </button>
          ))}
          <button type="button" style={stiliPillola(scelta === 'altra')} onClick={() => scegli('altra')} aria-pressed={scelta === 'altra'}>
            Altra %
          </button>
          <button type="button" style={stiliPillola(scelta === 'importo')} onClick={() => scegli('importo')} aria-pressed={scelta === 'importo'}>
            Importo fisso
          </button>
        </div>

        {libero && (
          <div style={{ marginTop: '0.7rem' }}>
            <label htmlFor="valore-penale" style={{ display: 'block', marginBottom: '0.3rem' }}>
              {scelta === 'altra' ? 'Percentuale (%)' : 'Importo (€)'}
            </label>
            <input
              id="valore-penale" type="number" min="0" step={scelta === 'altra' ? '1' : '0.01'} inputMode="decimal"
              value={valoreLibero} onChange={(e) => setValoreLibero(e.target.value)} autoFocus
              style={{ width: '10rem', padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
            />
          </div>
        )}
      </div>

      <div className="form-group" style={{ background: '#f4f6f8', padding: '0.8rem 1rem', borderRadius: 8 }}>
        {calcolo.valida ? (
          <>
            <p style={{ margin: '0.2rem 0' }}>Penale trattenuta: <strong>{euro(calcolo.trattenuto)}</strong></p>
            <p style={{ margin: '0.2rem 0' }}>Rimborso al cliente: <strong>{euro(calcolo.rimborso)}</strong></p>
          </>
        ) : (
          <p style={{ margin: 0, color: '#c0392b' }} role="alert">{calcolo.errore}</p>
        )}
      </div>

      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.8rem' }}>
        Applica una penale solo se è prevista dalle condizioni di noleggio accettate dal cliente. Il cliente riceve
        un'email con l'importo trattenuto. L'operazione non si può annullare.
      </p>

      <div className="modal-actions">
        <button onClick={onClose} disabled={inCorso} className="btn btn-secondary">Indietro</button>
        <button
          onClick={() => onConferma(calcolo.penale)}
          disabled={!puoConfermare}
          className="btn btn-primary"
        >
          {inCorso ? 'Annullamento in corso…' : 'Annulla e rimborsa'}
        </button>
      </div>
    </Modal>
  );
}

export default AnnullaConPenaleModal;
