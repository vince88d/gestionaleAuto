import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import '../components/riepilogoModal.css';
import { registraConsegna, messaggioErrorePrenotazione } from '../lib/firestorePrenotazioni';
import { prezzoPrenotazione } from '../utils/dashboard';
import { salvaPdfConsegna } from '../utils/pdfConsegna';

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

// Secondo passo della consegna: riepilogo, contratto, PDF ed email. "Conferma
// consegna" salva la scheda sulla prenotazione (la prenotazione esiste gia').
function RiepilogoPrenotazioneModal({ isOpen, onClose, formData, schedaVeicolo, onConsegnaSalvata }) {
  const prezzoTotale = prezzoPrenotazione(formData);
  const [ipPubblico, setIpPubblico] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [scaricaPdf, setScaricaPdf] = useState(true);
  const [apriEmail, setApriEmail] = useState(false);
  const [includiContrattoPdf, setIncludiContrattoPdf] = useState(true);
  const [contrattoSelezionato, setContrattoSelezionato] = useState(null);
  const [nomeContratto, setNomeContratto] = useState('');
  const [consegnaSalvata, setConsegnaSalvata] = useState(false);
  const [pdfMancante, setPdfMancante] = useState(false);

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

  // Documenti dopo la consegna: PDF (e contratto) ed email. Si possono rifare
  // quante volte serve: non toccano piu' la prenotazione.
  // Restituisce true se il PDF richiesto e' stato salvato.
  const preparaDocumenti = async (prenotazione) => {
    const contrattoDaSalvare = includiContrattoPdf && contrattoSelezionato
      ? Array.from(new Uint8Array(contrattoSelezionato))
      : null;
    let documentiSalvati = [];
    let pdfOk = true;

    if (scaricaPdf) {
      const saveResult = await salvaPdfConsegna({
        prenotazione,
        scheda: datiScheda,
        contrattoPdf: contrattoDaSalvare,
        nomeContratto,
      });
      if (saveResult.success) {
        documentiSalvati = saveResult.paths || [];
      } else {
        pdfOk = false;
        if (!saveResult.cancelled) {
          toast.error(saveResult.error || 'Errore durante il salvataggio dei PDF');
        }
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
          `\nPrezzo totale: ${prezzoTotale} EUR` +
          `\n\nGrazie.` +
          allegatiText,
      });

      if (!emailResult.success) {
        toast.error(emailResult.error || 'Impossibile aprire il client email');
      }
    }
    return pdfOk;
  };

  // 1) salva la consegna (una volta sola), 2) PDF ed email.
  // Se il PDF non viene salvato (es. "Annulla" nella finestra di salvataggio)
  // la finestra resta aperta e dice chiaramente che la consegna e' salvata:
  // il PDF si riprova con "Salva il PDF" o si scarica poi dai dettagli.
  const handleConferma = async () => {
    if (isSending) return;
    setIsSending(true);
    toast.dismiss();

    const prenotazione = { ...formData, schedaVeicolo: datiScheda };
    try {
      if (!consegnaSalvata) {
        try {
          const campi = await registraConsegna({
            prenotazione,
            scheda: datiScheda,
            patente: formData.patente,
            ip: ipPubblico || 'Non disponibile',
          });
          setConsegnaSalvata(true);
          onConsegnaSalvata?.(campi);
        } catch (error) {
          console.error('Errore consegna:', error);
          toast.error(messaggioErrorePrenotazione(error, 'Consegna non salvata, riprova.'));
          return;
        }
      }

      const pdfOk = await preparaDocumenti(prenotazione);
      if (pdfOk) {
        toast.success(scaricaPdf ? 'Consegna salvata e PDF salvato.' : 'Consegna salvata.');
        onClose();
      } else {
        setPdfMancante(true);
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
          <h2>Riepilogo consegna</h2>
          <button onClick={onClose} className="simple-btn">X</button>
        </div>

        {consegnaSalvata && (
          <div role="status" style={{ marginTop: '1rem', padding: '0.85rem 1rem', borderRadius: 10, background: '#dcfce7', color: '#14532d', border: '1px solid #86efac' }}>
            <strong>✓ Consegna salvata.</strong>{' '}
            {pdfMancante
              ? 'Il PDF non è stato salvato: premi «Salva il PDF» per riprovare, oppure «Chiudi». Potrai scaricarlo anche dopo, dai dettagli della prenotazione.'
              : 'Ora puoi salvare il PDF o chiudere.'}
          </div>
        )}

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
            <p><strong>Prezzo Totale:</strong> <span style={{ color: 'green', fontWeight: 'bold' }}>{prezzoTotale} EUR</span></p>
          </div>

          <div className="section" style={boxStyle}>
            <h3 style={titleStyle}>Scheda Veicolo</h3>
            <p><strong>Carburante:</strong> {datiScheda.carburante}</p>
            <p><strong>Km alla consegna:</strong> {datiScheda.kmIniziali}</p>
            <p><strong>Accessori:</strong></p>
            <ul style={{ paddingLeft: '20px' }}>
              {Object.entries(datiScheda.accessori || {})
                .filter(([key]) => key !== 'altro')
                .map(([key, value]) => (
                  <li key={key}>{value ? 'SI' : 'NO'} {key.charAt(0).toUpperCase() + key.slice(1)}</li>
                ))}
              {datiScheda.accessori?.altro && <li>SI {datiScheda.accessori.altro}</li>}
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
            <button onClick={onClose} style={cancelButtonStyle}>{consegnaSalvata ? 'Chiudi' : 'Annulla'}</button>
            <button
              onClick={handleConferma}
              disabled={isSending}
              style={{
                ...confirmButtonStyle,
                opacity: isSending ? 0.6 : 1,
                cursor: isSending ? 'not-allowed' : 'pointer',
              }}
            >
              {isSending ? 'Attendi...' : consegnaSalvata ? 'Salva il PDF' : 'Conferma consegna'}
            </button>
            <button onClick={handlePrint} style={printButtonStyle}>Stampa</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default RiepilogoPrenotazioneModal;
