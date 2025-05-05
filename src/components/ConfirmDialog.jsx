import * as Dialog from '@radix-ui/react-dialog';
import './BookingModal.css';

function ConfirmDialog({ open, onCancel, onConfirm, message }) {
  return (
    <Dialog.Root open={open} onOpenChange={() => onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="DialogOverlay" />
        <Dialog.Content className="DialogContent">
          <Dialog.Title>Conferma</Dialog.Title>
          <p>{message}</p>
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button onClick={onCancel}>Annulla</button>
            <button onClick={onConfirm}>Conferma</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ConfirmDialog;
