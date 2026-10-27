import * as Dialog from '@radix-ui/react-dialog';
import { KeyRound, Ban } from 'lucide-react';
import './BookingModal.css';

// Dopo «Prenota e consegna ora», se si chiude la consegna senza finirla la
// prenotazione e' gia' salvata e l'auto risulta occupata: si chiede cosa fare.
// Mockup: formiarent-documenti/mockup/gestionale-prenotazione-modello-unico.html
function ConsegnaNonCompletataDialog({ open, prenotazione, onRiprendi, onPiuTardi, onAnnulla }) {
  const cliente = prenotazione?.cliente || 'questo cliente';
  const auto = [prenotazione?.veicolo, prenotazione?.targa ? `(${prenotazione.targa})` : ''].filter(Boolean).join(' ') || "L'auto";
  return (
    <Dialog.Root open={open} onOpenChange={(aperto) => { if (!aperto) onRiprendi(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="DialogOverlay" />
        <Dialog.Content className="DialogContent confirm-dialog" aria-describedby="consegna-non-completata-testo">
          <Dialog.Title className="confirm-dialog-title">Consegna non completata</Dialog.Title>
          <p id="consegna-non-completata-testo" className="confirm-dialog-message">
            La prenotazione di {cliente} è già salvata e {auto} risulta occupata. Cosa vuoi fare?
          </p>
          <div className="confirm-dialog-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <button type="button" onClick={onRiprendi} className="confirm-dialog-btn confirm-dialog-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 }}>
              <KeyRound size={18} aria-hidden="true" /> Riprendi la consegna
            </button>
            <button type="button" onClick={onPiuTardi} className="confirm-dialog-btn confirm-dialog-btn-secondary" style={{ minHeight: 44 }}>
              Consegno più tardi (resta in Dashboard)
            </button>
            <button type="button" onClick={onAnnulla} className="confirm-dialog-btn confirm-dialog-btn-danger" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 }}>
              <Ban size={18} aria-hidden="true" /> Annulla anche la prenotazione
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ConsegnaNonCompletataDialog;
