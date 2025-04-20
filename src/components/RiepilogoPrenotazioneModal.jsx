import React from 'react';
import Modal from 'react-modal';

function RiepilogoPrenotazioneModal({ isOpen, onClose, formData, schedaVeicolo, onConferma }) {
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
            ul { list-style: none; padding: 0; }
            li { margin: 2px 0; }
            </style>
        </head>
        <body>
            ${printContent.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
    };
    
return (
    
<Modal isOpen={isOpen} onRequestClose={onClose} className="Modal" overlayClassName="Overlay" 
style={{
    content:{
        maxWidth: '680px',      // più largo
        margin: 'auto',
        padding: '2rem',        // più spazio interno
        borderRadius: '12px',
        height: 'fit-content'
    }
}}>
    
    <div id = "riepilogo-print">
    <button onClick={onClose} style={{ float: 'right', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✖</button>
    <h2 style={{ marginBottom: '1rem' }}>📝 Riepilogo Prenotazione</h2>

    <div className="booking-summary" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
    
    {/* DATI CLIENTE */}
    <div className="section" style={boxStyle}>
        <h3 style={titleStyle}>👤 Cliente</h3>
        <p><strong>Nome:</strong> {formData.cliente}</p>
        <p><strong>Codice Fiscale:</strong> {formData.codiceFiscale}</p>
        <p><strong>Patente:</strong> {formData.patente}</p>
    </div>

    {/* DATI VEICOLO */}
    <div className="section" style={boxStyle}>
        <h3 style={titleStyle}>🚗 Veicolo</h3>
        <p><strong>Modello:</strong> {formData.veicolo}</p>
        <p><strong>Targa:</strong> {formData.targa}</p>
        <p><strong>Dal:</strong> {formData.dataInizio}</p>
        <p><strong>Al:</strong> {formData.dataFine}</p>
        <p><strong>Prezzo totale:</strong> <span style={{ fontWeight: 'bold', color: 'green' }}>{formData.prezzoTotale} €</span></p>
    </div>

    {/* SCHEDA VEICOLO */}
    <div className="section" style={boxStyle}>
        <h3 style={titleStyle}>🧾 Scheda Veicolo</h3>
        <p><strong>Carburante:</strong> {schedaVeicolo.carburante}</p>
        <p><strong>Km Iniziali:</strong> {schedaVeicolo.kmIniziali}</p>

        <p><strong>Accessori:</strong></p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
        {Object.entries(schedaVeicolo.accessori).map(([k, v]) => (
            <li key={k} style={{ color: v ? 'green' : 'red' }}>
            {v ? '✅' : '❌'} {k.charAt(0).toUpperCase() + k.slice(1)}
            </li>
        ))}
        </ul>

        <p><strong>Danni:</strong> {schedaVeicolo.danni || 'Nessuno'}</p>
    </div>

    {/* PULSANTI */}
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button onClick={onClose} style={cancelButtonStyle}>❌ Annulla</button>
        <button onClick={onConferma} style={confirmButtonStyle}>✅ Conferma Prenotazione</button>
        <button onClick={handlePrint} style={printButtonStyle}>🖨️ Stampa Riepilogo</button>
    </div>
    </div>
        </div> 
</Modal>


);
}

// STILI INLINE
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
    padding: '0.4rem 0.8rem',
    fontSize: '0.8rem',
    borderRadius: '6px',
    cursor: 'pointer',
    border: 'none',
    
  };
  
  const cancelButtonStyle = {
    ...buttonBase,
    background: '#ccc',
    color: '#000'
  };
  
  const confirmButtonStyle = {
    ...buttonBase,
    background: 'green',
    color: '#fff'
  };
  
  const printButtonStyle = {
    ...buttonBase,
    background: '#007bff',
    color: 'white'
  };
  
 

  

export default RiepilogoPrenotazioneModal;
