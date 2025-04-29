import React from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import "../components/riepilogoModal.css";

const boxStyle = {
  border: '1px solid #ccc',
  borderRadius: '10px',
  padding: '1rem',
  background: '#f9f9f9'
};

const titleStyle = {
  marginBottom: '0.5rem',
  color: '#333'
};

const buttonBase = {
  padding: '0.6rem 1.2rem',
  fontSize: '1rem',
  borderRadius: '8px',
  cursor: 'pointer',
  border: 'none',
  fontWeight: '600'
};

const cancelButtonStyle = {
  ...buttonBase,
  background: '#ccc',
  color: '#333'
};

const confirmButtonStyle = {
  ...buttonBase,
  background: '#28a745',
  color: '#fff'
};

const printButtonStyle = {
  ...buttonBase,
  background: '#007bff',
  color: '#fff'
};


function RiepilogoPrenotazioneModal({ isOpen, onClose, formData, schedaVeicolo, onConferma }) {
    const handleConfirmClick = () => {
        toast.info(
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ marginBottom: '1rem' }}>Sei sicuro di voler confermare la prenotazione?</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  toast.dismiss();
                  onConferma(); // Chiamata corretta mantenendo tutto
                }}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ✅ Sì
              </button>
              <button
                onClick={() => toast.dismiss()}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ❌ No
              </button>
            </div>
          </div>,
          { autoClose: false }
        );
      };
      
    const handlePrint = () => {
      const printContent = document.getElementById('riepilogo-print');
      const printWindow = window.open('', '', 'width=800,height=600');
      printWindow.document.write(`
        <html>
        <head>
          <title>Riepilogo Prenotazione</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h2, h3 { margin-bottom: 10px; }
            .section { margin-bottom: 20px; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
    };
  
    return (
      <Modal
        isOpen={isOpen}
        onRequestClose={onClose}
        className={{
          base: 'Modal',
          afterOpen: 'Modal--after-open',
          beforeClose: 'Modal--before-close'
        }}
        overlayClassName={{
          base: 'Overlay',
          afterOpen: 'Overlay--after-open',
          beforeClose: 'Overlay--before-close'
        }}
      >
        <div id="riepilogo-print">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>📝 Riepilogo Prenotazione</h2>
            <button onClick={onClose} className="simple-btn">✖</button>
          </div>
  
          <div className="riepilogo-contenuto">
            {/* Cliente */}
            <div className="section" style={boxStyle}>
              <h3 style={titleStyle}>👤 Cliente</h3>
              <p><strong>Nome:</strong> {formData.cliente}</p>
              <p><strong>Codice Fiscale:</strong> {formData.codiceFiscale}</p>
              <p><strong>Patente:</strong> {formData.patente}</p>
              <p><strong>Email:</strong> {formData.emailCliente}</p>
            </div>
  
            {/* Veicolo */}
            <div className="section" style={boxStyle}>
              <h3 style={titleStyle}>🚗 Veicolo</h3>
              <p><strong>Modello:</strong> {formData.veicolo}</p>
              <p><strong>Targa:</strong> {formData.targa}</p>
              <p><strong>Dal:</strong> {formData.dataInizio}</p>
              <p><strong>Al:</strong> {formData.dataFine}</p>
              <p><strong>Prezzo Totale:</strong> <span style={{ color: 'green', fontWeight: 'bold' }}>{formData.prezzoTotale} €</span></p>
            </div>
  
            {/* Scheda Veicolo */}
            <div className="section" style={boxStyle}>
              <h3 style={titleStyle}>🧾 Scheda Veicolo</h3>
              <p><strong>Carburante:</strong> {schedaVeicolo.carburante}</p>
              <p><strong>Km Iniziali:</strong> {schedaVeicolo.kmIniziali}</p>
              <p><strong>Accessori:</strong></p>
              <ul style={{ paddingLeft: '20px' }}>
                {Object.entries(schedaVeicolo.accessori).map(([k, v]) => (
                  <li key={k}>{v ? '✅' : '❌'} {k.charAt(0).toUpperCase() + k.slice(1)}</li>
                ))}
              </ul>
              <p><strong>Danni:</strong> {schedaVeicolo.danni || 'Nessuno'}</p>
            </div>
  
            {/* Pulsanti */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
              <button onClick={onClose} style={cancelButtonStyle}>Annulla</button>
              <button onClick={handleConfirmClick} style={confirmButtonStyle}>Conferma</button>
              <button onClick={handlePrint} style={printButtonStyle}>Stampa</button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }
  
  export default RiepilogoPrenotazioneModal;