import React, { useMemo, useState } from 'react';
import Modal from 'react-modal';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { assegnaVeicolo } from '../lib/firestorePrenotazioni';
import { updatePrenotazione } from '../store/prenotazioniSlice';
import { daAssegnare, veicoliLiberiPerPrenotazione } from '../utils/assegnazioneVeicolo';
import { formattaData } from '../utils/scadenze';
import '../styles/ConcludiPrenotazioneModal.css'; // classi .modal, .overlay, .btn, .form-group

const stili = {
  riquadro: {
    background: '#fff', border: '1px solid #f5d98b', borderLeft: '4px solid #f0b429', borderRadius: 12,
    padding: '14px 18px', margin: '0 0 16px', color: '#2c3e50',
  },
  titolo: { margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#8a5a00' },
  riga: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
    padding: '8px 0', borderTop: '1px solid #f6ecd0', flexWrap: 'wrap', fontSize: 14,
  },
  bottone: {
    display: 'inline-flex', alignItems: 'center', padding: '6px 12px', border: '1px solid #f0b429',
    borderRadius: 8, background: '#fff8e1', color: '#8a5a00', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  campo: {
    width: '100%', boxSizing: 'border-box', padding: '0.6rem',
    border: '1px solid #ccc', borderRadius: 6, fontSize: '1rem',
  },
};

function AssegnaVeicoloModal({ prenotazione, veicoliLiberi, onClose, onConferma }) {
  const [targa, setTarga] = useState('');
  const [patente, setPatente] = useState('');
  const [salvataggio, setSalvataggio] = useState(false);

  const conferma = async () => {
    const veicolo = veicoliLiberi.find((v) => v.targa === targa);
    if (!veicolo) return;
    setSalvataggio(true);
    try {
      await onConferma({ veicolo, patente });
    } finally {
      setSalvataggio(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(prenotazione)}
      onRequestClose={onClose}
      contentLabel="Assegna veicolo"
      className="modal"
      overlayClassName="overlay"
      ariaHideApp={false}
    >
      <h2>Assegna il veicolo</h2>
      {prenotazione && (
        <div className="prenotazione-dettagli">
          <p><strong>Cliente:</strong> {prenotazione.cliente}</p>
          <p><strong>Categoria prenotata:</strong> {prenotazione.categoria}</p>
          <p><strong>Periodo:</strong> {prenotazione.dataInizio} → {prenotazione.dataFine}</p>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="assegna-targa">Veicolo disponibile</label>
        {veicoliLiberi.length === 0 ? (
          <p style={{ color: '#c0392b' }}>
            Nessun veicolo di questa categoria è libero per questo periodo.
          </p>
        ) : (
          <select
            id="assegna-targa" style={stili.campo}
            value={targa} onChange={(e) => setTarga(e.target.value)}
          >
            <option value="">Seleziona un veicolo</option>
            {veicoliLiberi.map((v) => (
              <option key={v.targa} value={v.targa}>
                {[v.marca, v.modello].filter(Boolean).join(' ')} — {v.targa}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="assegna-patente">Numero patente (opzionale)</label>
        <input
          id="assegna-patente" style={stili.campo} type="text"
          placeholder="Da inserire dopo il controllo del documento in sede"
          value={patente} onChange={(e) => setPatente(e.target.value)}
        />
      </div>

      <div className="modal-actions">
        <button onClick={onClose} className="btn btn-secondary">Annulla</button>
        <button
          onClick={conferma} className="btn btn-primary"
          disabled={!targa || salvataggio}
        >
          {salvataggio ? 'Salvataggio…' : 'Assegna'}
        </button>
      </div>
    </Modal>
  );
}

// Elenco delle prenotazioni del sito già pagate a cui manca il veicolo reale.
// Non mostra nulla se non ce ne sono.
export default function PrenotazioniDaAssegnare({ prenotazioni, veicoli }) {
  const dispatch = useDispatch();
  const [selezionata, setSelezionata] = useState(null);

  const daFare = useMemo(() => prenotazioni.filter(daAssegnare), [prenotazioni]);
  const liberi = useMemo(
    () => (selezionata ? veicoliLiberiPerPrenotazione(selezionata, veicoli, prenotazioni) : []),
    [selezionata, veicoli, prenotazioni],
  );

  const conferma = async ({ veicolo, patente }) => {
    try {
      const aggiornata = await assegnaVeicolo({ prenotazione: selezionata, veicolo, patente });
      dispatch(updatePrenotazione(aggiornata));
      toast.success(`Assegnato ${veicolo.modello} (${veicolo.targa})`);
      setSelezionata(null);
    } catch (err) {
      console.error('Errore assegnazione veicolo:', err);
      toast.error('Impossibile assegnare il veicolo, riprova.');
    }
  };

  if (daFare.length === 0) return null;

  return (
    <div style={stili.riquadro}>
      <h3 style={stili.titolo}>
        Da assegnare: {daFare.length} {daFare.length === 1 ? 'prenotazione' : 'prenotazioni'} dal sito
      </h3>
      {daFare.map((p) => (
        <div key={p.id} style={stili.riga}>
          <span>
            <strong>{p.cliente}</strong> · {p.categoria} · {formattaData(p.dataInizio)} → {formattaData(p.dataFine)}
          </span>
          <button type="button" style={stili.bottone} onClick={() => setSelezionata(p)}>
            Assegna veicolo
          </button>
        </div>
      ))}

      <AssegnaVeicoloModal
        key={selezionata?.id || 'nessuna'}
        prenotazione={selezionata}
        veicoliLiberi={liberi}
        onClose={() => setSelezionata(null)}
        onConferma={conferma}
      />
    </div>
  );
}
