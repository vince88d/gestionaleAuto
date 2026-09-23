import React, { useRef } from 'react';
import Modal from 'react-modal';
import './InfoModal.css';
import { Pencil, Trash2, CheckCircle, KeyRound, X, Download, FileText } from 'lucide-react';
import '../styles/Prenotazione.css';
import { formattaData } from '../utils/scadenze';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { isPagataOnline } from '../utils/pagamentoOnline';
import { puoConcludere, puoConsegnare, eConsegnata } from '../utils/regolePrenotazione';
import { prezzoPrenotazione } from '../utils/dashboard';
import { salvaPdfConsegna } from '../utils/pdfConsegna';
import { toast } from 'react-toastify';


const NOMI_ACCESSORI = {
  cric: 'Cric',
  triangolo: 'Triangolo',
  giubbotto: 'Giubbotto',
  ruotaScorta: 'Ruota di scorta',
  cavoRicarica: 'Cavo ricarica',
  cateneNeve: 'Catene da neve',
};

function InfoModal({ isOpen, onClose, prenotazione, onModifica, onElimina, onConcludi, onConsegna, soloLettura = false }) {
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

  // Lo stesso PDF della consegna, da riscaricare quando serve.
  const scaricaPdfConsegna = async () => {
    try {
      const esito = await salvaPdfConsegna({ prenotazione });
      if (esito.success) toast.success('PDF della consegna salvato.');
      else if (!esito.cancelled) toast.error(esito.error || 'PDF non salvato.');
    } catch (error) {
      console.error('Errore PDF consegna:', error);
      toast.error('PDF non salvato.');
    }
  };

  if (!prenotazione) return null;

  const scheda = prenotazione.schedaVeicolo || {};
  const consegnata = eConsegnata(prenotazione);
  const fotoRiconsegna = [].concat(prenotazione.fotoDanni || []).filter(Boolean);
  const accessori = scheda.accessori
    ? [
        ...Object.entries(scheda.accessori)
          .filter(([k]) => k !== 'altro')
          .map(([k, v]) => ({ nome: NOMI_ACCESSORI[k] || k, presente: Boolean(v) })),
        ...(scheda.accessori.altro ? [{ nome: scheda.accessori.altro, presente: true }] : []),
      ]
    : [];
  const statoTesto = {
    completata: 'Conclusa',
    annullata: 'Annullata',
  }[prenotazione.status] || (consegnata ? 'Consegnata' : 'Da consegnare');

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Dettagli prenotazione"
      className={{ base: 'Modal pz-modal', afterOpen: 'Modal--after-open', beforeClose: 'Modal--before-close' }}
      overlayClassName={{ base: 'Overlay', afterOpen: 'Overlay--after-open', beforeClose: 'Overlay--before-close' }}
      ariaHideApp={false}
    >
      <div className="pz">
        <header className="pz-testa">
          <div>
            <h2 className="pz-titolo">{prenotazione.cliente || 'Prenotazione'}</h2>
            <span className="pz-sottotitolo">
              {prenotazione.veicolo || prenotazione.categoria}{prenotazione.targa ? ` · ${prenotazione.targa}` : ''}
              {' · '}{formattaData(prenotazione.dataInizio)} → {formattaData(prenotazione.dataFine)}
              {prenotazione.origine === 'sito' ? ' · dal sito' : ''}
            </span>
          </div>
          <button type="button" className="pz-chiudi" onClick={onClose} aria-label="Chiudi">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pz-corpo">
          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Cliente</h3>
            <dl className="pz-dati">
              <div><dt>Nome</dt><dd>{prenotazione.cliente || '—'}</dd></div>
              <div><dt>Codice fiscale</dt><dd>{prenotazione.codiceFiscale || '—'}</dd></div>
              <div><dt>Patente</dt><dd>{prenotazione.patente || '—'}</dd></div>
              <div className="pz-intera"><dt>Email</dt><dd>{prenotazione.emailCliente || '—'}</dd></div>
            </dl>
          </section>

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Noleggio</h3>
            <dl className="pz-dati">
              <div><dt>Veicolo</dt><dd>{prenotazione.veicolo || '—'}</dd></div>
              <div><dt>Targa</dt><dd>{prenotazione.targa || 'Da assegnare'}</dd></div>
              <div><dt>Prezzo</dt><dd className="pz-prezzo">€ {prezzoPrenotazione(prenotazione) || '—'}</dd></div>
              <div><dt>Ritiro</dt><dd>{formattaData(prenotazione.dataInizio)}</dd></div>
              <div><dt>Riconsegna</dt><dd>{formattaData(prenotazione.dataFine)}</dd></div>
              <div><dt>Stato</dt><dd>{statoTesto}</dd></div>
            </dl>
          </section>

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Consegna</h3>
            {consegnata ? (
              <>
                <dl className="pz-dati">
                  <div>
                    <dt>Consegnata il</dt>
                    <dd>{prenotazione.consegnataIl ? new Date(prenotazione.consegnataIl).toLocaleDateString('it-IT') : '—'}</dd>
                  </div>
                  <div><dt>Km alla consegna</dt><dd>{scheda.kmIniziali ? Number(scheda.kmIniziali).toLocaleString('it-IT') : '—'}</dd></div>
                  <div><dt>Carburante</dt><dd>{scheda.carburante || '—'}</dd></div>
                  <div className="pz-intera"><dt>Danni già presenti</dt><dd>{scheda.danni || 'Nessuno'}</dd></div>
                </dl>
                {accessori.length > 0 && (
                  <>
                    <h4 className="pz-titolo-sezione" style={{ margin: '14px 0 8px' }}>Accessori</h4>
                    <ul className="pz-chip-lista">
                      {accessori.map((a) => (
                        <li key={a.nome} className={`pz-chip ${a.presente ? '' : 'pz-chip--no'}`}>{a.nome}</li>
                      ))}
                    </ul>
                  </>
                )}
                {scheda.fotoDanni && (
                  <div className="pz-foto"><img src={scheda.fotoDanni} alt="Danni alla consegna" /></div>
                )}
              </>
            ) : (
              <p className="pz-aiuto" style={{ fontSize: 14 }}>
                Non ancora consegnata: il giorno del ritiro usa «Consegna» per km, carburante, accessori e contratto.
              </p>
            )}
          </section>

          {(prenotazione.descrizioneDanno || fotoRiconsegna.length > 0) && (
            <section className="pz-sezione">
              <h3 className="pz-titolo-sezione">Danni alla riconsegna</h3>
              {prenotazione.descrizioneDanno && <p style={{ margin: 0 }}>{prenotazione.descrizioneDanno}</p>}
              {prenotazione.daRiparare && <p className="pz-errore" style={{ marginTop: 6 }}>Da riparare</p>}
              {fotoRiconsegna.length > 0 && (
                <div className="pz-foto">
                  {fotoRiconsegna.map((src, idx) => <img key={src} src={src} alt={`Danno ${idx + 1}`} />)}
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="pz-piede no-print">
          <button type="button" className="vd-btn" onClick={handleDownloadPDF}>
            <Download size={16} aria-hidden="true" /> Dettagli (PDF)
          </button>
          {consegnata && window.electronAPI?.salvaDocumentiPrenotazione && (
            <button type="button" className="vd-btn" onClick={scaricaPdfConsegna}>
              <FileText size={16} aria-hidden="true" /> PDF della consegna
            </button>
          )}
          <span className="pz-piede-nota" />
          {!soloLettura && (
            <>
              <button type="button" className="vd-btn vd-btn--pericolo" onClick={() => onElimina(prenotazione)}>
                <Trash2 size={16} /> {isPagataOnline(prenotazione) ? 'Annulla e rimborsa' : 'Elimina'}
              </button>
              <button type="button" className="vd-btn" onClick={() => onModifica(prenotazione)}><Pencil size={16} /> Modifica</button>
              {puoConsegnare(prenotazione) && onConsegna && (
                <button type="button" className="vd-btn vd-btn--primario" onClick={() => onConsegna(prenotazione)}><KeyRound size={16} /> Consegna</button>
              )}
              {puoConcludere(prenotazione) && (
                <button type="button" className="vd-btn vd-btn--successo" onClick={() => onConcludi(prenotazione)}><CheckCircle size={16} /> Concludi</button>
              )}
            </>
          )}
        </footer>
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
      <span className="info-value">{prezzoPrenotazione(prenotazione)} €</span>
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
