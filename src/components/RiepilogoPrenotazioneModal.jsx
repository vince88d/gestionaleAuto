import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import '../components/riepilogoModal.css';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { useDispatch } from 'react-redux';
import { setPrenotazioni } from '../store/prenotazioniSlice';
import { readPrenotazioni, confermaPrenotazione as confermaPrenotazioneFirestore } from '../lib/firestorePrenotazioni';

const boxStyle = {
  border: '1px solid #ccc',
  borderRadius: '10px',
  padding: '1rem',
  background: '#f9f9f9',
  marginBottom: '1rem',
};

const titleStyle = {
  marginBottom: '0.5rem',
  color: '#333',
};

const buttonBase = {
  padding: '0.6rem 1.2rem',
  fontSize: '1rem',
  borderRadius: '8px',
  cursor: 'pointer',
  border: 'none',
  fontWeight: '600',
};

const cancelButtonStyle = {
  ...buttonBase,
  background: '#ccc',
  color: '#333',
};

const confirmButtonStyle = {
  ...buttonBase,
  background: '#28a745',
  color: '#fff',
};

const printButtonStyle = {
  ...buttonBase,
  background: '#007bff',
  color: '#fff',
};

function RiepilogoPrenotazioneModal({ isOpen, onClose, formData, schedaVeicolo, onConferma }) {
  const dispatch = useDispatch();
  const [ipPubblico, setIpPubblico] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [scaricaPdf, setScaricaPdf] = useState(true);
  const [apriEmail, setApriEmail] = useState(false);
  const [includiContrattoPdf, setIncludiContrattoPdf] = useState(true);
  const [contrattoSelezionato, setContrattoSelezionato] = useState(null);
  const [nomeContratto, setNomeContratto] = useState('');

  const datiScheda = schedaVeicolo || {
    carburante: '',
    kmIniziali: '',
    danni: '',
    accessori: {},
  };

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then((res) => res.json())
      .then((data) => setIpPubblico(data.ip))
      .catch((err) => console.warn('Errore ottenendo IP pubblico:', err));
  }, []);

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

  async function generaRiepilogoPdf(prenotazione, scheda) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    let y = 800;
    const lineSpacing = 18;
    const indent = 50;

    const drawTitle = (text) => {
      page.drawText(text, {
        x: indent,
        y,
        size: 20,
        font: bold,
        color: rgb(0.1, 0.2, 0.5),
      });
      y -= 30;
    };

    const drawSection = (title) => {
      page.drawText(title, {
        x: indent,
        y,
        size: 14,
        font: bold,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 20;
      page.drawLine({
        start: { x: indent, y },
        end: { x: 545, y },
        thickness: 0.8,
        color: rgb(0.8, 0.8, 0.8),
      });
      y -= 10;
    };

    const drawField = (label, value) => {
      page.drawText(`${label}:`, {
        x: indent,
        y,
        size: 12,
        font: bold,
        color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText(value || '-', {
        x: indent + 130,
        y,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
      y -= lineSpacing;
    };

    drawTitle('Riepilogo Prenotazione');
    drawSection('Cliente');
    drawField('Nome', prenotazione.cliente);
    drawField('Codice Fiscale', prenotazione.codiceFiscale);
    drawField('Patente', prenotazione.patente);
    drawField('Email', prenotazione.emailCliente);

    drawSection('Veicolo');
    drawField('Modello', prenotazione.veicolo);
    drawField('Targa', prenotazione.targa);
    drawField('Periodo', `dal ${prenotazione.dataInizio} al ${prenotazione.dataFine}`);
    drawField('Prezzo Totale', `${prenotazione.prezzoTotale} EUR`);

    drawSection('Scheda Veicolo');
    drawField('Carburante', scheda.carburante);
    drawField('Km Iniziali', scheda.kmIniziali);
    drawField('Danni', scheda.danni || 'Nessuno');

    if (scheda.accessori && Object.keys(scheda.accessori).length) {
      drawField('Accessori', '');
      Object.entries(scheda.accessori)
        .filter(([key]) => key !== 'altro')
        .forEach(([key, value]) => {
          page.drawText(`- ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value ? 'SI' : 'NO'}`, {
            x: indent + 20,
            y,
            size: 11,
            font,
            color: rgb(0.1, 0.1, 0.1),
          });
          y -= 14;
        });

      if (scheda.accessori.altro) {
        page.drawText(`- ${scheda.accessori.altro}: SI`, {
          x: indent + 20,
          y,
          size: 11,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= 14;
      }
    }

    y -= 30;
    page.drawLine({
      start: { x: indent, y },
      end: { x: indent + 250, y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    page.drawText('Firma Cliente', {
      x: indent,
      y: y - 15,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    return doc.save();
  }

  const handleConferma = async () => {
    if (isSending) return;
    setIsSending(true);
    toast.dismiss();

    try {
      const riepilogoBuffer = await generaRiepilogoPdf(formData, datiScheda);
      const prenotazione = {
        ...formData,
        schedaVeicolo: datiScheda,
      };

      const result = await confermaPrenotazioneFirestore({
        prenotazione,
        ip: ipPubblico || 'Non disponibile',
      });

      if (!result.success) {
        toast.error(result.message || 'Errore durante la conferma');
        return;
      }

      const riepilogoArray = Array.from(new Uint8Array(riepilogoBuffer));
      const contrattoDaSalvare = includiContrattoPdf && contrattoSelezionato
        ? Array.from(new Uint8Array(contrattoSelezionato))
        : null;

      let documentiSalvati = [];

      if (scaricaPdf) {
        const saveResult = await window.electronAPI.salvaDocumentiPrenotazione({
          prenotazione,
          riepilogoPdf: riepilogoArray,
          contrattoPdf: contrattoDaSalvare,
          nomeContratto,
        });

        if (saveResult.cancelled) {
          toast.info('Salvataggio PDF annullato.');
        } else if (!saveResult.success) {
          toast.error(saveResult.error || 'Errore durante il salvataggio dei PDF');
        } else {
          documentiSalvati = saveResult.paths || [];
        }
      }

      if (apriEmail) {
        const allegatiText = documentiSalvati.length > 0
          ? `\n\nDocumenti salvati:\n${documentiSalvati.join('\n')}\n\nAllega questi file prima di inviare l'email.`
          : '\n\nSe vuoi allegare il riepilogo o il contratto, salvali prima dal gestionale.';

        const emailResult = await window.electronAPI.apriBozzaEmail({
          to: prenotazione.emailCliente || '',
          subject: `Riepilogo prenotazione veicolo - ${prenotazione.targa}`,
          body:
            `Gentile ${prenotazione.cliente},` +
            `\n\nIn allegato trovi il riepilogo della tua prenotazione.` +
            `${contrattoDaSalvare ? '\nSe necessario, allega anche il contratto personalizzato.' : ''}` +
            `\n\nPeriodo: dal ${prenotazione.dataInizio} al ${prenotazione.dataFine}` +
            `\nVeicolo: ${prenotazione.veicolo} (${prenotazione.targa})` +
            `\nPrezzo totale: ${prenotazione.prezzoTotale} EUR` +
            `\n\nGrazie.` +
            allegatiText,
        });

        if (!emailResult.success) {
          toast.error(emailResult.error || 'Impossibile aprire il client email');
        }
      }

      const prenotazioniAggiornate = await readPrenotazioni();
      dispatch(setPrenotazioni(prenotazioniAggiornate));
      toast.success('Prenotazione confermata.');

      if (onConferma) {
        await onConferma(result.booking);
      }
    } catch (err) {
      console.error('Errore durante la conferma:', err);
      toast.error('Errore imprevisto, guarda la console.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className={{
        base: 'Modal',
        afterOpen: 'Modal--after-open',
        beforeClose: 'Modal--before-close',
      }}
      overlayClassName={{
        base: 'Overlay',
        afterOpen: 'Overlay--after-open',
        beforeClose: 'Overlay--before-close',
      }}
    >
      <div id="riepilogo-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Riepilogo Prenotazione</h2>
          <button onClick={onClose} className="simple-btn">X</button>
        </div>

        <div className="riepilogo-contenuto" style={{ marginTop: '1rem' }}>
          <div className="section" style={boxStyle}>
            <h3 style={titleStyle}>Cliente</h3>
            <p><strong>Nome:</strong> {formData.cliente}</p>
            <p><strong>Codice Fiscale:</strong> {formData.codiceFiscale}</p>
            <p><strong>Patente:</strong> {formData.patente}</p>
            <p><strong>Email:</strong> {formData.emailCliente}</p>
          </div>

          <div className="section" style={boxStyle}>
            <h3 style={titleStyle}>Veicolo</h3>
            <p><strong>Modello:</strong> {formData.veicolo}</p>
            <p><strong>Targa:</strong> {formData.targa}</p>
            <p><strong>Dal:</strong> {formData.dataInizio}</p>
            <p><strong>Al:</strong> {formData.dataFine}</p>
            <p><strong>Prezzo Totale:</strong> <span style={{ color: 'green', fontWeight: 'bold' }}>{formData.prezzoTotale} EUR</span></p>
          </div>

          <div className="section" style={boxStyle}>
            <h3 style={titleStyle}>Scheda Veicolo</h3>
            <p><strong>Carburante:</strong> {datiScheda.carburante}</p>
            <p><strong>Km Iniziali:</strong> {datiScheda.kmIniziali}</p>
            <p><strong>Accessori:</strong></p>
            <ul style={{ paddingLeft: '20px' }}>
              {Object.entries(datiScheda.accessori).map(([key, value]) => (
                <li key={key}>{value ? 'SI' : 'NO'} {key.charAt(0).toUpperCase() + key.slice(1)}</li>
              ))}
            </ul>
            <p><strong>Danni:</strong> {datiScheda.danni || 'Nessuno'}</p>
          </div>

          <div style={boxStyle}>
            <h3 style={titleStyle}>Contratto Personalizzato</h3>
            <input
              type="file"
              accept="application/pdf"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error('Il file e troppo grande (max 5MB)');
                    return;
                  }

                  const arrayBuffer = await file.arrayBuffer();
                  setContrattoSelezionato(arrayBuffer);
                  setNomeContratto(file.name);
                  toast.success('Contratto caricato con successo!');
                } catch (err) {
                  console.error('Errore lettura file:', err);
                  toast.error('Errore nel caricamento del contratto');
                }
              }}
            />
            {contrattoSelezionato && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ color: 'green' }}>{nomeContratto} - Pronto</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={includiContrattoPdf}
                    onChange={(e) => setIncludiContrattoPdf(e.target.checked)}
                  />
                  Includi anche questo contratto nel download dei PDF
                </label>
                <button
                  onClick={() => {
                    setContrattoSelezionato(null);
                    setNomeContratto('');
                    setIncludiContrattoPdf(true);
                    toast.info('Contratto rimosso');
                  }}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.8rem',
                    backgroundColor: '#ff4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Rimuovi Contratto
                </button>
              </div>
            )}
          </div>

          <div style={boxStyle}>
            <h3 style={titleStyle}>Azioni Finali</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <input
                type="checkbox"
                checked={scaricaPdf}
                onChange={(e) => setScaricaPdf(e.target.checked)}
              />
              Scarica il PDF del riepilogo
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={apriEmail}
                onChange={(e) => setApriEmail(e.target.checked)}
              />
              Apri l&apos;email precompilata nel client del PC
            </label>
            <p style={{ color: '#666', marginTop: '0.75rem', fontSize: '0.9rem' }}>
              Se apri l&apos;email, il gestionale compila destinatario, oggetto e testo. Gli allegati vanno aggiunti dal client email.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', marginBottom: '1rem' }}>
            <button onClick={onClose} style={cancelButtonStyle}>Annulla</button>
            <button
              onClick={handleConferma}
              disabled={isSending}
              style={{
                ...confirmButtonStyle,
                opacity: isSending ? 0.6 : 1,
                cursor: isSending ? 'not-allowed' : 'pointer',
              }}
            >
              {isSending ? 'Attendi...' : 'Conferma'}
            </button>
            <button onClick={handlePrint} style={printButtonStyle}>Stampa</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default RiepilogoPrenotazioneModal;
