import React, { useRef } from 'react';
import Modal from 'react-modal';
import './InfoModal.css';
import { Pencil, Trash2, KeyRound, X, Download, FileText, Car, LogIn, Mail } from 'lucide-react';
import '../styles/Prenotazione.css';
import { dataEOra, formattaData } from '../utils/scadenze';
import { oraBreve } from '../utils/orari';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { isPagataOnline } from '../utils/pagamentoOnline';
import { eConsegnata, prossimoPasso } from '../utils/regolePrenotazione';
import { daAssegnare } from '../utils/assegnazioneVeicolo';
import { prezzoPrenotazione } from '../utils/dashboard';
import { salvaPdfConsegna } from '../utils/pdfConsegna';
import { toast } from 'react-toastify';
import ProtezioneExtraDettagli from './ProtezioneExtraDettagli';
import DotazioneConsegnata from './DotazioneConsegnata';
import RientroDettagli from './RientroDettagli';
import { salvaVerbaleRientro } from '../utils/pdfRientro';
import { bozzaEmail } from '../utils/emailRiepilogo';
import { useAzienda } from '../lib/firestoreAzienda';



// Riquadro in cima ai dettagli: la cosa da fare adesso, con il pulsante
// grande. Modifica e annullamento restano in basso come azioni secondarie.
function ProssimoPasso({ prenotazione, onScegliAuto, onConsegna, onConcludi }) {
  const passo = prossimoPasso(prenotazione);
  const auto = [prenotazione.veicolo, prenotazione.targa].filter(Boolean).join(' ');
  const riconsegna = prenotazione.oraFine
    ? `${formattaData(prenotazione.dataFine)} entro le ${oraBreve(prenotazione.oraFine)}`
    : formattaData(prenotazione.dataFine);

  const pezzi = {
    scegli: onScegliAuto && {
      tono: 'scegli',
      titolo: "Scegli quale auto dare al cliente",
      spiega: `Ha pagato dal sito la categoria «${prenotazione.categoria || '—'}». Dopo aver scelto l'auto potrai consegnarla.`,
      pulsante: <><Car size={18} aria-hidden="true" /> Scegli l&apos;auto</>,
      classe: 'vd-btn--scegli',
      azione: onScegliAuto,
    },
    consegna: onConsegna && {
      tono: 'consegna',
      titolo: "Consegna l'auto al cliente",
      spiega: `${auto} · ritiro ${dataEOra(prenotazione.dataInizio, prenotazione.oraInizio)}. Segnerai km, carburante, dotazione e firma.`,
      pulsante: <><KeyRound size={18} aria-hidden="true" /> Consegna l&apos;auto</>,
      classe: 'vd-btn--primario',
      azione: onConsegna,
    },
    ricevi: onConcludi && {
      tono: 'ricevi',
      titolo: "Ricevi l'auto quando torna",
      spiega: `${auto} · rientro ${riconsegna}. Segnerai km, carburante, dotazione, danni e cauzione.`,
      pulsante: <><LogIn size={18} aria-hidden="true" /> Ricevi l&apos;auto</>,
      classe: 'vd-btn--successo',
      azione: onConcludi,
    },
  }[passo];

  if (!pezzi) return null;
  return (
    <div className={`pp pp--${pezzi.tono}`}>
      <div className="pp-testi">
        <p className="pp-etichetta">Prossimo passo</p>
        <p className="pp-titolo">{pezzi.titolo}</p>
        <p className="pp-spiega">{pezzi.spiega}</p>
      </div>
      <button type="button" className={`vd-btn ${pezzi.classe}`} onClick={() => pezzi.azione(prenotazione)}>
        {pezzi.pulsante}
      </button>
    </div>
  );
}

function InfoModal({ isOpen, onClose, prenotazione, onModifica, onElimina, onConcludi, onConsegna, onScegliAuto, soloLettura = false }) {
  const printRef = useRef();
  const { dati: azienda } = useAzienda();

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
      const esito = await salvaPdfConsegna({ prenotazione, azienda });
      if (esito.success) toast.success('PDF della consegna salvato.');
      else if (!esito.cancelled) toast.error(esito.error || 'PDF non salvato.');
    } catch (error) {
      console.error('Errore PDF consegna:', error);
      toast.error('PDF non salvato.');
    }
  };

  const scaricaVerbaleRientro = async () => {
    try {
      const esito = await salvaVerbaleRientro(prenotazione, azienda);
      if (esito.success) toast.success('Verbale di rientro salvato.');
      else if (!esito.cancelled) toast.error(esito.error || 'Verbale non salvato.');
    } catch (error) {
      console.error('Errore verbale di rientro:', error);
      toast.error('Verbale non salvato.');
    }
  };

  // Salva il PDF, mostra il file nella cartella e apre l'email di riepilogo al
  // cliente: l'allegato si trascina a mano (nessun servizio di invio).
  const inviaEmail = async (fase) => {
    try {
      const esito = fase === 'rientro'
        ? await salvaVerbaleRientro(prenotazione, azienda)
        : await salvaPdfConsegna({ prenotazione, azienda });
      if (!esito.success) {
        if (!esito.cancelled) toast.error(esito.error || 'PDF non salvato.');
        return;
      }
      const risposta = await window.electronAPI.apriBozzaEmail({
        ...bozzaEmail({ fase, prenotazione, azienda }),
        mostraFile: esito.paths?.[0],
      });
      if (risposta?.success) toast.info("Il PDF è selezionato nella cartella: trascinalo nell'email.");
      else toast.error(risposta?.error || 'Impossibile aprire il programma di posta.');
    } catch (error) {
      console.error('Errore email di riepilogo:', error);
      toast.error('Email non preparata.');
    }
  };

  if (!prenotazione) return null;

  const scheda = prenotazione.schedaVeicolo || {};
  const consegnata = eConsegnata(prenotazione);
  const senzaAuto = daAssegnare(prenotazione);
  const fotoRiconsegna = [].concat(prenotazione.fotoDanni || []).filter(Boolean);
  const statoTesto = {
    completata: 'Conclusa',
    annullata: 'Annullata',
  }[prenotazione.status] || (senzaAuto ? 'Auto da scegliere' : consegnata ? 'Consegnata' : 'Da consegnare');

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
              {(senzaAuto ? prenotazione.categoria : prenotazione.veicolo) || prenotazione.categoria}{prenotazione.targa ? ` · ${prenotazione.targa}` : ''}
              {' · '}{dataEOra(prenotazione.dataInizio, prenotazione.oraInizio)} → {dataEOra(prenotazione.dataFine, prenotazione.oraFine)}
              {prenotazione.origine === 'sito' ? ' · dal sito' : ''}
            </span>
          </div>
          <button type="button" className="pz-chiudi" onClick={onClose} aria-label="Chiudi">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pz-corpo">
          {!soloLettura && (
            <ProssimoPasso
              prenotazione={prenotazione}
              onScegliAuto={onScegliAuto}
              onConsegna={onConsegna}
              onConcludi={onConcludi}
            />
          )}

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
              {senzaAuto ? (
                <>
                  <div><dt>Categoria pagata</dt><dd>{prenotazione.categoria || '—'}</dd></div>
                  <div><dt>Auto</dt><dd className="pz-da-scegliere">Da scegliere</dd></div>
                </>
              ) : (
                <>
                  <div><dt>Veicolo</dt><dd>{prenotazione.veicolo || '—'}</dd></div>
                  <div><dt>Targa</dt><dd>{prenotazione.targa || '—'}</dd></div>
                </>
              )}
              <div><dt>Prezzo</dt><dd className="pz-prezzo">€ {prezzoPrenotazione(prenotazione) || '—'}</dd></div>
              <div><dt>Ritiro</dt><dd>{dataEOra(prenotazione.dataInizio, prenotazione.oraInizio)}</dd></div>
              <div><dt>Riconsegna</dt><dd>{prenotazione.oraFine ? `${formattaData(prenotazione.dataFine)} entro le ${oraBreve(prenotazione.oraFine)}` : formattaData(prenotazione.dataFine)}</dd></div>
              <div><dt>Stato</dt><dd>{statoTesto}</dd></div>
            </dl>
          </section>

          <ProtezioneExtraDettagli prenotazione={prenotazione} />

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
                  {typeof prenotazione.cauzioneBloccata === 'boolean' && (
                    <div className="pz-intera">
                      <dt>Cauzione</dt>
                      <dd>{prenotazione.cauzioneBloccata ? 'Bloccata sulla carta alla consegna' : 'Non segnata come bloccata'}</dd>
                    </div>
                  )}
                </dl>
                <h4 className="pz-titolo-sezione" style={{ margin: '14px 0 8px' }}>Dotazione a bordo</h4>
                <DotazioneConsegnata scheda={scheda} />
                {scheda.fotoDanni && (
                  <div className="pz-foto"><img src={scheda.fotoDanni} alt="Danni alla consegna" /></div>
                )}
              </>
            ) : (
              <p className="pz-aiuto" style={{ fontSize: 14 }}>
                Non ancora consegnata: il giorno del ritiro usa «Consegna l'auto» per km, carburante, dotazione e contratto.
              </p>
            )}
          </section>

          <RientroDettagli prenotazione={prenotazione} />

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
          {consegnata && window.electronAPI?.apriBozzaEmail && (
            <button type="button" className="vd-btn" onClick={() => inviaEmail('consegna')}>
              <Mail size={16} aria-hidden="true" /> Email consegna
            </button>
          )}
          {prenotazione.rientro && window.electronAPI?.salvaDocumentiPrenotazione && (
            <button type="button" className="vd-btn" onClick={scaricaVerbaleRientro}>
              <FileText size={16} aria-hidden="true" /> Verbale di rientro (PDF)
            </button>
          )}
          {prenotazione.rientro && window.electronAPI?.apriBozzaEmail && (
            <button type="button" className="vd-btn" onClick={() => inviaEmail('rientro')}>
              <Mail size={16} aria-hidden="true" /> Email rientro
            </button>
          )}
          <span className="pz-piede-nota" />
          {!soloLettura && (
            <>
              <button type="button" className="vd-btn vd-btn--pericolo" onClick={() => onElimina(prenotazione)}>
                <Trash2 size={16} /> {isPagataOnline(prenotazione) ? 'Annulla e rimborsa' : 'Elimina'}
              </button>
              <button type="button" className="vd-btn" onClick={() => onModifica(prenotazione)}><Pencil size={16} /> Modifica</button>
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
      <span className="info-value">{dataEOra(prenotazione.dataInizio, prenotazione.oraInizio)}</span>
    </div>
    <div className="info-item">
      <span className="info-label">Al</span>
      <span className="info-value">{dataEOra(prenotazione.dataFine, prenotazione.oraFine)}</span>
    </div>
    <div className="info-item">
      <span className="info-label">Prezzo</span>
      <span className="info-value">{prezzoPrenotazione(prenotazione)} €</span>
    </div>
  </div>


{prenotazione.schedaVeicolo && (
  <>
    <h4 style={{ marginTop: '10px' }}>Dotazione a bordo</h4>
    <DotazioneConsegnata scheda={prenotazione.schedaVeicolo} />
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
