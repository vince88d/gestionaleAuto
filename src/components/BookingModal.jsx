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
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="DialogOverlay" />
        <Dialog.Content className="DialogContent">
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