import * as Dialog from '@radix-ui/react-dialog';
import './BookingModal.css';
import { useEffect, useRef } from 'react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';

function BookingModal({ open, onClose, children }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open && closeButtonRef.current) {
      // Sposta il focus su un elemento visibile quando il modal viene chiuso
      closeButtonRef.current.focus();
    }
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      modal={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        {/* Radix non renderizza Dialog.Overlay quando modal={false};
            l'overlay esplicito mantiene in evidenza la prenotazione
            senza interferire con il modal annidato per il nuovo cliente. */}
        <div className="DialogOverlay" aria-hidden="true" />
        <Dialog.Content
          className="DialogContent"
          onInteractOutside={(e) => {
            if (e.target.closest?.('.AddClientOverlay, .AddClientModal')) {
              e.preventDefault();
            }
          }}
          onFocusOutside={(e) => {
            if (e.target.closest?.('.AddClientOverlay, .AddClientModal')) {
              e.preventDefault();
            }
          }}
        >
          <Dialog.Title >
          <VisuallyHidden>Gestione Prenotazione</VisuallyHidden>
            </Dialog.Title>
      <Dialog.Close className="DialogClose" ref={closeButtonRef} aria-label="Chiudi">
  <X size={20} />
</Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default BookingModal;
