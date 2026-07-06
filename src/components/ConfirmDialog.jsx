import * as Dialog from '@radix-ui/react-dialog';
import './BookingModal.css';

function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  message,
  title = 'Conferma',
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  tone = 'default',
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="DialogOverlay" />
        <Dialog.Content className="DialogContent confirm-dialog">
          <Dialog.Title className="confirm-dialog-title">{title}</Dialog.Title>
          <p className="confirm-dialog-message">{message}</p>
          <div className="confirm-dialog-actions">
            <button onClick={onCancel} className="confirm-dialog-btn confirm-dialog-btn-secondary">
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`confirm-dialog-btn ${tone === 'danger' ? 'confirm-dialog-btn-danger' : 'confirm-dialog-btn-primary'}`}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ConfirmDialog;
