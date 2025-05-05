import React, { useState, useRef } from 'react';
import Modal from 'react-modal';
import './InfoModal.css';

function InfoModal({ isOpen, onClose, prenotazione,onModifica, onElimina, onConcludi }) {
  const [showImage, setShowImage] = useState(false);
  const printRef = useRef();

  const handleDownloadPDF = () => {
    import('html2pdf.js').then(({ default: html2pdf }) => {
      if (printRef.current) {
        const opt = {
          margin: 10,
          filename: `Prenotazione_${prenotazione?.cliente || 'cliente'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

         // Clona l'elemento per modificarlo temporaneamente
         const element = printRef.current.cloneNode(true);
         const noPrintElements = element.querySelectorAll('.no-print, button, .btn, svg');
         
         noPrintElements.forEach(el => el.remove());
         
         // Aggiungi stili temporanei per la stampa
         const style = document.createElement('style');
         style.innerHTML = `
           .print-only { display: block !important; }
           .no-print { display: none !important; }
           body { font-family: Arial, sans-serif; }
           .info-item { margin-bottom: 8px; }
           .info-label { font-weight: bold; }
           .photo-container img { max-width: 100%; height: auto; }
         `;
         element.appendChild(style);
         
         // Crea un div temporaneo per generare il PDF
         const tempDiv = document.createElement('div');
         tempDiv.appendChild(element);
         document.body.appendChild(tempDiv);
         
         html2pdf().from(tempDiv).set(opt).save();
         
         // Rimuovi il div temporaneo dopo la generazione del PDF
         setTimeout(() => {
           document.body.removeChild(tempDiv);
         }, 1000);
       }
     });
   };

  if (!prenotazione) return null;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Dettagli Prenotazione"
      className="info-modal"
      overlayClassName="modal-overlay"
      closeTimeoutMS={300}
      ariaHideApp={false}
    >
          <div ref={printRef} className="modal-content">
        {/* Header - Nascondi nel PDF */}
        <div className="modal-header no-print">
          <h2 className="modal-title">Dettagli Prenotazione</h2>
          <button className="btn-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
        <h2 className="print-only" style={{ textAlign: 'center', marginBottom: '20px' }}>
            Dettagli Prenotazione
          </h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Cliente</span>
              <span className="info-value">{prenotazione.cliente}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Email</span>
              <span className="info-value">{prenotazione.emailCliente}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Codice Fiscale</span>
              <span className="info-value">{prenotazione.codiceFiscale}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Patente</span>
              <span className="info-value">{prenotazione.patente}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Veicolo</span>
              <span className="info-value">{prenotazione.veicolo}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Targa</span>
              <span className="info-value">{prenotazione.targa}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Dal</span>
              <span className="info-value">{prenotazione.dataInizio}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Al</span>
              <span className="info-value">{prenotazione.dataFine}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Prezzo</span>
              <span className="info-value">{prenotazione.prezzoTotale} €</span>
            </div>
          </div>

          {prenotazione.schedaVeicolo?.fotoDanni && (
            <div className="photo-section">
              <button 
                className="btn btn-primary"
                onClick={() => setShowImage(!showImage)}
              >
                {showImage ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Nascondi Foto
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Mostra Foto Danni
                  </>
                )}
              </button>

              {showImage && (
                <div className="photo-container">
                  <img
                    src={prenotazione.schedaVeicolo.fotoDanni}
                    alt="Foto Danni"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="info-modal-actions">
  <button className="edit-btn" onClick={() => onModifica(prenotazione)}>Modifica</button>
  <button className="delete-btn" onClick={() => onElimina(prenotazione)}>Elimina</button>
  <button className="complete-btn" onClick={() => onConcludi(prenotazione)}>Concludi</button>
</div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleDownloadPDF}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Scarica PDF
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default InfoModal;