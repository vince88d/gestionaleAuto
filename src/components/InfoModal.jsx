import React, { useRef } from 'react';
import Modal from 'react-modal';
import './InfoModal.css';
import { Pencil, Trash2, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { isPagataOnline } from '../utils/pagamentoOnline';
import { puoConcludere } from '../utils/regolePrenotazione';


function InfoModal({ isOpen, onClose, prenotazione, onModifica, onElimina, onConcludi, soloLettura = false }) {
  const printRef = useRef();
  

  // Qui c'era una sezione "Danni attivi sul veicolo" che leggeva il campo
  // `danniAttivi`, che nessuno scrive piu' (non mostrava mai nulla) e che per
  // segnare un danno riparato riscriveva tutta la flotta. I danni rilevati
  // alla riconsegna si vedono e si segnano riparati nella scheda del veicolo.


  const handleDownloadPDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const page1 = document.getElementById("pdf-page-1");
    const page2 = document.getElementById("pdf-page-2");

    const renderToPDF = async (element, addPage = false) => {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      if (addPage) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    };

    await renderToPDF(page1);
    await renderToPDF(page2, true);

    pdf.save(`Prenotazione_${prenotazione?.cliente || 'cliente'}.pdf`);
  };

  if (!prenotazione) return null;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Dettagli Prenotazione"
      className="info-modal"
      overlayClassName="modal-overlay"
      ariaHideApp={false}
    >


      <div className="modal-body">
        <div className="modal-header no-print">
  <button className="btn-close" onClick={onClose}>
    <svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" fill="none">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
</div>

        {/* CONTENUTO VISIBILE */}
        <h2>Dettagli Prenotazione</h2>
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
    <span className="info-value">{prenotazione.prezzoTotale}</span>
  </div>
</div>


{prenotazione.schedaVeicolo?.accessori && (
  <>
    <h4 style={{ marginTop: '10px' }}>Accessori</h4>
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      paddingLeft: '10px',
      marginTop: '10px'
    }}>
      {Object.entries(prenotazione.schedaVeicolo.accessori)
        .filter(([k]) => k !== "altro")
        .map(([k, v]) => (
          <span
            key={k}
            style={{
              background: '#f0f0f0',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '0.9rem',
              border: '1px solid #ccc'
            }}
          >
            {v ? '✅' : '❌'} {k.charAt(0).toUpperCase() + k.slice(1)}
          </span>
        ))}
      {prenotazione.schedaVeicolo.accessori.altro && (
        <span
          style={{
            background: '#f0f0f0',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '0.9rem',
            border: '1px solid #ccc'
          }}
        >
          ✅ {prenotazione.schedaVeicolo.accessori.altro}
        </span>
      )}
    </div>
  </>
)}

      
         
         {prenotazione.fotoDanni && (
  <div style={{ marginTop: '20px' }}>
    <h3>Immagini Danni</h3>
    {Array.isArray(prenotazione.fotoDanni) ? (
      prenotazione.fotoDanni.map((src, idx) => (
        <img
          key={idx}
          src={src}
          alt={`Danno ${idx + 1}`}
          style={{ width: '100%', marginBottom: '10px', borderRadius: '8px' }}
        />
      ))
    ) : (
      <img
        src={prenotazione.fotoDanni}
        alt="Danno"
        style={{ width: '100%', borderRadius: '8px' }}
      />
    )}
    {prenotazione.descrizioneDanno && (
  <div style={{ marginTop: '15px' }}>
    <h4>Descrizione del Danno</h4>
    <p>{prenotazione.descrizioneDanno}</p>
  </div>
)}

  </div>
)}

{prenotazione.schedaVeicolo?.fotoDanni && (
  <div style={{ marginTop: '20px' }}>
    <h3>Foto Veicolo</h3>
    <img
      src={prenotazione.schedaVeicolo.fotoDanni}
      alt="Foto Veicolo"
      style={{ width: '100%', borderRadius: '8px' }}
    />
  </div>
)}

        {/* Pulsanti */}
        {!soloLettura && (
          <div className="modal-footer no-print">
            <button className="btn btn-secondary" onClick={() => onModifica(prenotazione)}><Pencil size={16} /> Modifica</button>
            <button className="btn btn-danger" onClick={() => onElimina(prenotazione)}>
              <Trash2 size={16} /> {isPagataOnline(prenotazione) ? 'Annulla e rimborsa' : 'Elimina'}
            </button>
            {puoConcludere(prenotazione) && (
              <button className="btn btn-success" onClick={() => onConcludi(prenotazione)}><CheckCircle size={16} /> Concludi</button>
            )}
          </div>
        )}
        <div className="modal-footer no-print">
          <button className="btn btn-primary" onClick={handleDownloadPDF}>Scarica PDF</button>
        </div>
      </div>

      {/* CONTENUTO NASCOSTO PER IL PDF */}
  <div ref={printRef} style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
   <div id="pdf-page-1" className="modal-body" style={{ padding: '20px', width: '800px' }}>
  <h2>Dettagli Prenotazione</h2>
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


{prenotazione.schedaVeicolo?.accessori && (
  <>
    <h4 style={{ marginTop: '10px' }}>Accessori</h4>
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      paddingLeft: '10px',
      marginTop: '10px'
    }}>
      {Object.entries(prenotazione.schedaVeicolo.accessori)
        .filter(([k]) => k !== "altro")
        .map(([k, v]) => (
          <span
            key={k}
            style={{
              background: '#f0f0f0',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '0.9rem',
              border: '1px solid #ccc'
            }}
          >
            {v ? '✅' : '❌'} {k.charAt(0).toUpperCase() + k.slice(1)}
          </span>
        ))}
      {prenotazione.schedaVeicolo.accessori.altro && (
        <span
          style={{
            background: '#f0f0f0',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '0.9rem',
            border: '1px solid #ccc'
          }}
        >
          ✅ {prenotazione.schedaVeicolo.accessori.altro}
        </span>
      )}
    </div>
  </>
)}


  {prenotazione.daRiparare && (
    <p style={{ color: 'red', fontWeight: 'bold', marginTop: '10px' }}>
      ⚠️ Il danno richiede riparazione
    </p>
  )}
  {prenotazione.descrizioneDanno && (
  <div style={{ marginTop: '10px' }}>
    <h4 style={{ marginBottom: '5px' }}>Descrizione Danno</h4>
    <p>{prenotazione.descrizioneDanno}</p>
  </div>
)}

</div>
        <div id="pdf-page-2" className="modal-body" style={{ padding: '20px', width: '800px' }}>
          <h2>Immagini Danni</h2>
          
          {prenotazione.fotoDanni && (
            Array.isArray(prenotazione.fotoDanni) ? (
              prenotazione.fotoDanni.map((src, idx) => (
<img
  key={idx}
  src={src}
  alt={`Danno ${idx + 1}`}
  style={{ maxWidth: '300px', height: 'auto', marginBottom: '10px' }}
/>              ))
            ) : (
              <img src={prenotazione.fotoDanni} alt="Danno" style={{ width: '100%' }} />
            )
          )}
          {prenotazione.schedaVeicolo?.fotoDanni && (
            <>
              <h3>Foto Veicolo</h3>
              <img src={prenotazione.schedaVeicolo.fotoDanni} alt="Foto Danni" style={{ width: '100%' }} />
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default InfoModal;
