import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CalendarCheck } from 'lucide-react';
import { formattaData, prossimaScadenza } from '../utils/scadenze';
import './BookingModal.css';
import './SospendiVeicoloModal.css';

// "Segna rinnovato" dalla Dashboard: chiede solo la nuova data di scadenza,
// gia' proposta (un anno dopo la vecchia, due per la revisione).
function RinnovaScadenzaModal({ scadenza, onCancel, onConfirm }) {
  const [data, setData] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (scadenza) {
      setData(prossimaScadenza(scadenza.chiave, scadenza.data));
      setSalvando(false);
    }
  }, [scadenza]);

  if (!scadenza) return null;
  const nomeVeicolo = [scadenza.veicolo.marca, scadenza.veicolo.modello].filter(Boolean).join(' ') || scadenza.veicolo.targa;

  const conferma = async () => {
    if (!data) return;
    setSalvando(true);
    try {
      await onConfirm(data);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(aperto) => { if (!aperto && !salvando) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="DialogOverlay" />
        <Dialog.Content className="DialogContent confirm-dialog sosp">
          <Dialog.Title className="confirm-dialog-title">
            <CalendarCheck size={20} aria-hidden="true" /> {scadenza.nome} rinnovato · {nomeVeicolo}
          </Dialog.Title>
          <p className="confirm-dialog-message">
            Scadenza vecchia: {formattaData(scadenza.data)}. Scrivi quando scade adesso.
          </p>

          <label className="sosp-campo">
            <span>Nuova scadenza</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </label>

          <div className="confirm-dialog-actions">
            <button type="button" onClick={onCancel} disabled={salvando} className="confirm-dialog-btn confirm-dialog-btn-secondary">
              Annulla
            </button>
            <button type="button" onClick={conferma} disabled={salvando || !data} className="confirm-dialog-btn confirm-dialog-btn-primary">
              {salvando ? 'Salvo…' : 'Salva nuova scadenza'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default RinnovaScadenzaModal;
