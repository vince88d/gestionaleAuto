import React from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import "../components/riepilogoModal.css";
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { useDispatch } from 'react-redux';
import { setPrenotazioni } from '../store/prenotazioniSlice';

const boxStyle = {
  border: '1px solid #ccc',
  borderRadius: '10px',
  padding: '1rem',
  background: '#f9f9f9',
  marginBottom: '1rem',
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
  const dispatch = useDispatch();

  const [otpGenerato, setOtpGenerato] = useState('');
  const [otpInserito, setOtpInserito] = useState('');
  const [ipPubblico, setIpPubblico] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [otpInviato, setOtpInviato] = useState(false);
  const [inviaContratto, setInviaContratto] = useState(true);
  const [contrattoSelezionato, setContrattoSelezionato] = useState(null);
  const [nomeContratto, setNomeContratto] = useState('');
  const [inviaOtp, setInviaOtp] = useState(false);

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

  const datiScheda = schedaVeicolo || {
  carburante: '',
  kmIniziali: '',
  danni: '',
  accessori: {}
};


  function generaOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setIpPubblico(data.ip))
      .catch(err => console.warn("Errore ottenendo IP pubblico:", err));
  }, []);

  async function generaRiepilogoPdf(formData, datiScheda) {
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
      page.drawText(value || "-", {
        x: indent + 130,
        y,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      y -= lineSpacing;
    };

    drawTitle("Riepilogo Prenotazione");
    drawSection("Cliente");
    drawField("Nome", formData.cliente);
    drawField("Codice Fiscale", formData.codiceFiscale);
    drawField("Patente", formData.patente);
    drawField("Email", formData.emailCliente);

    drawSection("Veicolo");
    drawField("Modello", formData.veicolo);
    drawField("Targa", formData.targa);
    drawField("Periodo", `dal ${formData.dataInizio} al ${formData.dataFine}`);
    drawField("Prezzo Totale", `${formData.prezzoTotale} €`);

    drawSection("Scheda Veicolo");
    drawField("Carburante", datiScheda.carburante);
    drawField("Km Iniziali", datiScheda.kmIniziali);
    drawField("Danni", datiScheda.danni || "Nessuno");


if (datiScheda.accessori && Object.keys(datiScheda.accessori).length) {
  drawField("Accessori", "");

  Object.entries(datiScheda.accessori)
    .filter(([k]) => k !== 'altro') // esclude 'altro' dalla mappa
    .forEach(([k, v]) => {
      page.drawText(`• ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v ? "SI" : "NO"}`, {
        x: indent + 20,
        y,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 14;
    });

  // Stampa "Altro" solo se valorizzato
  if (datiScheda.accessori.altro) {
    page.drawText(`• ${datiScheda.accessori.altro}: SI`, {
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
    page.drawText("Firma Cliente", {
      x: indent,
      y: y - 15,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    return await doc.save();
  }

  const handleConferma = async () => {
    if (isSending) return;
    setIsSending(true);
    toast.dismiss();

    try {
      if (inviaOtp && otpInserito !== otpGenerato) {
        toast.error("OTP errato. Controlla il codice ricevuto via email.");
        return;
      }

      const azienda = JSON.parse(localStorage.getItem('datiAzienda'));
      const riepilogoBuffer = await generaRiepilogoPdf(formData, datiScheda);

      // Invia i dati al backend Electron
      const result = await window.electronAPI.confermaPrenotazione({
        prenotazione: formData,
        azienda,
        riepilogoPdf: Array.from(new Uint8Array(riepilogoBuffer)),
        contrattoPdf: contrattoSelezionato ? Array.from(new Uint8Array(contrattoSelezionato)) : null,
        nomeContratto,
        inviaContratto,
        otp: inviaOtp ? otpInserito : null,
        ip: ipPubblico || 'Non disponibile'
      });

      if (result.success) {
        // Aggiorna lo stato Redux se necessario
        const prenotazioniAggiornate = await window.electronAPI.readPrenotazioni();
        dispatch(setPrenotazioni(prenotazioniAggiornate));

        toast.success("Contratto inviato e conferma registrata ✅");
        onConferma();
      } else {
        toast.error(result.message || "Errore durante la conferma");
      }
    } catch (err) {
      console.error("Errore durante la conferma:", err);
      toast.error("Errore imprevisto, guarda la console.");
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
          <h2>📝 Riepilogo Prenotazione</h2>
          <button onClick={onClose} className="simple-btn">✖</button>
        </div>

        <div className="riepilogo-contenuto" style={{ marginTop: '1rem' }}>
          {/* Sezione Cliente */}
          <div className="section" style={boxStyle}>
            <h3 style={titleStyle}>👤 Cliente</h3>
            <p><strong>Nome:</strong> {formData.cliente}</p>
            <p><strong>Codice Fiscale:</strong> {formData.codiceFiscale}</p>
            <p><strong>Patente:</strong> {formData.patente}</p>
            <p><strong>Email:</strong> {formData.emailCliente}</p>
          </div>

          {/* Sezione Veicolo */}
          <div className="section" style={boxStyle}>
            <h3 style={titleStyle}>🚗 Veicolo</h3>
            <p><strong>Modello:</strong> {formData.veicolo}</p>
            <p><strong>Targa:</strong> {formData.targa}</p>
            <p><strong>Dal:</strong> {formData.dataInizio}</p>
            <p><strong>Al:</strong> {formData.dataFine}</p>
            <p><strong>Prezzo Totale:</strong> <span style={{ color: 'green', fontWeight: 'bold' }}>{formData.prezzoTotale} €</span></p>
          </div>

          {/* Sezione Scheda Veicolo */}
          <div className="section" style={boxStyle}>
            <h3 style={titleStyle}>🧾 Scheda Veicolo</h3>
            <p><strong>Carburante:</strong> {datiScheda.carburante}</p>
            <p><strong>Km Iniziali:</strong> {datiScheda.kmIniziali}</p>
            <p><strong>Accessori:</strong></p>
            <ul style={{ paddingLeft: '20px' }}>
              {Object.entries(datiScheda.accessori).map(([k, v]) => (
                <li key={k}>{v ? '✅' : '❌'} {k.charAt(0).toUpperCase() + k.slice(1)}</li>
              ))}
              {datiScheda.accessori.altro && (
               <li>✅ {datiScheda.accessori.altro}</li>
              )}
            </ul>
            <p><strong>Danni:</strong> {datiScheda.danni || 'Nessuno'}</p>
          </div>

          {/* Sezione OTP */}
                <div style={boxStyle}>
            <h3 style={titleStyle}>🔐 Verifica Cliente</h3>
            <label>
              <input
                type="checkbox"
                checked={inviaOtp}
                onChange={(e) => setInviaOtp(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Invia codice di verifica (OTP) via email al cliente
            </label>
          </div>

          {/* MODIFICA: La sezione OTP viene mostrata solo se la checkbox è selezionata */}
          {inviaOtp && (
            <div style={boxStyle}>
              <h3 style={titleStyle}>📨 Verifica OTP</h3>
              <label htmlFor="otp">Inserisci il codice ricevuto via email:</label>
              <input
                type="text"
                value={otpInserito}
                onChange={(e) => setOtpInserito(e.target.value)}
                placeholder="Es. 583294"
                style={{ padding: '0.5rem', marginTop: '0.5rem', width: '100%', borderRadius: '6px', border: '1px solid #ccc' }}
              />
              <button
                onClick={() => {
                  const newOtp = generaOTP();
                  setOtpGenerato(newOtp);
                  const azienda = JSON.parse(localStorage.getItem('datiAzienda'));
                  if (!azienda?.email || !azienda?.nome) {
                    toast.error("Dati azienda mancanti. Non è possibile inviare il codice.");
                    return;
                  }
                  window.electronAPI.sendOtp({
                    email: formData.emailCliente,
                    otp: newOtp,
                    sender: azienda
                  }).then((res) => {
                    if (res.success) {
                      setOtpInviato(true);
                      toast.success("Codice OTP inviato");
                    } else {
                      toast.error("Errore invio OTP");
                    }
                  }).catch((err) => {
                    console.error("Errore invio OTP:", err);
                    toast.error("Errore durante l'invio del codice.");
                  });
                }}
                style={{ marginTop: '1rem', padding: '0.4rem 1rem', borderRadius: '6px', backgroundColor: '#444', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                {otpInviato ? '🔁 Reinvia Codice' : '📨 Invia Codice'}
              </button>
            </div>
          )}

          {/* Sezione Contratto */}
          <div style={boxStyle}>
            <h3 style={titleStyle}>📄 Contratto Personalizzato</h3>
            <input
              type="file"
              accept="application/pdf"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                try {
                  // Verifica dimensione file (max 5MB)
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error("Il file è troppo grande (max 5MB)");
                    return;
                  }

                  const arrayBuffer = await file.arrayBuffer();
                  setContrattoSelezionato(arrayBuffer);
                  setNomeContratto(file.name);
                  toast.success("Contratto caricato con successo!");
                } catch (err) {
                  console.error("Errore lettura file:", err);
                  toast.error("Errore nel caricamento del contratto");
                }
              }}
            />
            {contrattoSelezionato && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ color: 'green' }}>✔ {nomeContratto} - Pronto per l'invio</p>
                <button 
                  onClick={() => {
                    setContrattoSelezionato(null);
                    setNomeContratto('');
                    toast.info("Contratto rimosso");
                  }}
                  style={{ 
                    marginTop: '0.5rem',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.8rem',
                    backgroundColor: '#ff4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Rimuovi Contratto
                </button>
              </div>
            )}
          </div>

          {/* Sezione Invio Contratto */}
          <div style={boxStyle}>
            <h3 style={titleStyle}>📎 Invio Contratto</h3>
            <label>
              <input
                type="checkbox"
                checked={inviaContratto}
                onChange={(e) => setInviaContratto(e.target.checked)}
                style={{ marginRight: '8px' }}
                disabled={!contrattoSelezionato}
              />
              Invia contratto via email al cliente
            </label>
            {!contrattoSelezionato && (
              <p style={{ color: '#ff9800', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                ⚠ Carica un contratto per abilitare l'invio
              </p>
            )}
          </div>

          {/* Pulsanti */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', marginBottom: '1rem' }}>
            <button onClick={onClose} style={cancelButtonStyle}>Annulla</button>
            <button
              onClick={handleConferma}
              disabled={
                isSending ||
                (inviaOtp && (!otpGenerato || otpInserito !== otpGenerato))
              }
              style={{
                ...confirmButtonStyle,
                opacity: isSending ? 0.6 : 1,
                cursor: isSending ? 'not-allowed' : 'pointer'
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