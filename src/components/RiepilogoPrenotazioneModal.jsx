import React, { useEffect, useRef, useState } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { FileText, Printer, Upload, X } from 'lucide-react';
import '../components/riepilogoModal.css';
import '../styles/Prenotazione.css';
import { PassiConsegna } from './SchedaModalOpen';
import { formattaData } from '../utils/scadenze';
import { registraConsegna, messaggioErrorePrenotazione } from '../lib/firestorePrenotazioni';
import { prezzoPrenotazione } from '../utils/dashboard';
import { salvaPdfConsegna } from '../utils/pdfConsegna';

const NOMI_ACCESSORI = {
  cric: 'Cric',
  triangolo: 'Triangolo',
  giubbotto: 'Giubbotto',
  ruotaScorta: 'Ruota di scorta',
  cavoRicarica: 'Cavo ricarica',
  cateneNeve: 'Catene da neve',
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
  const inputContratto = useRef(null);

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
        <title>Riepilogo consegna</title>
        <style>
          body { font-family: sans-serif; padding: 24px; color: #2c3e50; }
          h1 { font-size: 20px; margin: 0 0 16px; }
          h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: #7f8c9a; margin: 0 0 8px; }
          section { border: 1px solid #ddd; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; }
          dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; margin: 0; }
          dt { font-size: 11px; color: #7f8c9a; } dd { margin: 2px 0 0; font-weight: 600; }
          ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
          img { max-width: 240px; margin-top: 8px; }
          .firma { margin-top: 48px; border-top: 1px solid #000; width: 260px; padding-top: 4px; }
        </style>
      </head>
      <body><h1>Riepilogo consegna</h1>${printContent.innerHTML}<div class="firma">Firma del cliente</div></body>
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

  const accessoriPresenti = [
    ...Object.entries(datiScheda.accessori || {})
      .filter(([chiave, valore]) => chiave !== 'altro' && valore)
      .map(([chiave]) => NOMI_ACCESSORI[chiave] || chiave),
    ...(datiScheda.accessori?.altro ? [datiScheda.accessori.altro] : []),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Riepilogo consegna"
      className={{ base: 'Modal pz-modal', afterOpen: 'Modal--after-open', beforeClose: 'Modal--before-close' }}
      overlayClassName={{ base: 'Overlay', afterOpen: 'Overlay--after-open', beforeClose: 'Overlay--before-close' }}
    >
      <div className="pz">
        <header className="pz-testa">
          <div>
            <h2 className="pz-titolo">Riepilogo consegna</h2>
            <span className="pz-sottotitolo">Controlla i dati con il cliente, poi conferma.</span>
            <PassiConsegna attivo={consegnaSalvata ? 3 : 2} />
          </div>
          <button type="button" className="pz-chiudi" onClick={onClose} aria-label="Chiudi">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pz-corpo">
          {consegnaSalvata && (
            <p className="pz-avviso" role="status">
              <strong>✓ Consegna salvata.</strong>{' '}
              {pdfMancante
                ? 'Il PDF non è stato salvato: premi «Salva il PDF» per riprovare, oppure «Chiudi». Potrai scaricarlo anche dopo, dai dettagli della prenotazione.'
                : 'Ora puoi salvare il PDF o chiudere.'}
            </p>
          )}

          <div id="riepilogo-print" className="pz-corpo-stampa">
            <section className="pz-sezione">
              <h3 className="pz-titolo-sezione">Cliente</h3>
              <dl className="pz-dati">
                <div><dt>Nome</dt><dd>{formData.cliente || '—'}</dd></div>
                <div><dt>Codice fiscale</dt><dd>{formData.codiceFiscale || '—'}</dd></div>
                <div><dt>Patente</dt><dd>{formData.patente || '—'}</dd></div>
                <div className="pz-intera"><dt>Email</dt><dd>{formData.emailCliente || '—'}</dd></div>
              </dl>
            </section>

            <section className="pz-sezione">
              <h3 className="pz-titolo-sezione">Noleggio</h3>
              <dl className="pz-dati">
                <div><dt>Veicolo</dt><dd>{formData.veicolo || '—'}</dd></div>
                <div><dt>Targa</dt><dd>{formData.targa || '—'}</dd></div>
                <div><dt>Prezzo totale</dt><dd className="pz-prezzo">€ {prezzoTotale || '—'}</dd></div>
                <div><dt>Ritiro</dt><dd>{formattaData(formData.dataInizio)}</dd></div>
                <div><dt>Riconsegna</dt><dd>{formattaData(formData.dataFine)}</dd></div>
              </dl>
            </section>

            <section className="pz-sezione">
              <h3 className="pz-titolo-sezione">Stato del veicolo</h3>
              <dl className="pz-dati">
                <div><dt>Carburante</dt><dd>{datiScheda.carburante || '—'}</dd></div>
                <div><dt>Km alla consegna</dt><dd>{datiScheda.kmIniziali ? Number(datiScheda.kmIniziali).toLocaleString('it-IT') : '—'}</dd></div>
                <div><dt>Danni già presenti</dt><dd>{datiScheda.danni || 'Nessuno'}</dd></div>
                <div className="pz-intera">
                  <dt>Accessori a bordo</dt>
                  <dd>
                    {accessoriPresenti.length === 0 ? 'Nessuno' : (
                      <ul className="pz-chip-lista">
                        {accessoriPresenti.map((nome) => <li key={nome} className="pz-chip">✓ {nome}</li>)}
                      </ul>
                    )}
                  </dd>
                </div>
              </dl>
              {datiScheda.fotoDanni && (
                <div className="pz-foto"><img src={datiScheda.fotoDanni} alt="Danni alla consegna" /></div>
              )}
            </section>
          </div>

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Contratto personalizzato (facoltativo)</h3>
            <input
              ref={inputContratto}
              type="file"
              accept="application/pdf"
              hidden
              onChange={async (e) => {
                const file = e.target.files[0];
                e.target.value = '';
                if (!file) return;
                try {
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error('Il file è troppo grande (max 5MB)');
                    return;
                  }
                  setContrattoSelezionato(await file.arrayBuffer());
                  setNomeContratto(file.name);
                } catch (err) {
                  console.error('Errore lettura file:', err);
                  toast.error('Errore nel caricamento del contratto');
                }
              }}
            />
            {contrattoSelezionato ? (
              <div className="pz-barra-sezione" style={{ marginBottom: 0 }}>
                <span className="pz-chip"><FileText size={14} aria-hidden="true" /> {nomeContratto}</span>
                <button
                  type="button"
                  className="vd-btn vd-btn--pericolo vd-btn--piccolo"
                  onClick={() => {
                    setContrattoSelezionato(null);
                    setNomeContratto('');
                    setIncludiContrattoPdf(true);
                  }}
                >
                  Togli
                </button>
              </div>
            ) : (
              <button type="button" className="vd-btn" onClick={() => inputContratto.current?.click()}>
                <Upload size={16} aria-hidden="true" /> Carica il contratto (PDF)
              </button>
            )}
            {contrattoSelezionato && (
              <label className="pz-opzione" style={{ marginTop: 12 }}>
                <input type="checkbox" checked={includiContrattoPdf} onChange={(e) => setIncludiContrattoPdf(e.target.checked)} />
                Salvalo insieme al PDF del riepilogo
              </label>
            )}
          </section>

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Documenti</h3>
            <label className="pz-opzione">
              <input type="checkbox" checked={scaricaPdf} onChange={(e) => setScaricaPdf(e.target.checked)} />
              Salva il PDF del riepilogo (da stampare e far firmare)
            </label>
            <label className="pz-opzione">
              <input type="checkbox" checked={apriEmail} onChange={(e) => setApriEmail(e.target.checked)} />
              <span>
                Apri l&apos;email per il cliente
                <span className="pz-aiuto" style={{ display: 'block' }}>
                  Il gestionale compila destinatario, oggetto e testo; gli allegati li aggiungi dal programma di posta.
                </span>
              </span>
            </label>
          </section>
        </div>

        <footer className="pz-piede">
          <button type="button" className="vd-btn" onClick={handlePrint}>
            <Printer size={16} aria-hidden="true" /> Stampa
          </button>
          <span className="pz-piede-nota" />
          <button type="button" className="vd-btn" onClick={onClose}>{consegnaSalvata ? 'Chiudi' : 'Annulla'}</button>
          <button type="button" className="vd-btn vd-btn--successo" onClick={handleConferma} disabled={isSending}>
            {isSending ? 'Attendi…' : consegnaSalvata ? 'Salva il PDF' : 'Conferma consegna'}
          </button>
        </footer>
      </div>
    </Modal>
  );
}

export default RiepilogoPrenotazioneModal;
