import React, { useRef, useEffect } from 'react';
import Modal from 'react-modal';
import './InfoModal.css';
import { Pencil, Ban, KeyRound, X, Download, FileText, Car, LogIn, Mail, Copy, User, ShieldCheck, ClipboardCheck, Undo2, AlertTriangle, ChevronsUpDown } from 'lucide-react';
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
import RegistroNeopatentati from './RegistroNeopatentati';
import { salvaVerbaleRientro } from '../utils/pdfRientro';
import { bozzaEmail, testoRiepilogo } from '../utils/emailRiepilogo';
import MenuPulsante from './MenuPulsante';
import { useAzienda } from '../lib/firestoreAzienda';
import SezioneImpostazioni from './SezioneImpostazioni';
import { useSchedeAperte } from '../utils/useSchedeAperte';
import {
  schedeAperteIniziali, clienteDaCompletare, riassuntoCliente, riassuntoNoleggio, riassuntoProtezioneExtra,
  riassuntoConsegna, riassuntoRientro, riassuntoDanni,
} from '../utils/riassuntiPrenotazione';



// Riquadro in cima ai dettagli: la cosa da fare adesso, con il pulsante
// grande. Modifica e annullamento restano in basso come azioni secondarie.
function ProssimoPasso({ prenotazione, onScegliAuto, onConsegna, onConcludi, daCambiare, onCambiaAuto }) {
  const base = prossimoPasso(prenotazione);
  // Auto non adatta al cliente: prima si cambia l'auto, poi si consegna.
  const passo = daCambiare && base === 'consegna' && onCambiaAuto ? 'cambia' : base;
  const auto = [prenotazione.veicolo, prenotazione.targa].filter(Boolean).join(' ');
  const riconsegna = prenotazione.oraFine
    ? `${formattaData(prenotazione.dataFine)} entro le ${oraBreve(prenotazione.oraFine)}`
    : formattaData(prenotazione.dataFine);

  const pezzi = {
    scegli: onScegliAuto && {
      tono: 'scegli',
      titolo: "Scegli quale auto dare al cliente",
      spiega: prenotazione.richiestaSenzaPagamento
        ? `Ha chiesto dal sito la categoria «${prenotazione.categoria || '—'}» (paga al ritiro). Dopo aver scelto l'auto potrai consegnarla.`
        : `Ha pagato dal sito la categoria «${prenotazione.categoria || '—'}». Dopo aver scelto l'auto potrai consegnarla.`,
      pulsante: <><Car size={18} aria-hidden="true" /> Scegli l&apos;auto</>,
      classe: 'vd-btn--scegli',
      azione: onScegliAuto,
    },
    cambia: daCambiare && onCambiaAuto && {
      tono: 'scegli',
      titolo: "Cambia l'auto prima di consegnare",
      spiega: daCambiare.messaggio,
      pulsante: <><Car size={18} aria-hidden="true" /> Cambia auto</>,
      classe: 'vd-btn--scegli',
      azione: onCambiaAuto,
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

function InfoModal({ isOpen, onClose, prenotazione, onModifica, onElimina, onConcludi, onConsegna, onScegliAuto, daCambiare = null, onCambiaAuto, soloLettura = false }) {
  const printRef = useRef();
  const { dati: azienda } = useAzienda();
  // Schede richiudibili: si apre da sola quella che serve in quel momento
  // (consegna, rientro...); ogni volta che si apre un'altra prenotazione si riparte da li'.
  const schede = useSchedeAperte(schedeAperteIniziali(prenotazione || {}));
  const idPrenotazione = prenotazione?.id;
  const { reimposta } = schede;
  useEffect(() => {
    if (isOpen) reimposta();
    // Solo quando si apre la finestra o cambia prenotazione, non a ogni salvataggio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, idPrenotazione]);

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

  // Lo stesso riepilogo come testo da incollare (WhatsApp, SMS...).
  const copiaTesto = async (fase) => {
    try {
      await navigator.clipboard.writeText(testoRiepilogo({ fase, prenotazione, azienda }));
      toast.success('Testo copiato: incollalo dove vuoi.');
    } catch (error) {
      console.error('Testo non copiato:', error);
      toast.error('Non sono riuscito a copiare il testo.');
    }
  };

  if (!prenotazione) return null;

  // Finché c'è un «Prossimo passo» il pulsante grande in alto è l'azione principale.
  const haProssimoPasso = !soloLettura && Boolean({ scegli: onScegliAuto, consegna: onConsegna, ricevi: onConcludi }[prossimoPasso(prenotazione)]);
  const conPdf = Boolean(window.electronAPI?.salvaDocumentiPrenotazione);
  const conEmail = Boolean(window.electronAPI?.apriBozzaEmail);

  const scheda = prenotazione.schedaVeicolo || {};
  const consegnata = eConsegnata(prenotazione);
  const senzaAuto = daAssegnare(prenotazione);
  const conProtezioneExtra = Boolean(riassuntoProtezioneExtra(prenotazione));
  const fotoRiconsegna = [].concat(prenotazione.fotoDanni || []).filter(Boolean);
  const statoTesto = {
    completata: 'Conclusa',
    annullata: 'Annullata',
  }[prenotazione.status] || (senzaAuto ? 'Auto da scegliere' : consegnata ? 'Consegnata' : 'Da consegnare');

  const datiClienteMancanti = clienteDaCompletare(prenotazione);
  const statoTono = prenotazione.status === 'annullata' ? 'attenzione' : prenotazione.status === 'completata' || consegnata ? 'ok' : 'neutro';

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
            <p className="pz-sopratitolo">Prenotazione · {statoTesto}</p>
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
              daCambiare={daCambiare}
              onCambiaAuto={onCambiaAuto}
            />
          )}

          <div className="pz-barra-schede">
            <button type="button" className="vd-link" onClick={schede.apriChiudiTutte}>
              <ChevronsUpDown size={15} aria-hidden="true" /> {schede.tutteAperte ? 'Chiudi tutte' : 'Apri tutte'}
            </button>
          </div>

          {/* Prima della consegna conta l'auto, le date e il prezzo: il Noleggio sta sopra il Cliente. */}
          {consegnata || prenotazione.status === 'completata' || prenotazione.status === 'annullata' ? <>
          <SezioneImpostazioni
            className="imp-acc--compatta" Icona={User} titolo="Cliente"
            riassunto={riassuntoCliente(prenotazione)} stato={datiClienteMancanti ? { testo: 'Da completare', tono: 'attenzione' } : null}
            aperta={schede.aperta('cliente')} onToggle={schede.toggle('cliente')}
          >
            <dl className="pz-dati">
              <div><dt>Nome</dt><dd>{prenotazione.cliente || '—'}</dd></div>
              <div><dt>Codice fiscale</dt><dd>{prenotazione.codiceFiscale || '—'}</dd></div>
              <div><dt>Patente</dt><dd>{prenotazione.patente || '—'}</dd></div>
              <div className="pz-intera"><dt>Email</dt><dd>{prenotazione.emailCliente || '—'}</dd></div>
            </dl>
          </SezioneImpostazioni>

          <SezioneImpostazioni
            className="imp-acc--compatta" Icona={Car} titolo="Noleggio"
            riassunto={riassuntoNoleggio(prenotazione)} stato={{ testo: statoTesto, tono: statoTono }}
            aperta={schede.aperta('noleggio')} onToggle={schede.toggle('noleggio')}
          >
            <dl className="pz-dati">
              {senzaAuto ? (
                <>
                  <div><dt>{prenotazione.richiestaSenzaPagamento ? 'Categoria chiesta' : 'Categoria pagata'}</dt><dd>{prenotazione.categoria || '—'}</dd></div>
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
              {prenotazione.chilometri?.nome && (
                <div>
                  <dt>Chilometri</dt>
                  <dd>
                    {prenotazione.chilometri.nome}
                    {prenotazione.chilometri.kmInclusi ? ` · ${prenotazione.chilometri.kmInclusi.toLocaleString('it-IT')} km inclusi` : ''}
                    {prenotazione.chilometri.kmInclusi && prenotazione.chilometri.euroKmInPiu
                      ? ` · poi ${prenotazione.chilometri.euroKmInPiu.toLocaleString('it-IT', { minimumFractionDigits: 2 })} € al km` : ''}
                  </dd>
                </div>
              )}
              <div><dt>Stato</dt><dd>{statoTesto}</dd></div>
            </dl>
          </SezioneImpostazioni>

          </> : <>
          <SezioneImpostazioni
            className="imp-acc--compatta" Icona={Car} titolo="Noleggio"
            riassunto={riassuntoNoleggio(prenotazione)} stato={{ testo: statoTesto, tono: statoTono }}
            aperta={schede.aperta('noleggio')} onToggle={schede.toggle('noleggio')}
          >
            <dl className="pz-dati">
              {senzaAuto ? (
                <>
                  <div><dt>{prenotazione.richiestaSenzaPagamento ? 'Categoria chiesta' : 'Categoria pagata'}</dt><dd>{prenotazione.categoria || '—'}</dd></div>
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
              {prenotazione.chilometri?.nome && (
                <div>
                  <dt>Chilometri</dt>
                  <dd>
                    {prenotazione.chilometri.nome}
                    {prenotazione.chilometri.kmInclusi ? ` · ${prenotazione.chilometri.kmInclusi.toLocaleString('it-IT')} km inclusi` : ''}
                    {prenotazione.chilometri.kmInclusi && prenotazione.chilometri.euroKmInPiu
                      ? ` · poi ${prenotazione.chilometri.euroKmInPiu.toLocaleString('it-IT', { minimumFractionDigits: 2 })} € al km` : ''}
                  </dd>
                </div>
              )}
              <div><dt>Stato</dt><dd>{statoTesto}</dd></div>
            </dl>
          </SezioneImpostazioni>

          <SezioneImpostazioni
            className="imp-acc--compatta" Icona={User} titolo="Cliente"
            riassunto={riassuntoCliente(prenotazione)} stato={datiClienteMancanti ? { testo: 'Da completare', tono: 'attenzione' } : null}
            aperta={schede.aperta('cliente')} onToggle={schede.toggle('cliente')}
          >
            <dl className="pz-dati">
              <div><dt>Nome</dt><dd>{prenotazione.cliente || '—'}</dd></div>
              <div><dt>Codice fiscale</dt><dd>{prenotazione.codiceFiscale || '—'}</dd></div>
              <div><dt>Patente</dt><dd>{prenotazione.patente || '—'}</dd></div>
              <div className="pz-intera"><dt>Email</dt><dd>{prenotazione.emailCliente || '—'}</dd></div>
            </dl>
          </SezioneImpostazioni>

          </>}

          {conProtezioneExtra && (
            <SezioneImpostazioni
              className="imp-acc--compatta" Icona={ShieldCheck} titolo="Protezione ed extra"
              riassunto={riassuntoProtezioneExtra(prenotazione)} aperta={schede.aperta('protezione')} onToggle={schede.toggle('protezione')}
            >
              <ProtezioneExtraDettagli prenotazione={prenotazione} senzaCornice />
            </SezioneImpostazioni>
          )}

          <SezioneImpostazioni
            className="imp-acc--compatta" Icona={ClipboardCheck} titolo="Consegna"
            riassunto={riassuntoConsegna(prenotazione)} stato={consegnata ? { testo: 'Fatta', tono: 'ok' } : null}
            aperta={schede.aperta('consegna')} onToggle={schede.toggle('consegna')}
          >
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
                <RegistroNeopatentati registro={prenotazione.controlloNeopatentati} />
              </>
            ) : (
              <p className="pz-aiuto" style={{ fontSize: 14 }}>
                Non ancora consegnata: il giorno del ritiro usa «Consegna l'auto» per km, carburante, dotazione e contratto.
              </p>
            )}
          </SezioneImpostazioni>

          {(consegnata || prenotazione.rientro) && (
            <SezioneImpostazioni
              className="imp-acc--compatta" Icona={Undo2} titolo="Rientro"
              riassunto={riassuntoRientro(prenotazione)} stato={prenotazione.rientro ? { testo: 'Fatto', tono: 'ok' } : null}
              aperta={schede.aperta('rientro')} onToggle={schede.toggle('rientro')}
            >
              {prenotazione.rientro
                ? <RientroDettagli prenotazione={prenotazione} senzaCornice />
                : <p className="pz-aiuto" style={{ fontSize: 14 }}>Non ancora avvenuto: quando l&apos;auto torna usa «Ricevi l&apos;auto».</p>}
            </SezioneImpostazioni>
          )}

          {(prenotazione.descrizioneDanno || fotoRiconsegna.length > 0) && (
            <SezioneImpostazioni
              className="imp-acc--compatta" Icona={AlertTriangle} titolo="Danni alla riconsegna"
              riassunto={riassuntoDanni(prenotazione)}
              stato={prenotazione.daRiparare ? { testo: 'Da riparare', tono: 'attenzione' } : null}
              aperta={schede.aperta('danni')} onToggle={schede.toggle('danni')}
            >
              {prenotazione.descrizioneDanno && <p style={{ margin: 0 }}>{prenotazione.descrizioneDanno}</p>}
              {prenotazione.daRiparare && <p className="pz-errore" style={{ marginTop: 6 }}>Da riparare</p>}
              {fotoRiconsegna.length > 0 && (
                <div className="pz-foto">
                  {fotoRiconsegna.map((src, idx) => <img key={src} src={src} alt={`Danno ${idx + 1}`} />)}
                </div>
              )}
            </SezioneImpostazioni>
          )}
        </div>

        <footer className="pz-piede pz-piede--menu no-print">
          <MenuPulsante
            etichetta="Documenti" icona={<FileText size={16} aria-hidden="true" />}
            sezioni={[{
              titolo: 'Scarica il PDF',
              voci: [
                { etichetta: 'Dettagli della prenotazione', icona: <Download size={16} aria-hidden="true" />, onClick: handleDownloadPDF },
                { etichetta: 'Verbale di consegna', icona: <FileText size={16} aria-hidden="true" />, disattiva: !consegnata || !conPdf, nota: !consegnata ? 'non ancora avvenuta' : undefined, onClick: scaricaPdfConsegna },
                { etichetta: 'Verbale di rientro', icona: <FileText size={16} aria-hidden="true" />, disattiva: !prenotazione.rientro || !conPdf, nota: !prenotazione.rientro ? 'non ancora avvenuto' : undefined, onClick: scaricaVerbaleRientro },
              ],
            }]}
          />
          {consegnata && (
            <MenuPulsante
              etichetta="Invia riepilogo" icona={<Mail size={16} aria-hidden="true" />} primario={!haProssimoPasso}
              sezioni={[
                {
                  titolo: 'Per email',
                  nota: "Salva il PDF e apre il programma di posta: lo trascini nell'email.",
                  voci: [
                    { etichetta: 'Consegna', icona: <Mail size={16} aria-hidden="true" />, disattiva: !conEmail, onClick: () => inviaEmail('consegna') },
                    { etichetta: 'Rientro', icona: <Mail size={16} aria-hidden="true" />, disattiva: !conEmail || !prenotazione.rientro, nota: !prenotazione.rientro ? 'non ancora avvenuto' : undefined, onClick: () => inviaEmail('rientro') },
                  ],
                },
                {
                  titolo: 'Copia il testo (WhatsApp, SMS…)',
                  voci: [
                    { etichetta: 'Consegna', icona: <Copy size={16} aria-hidden="true" />, onClick: () => copiaTesto('consegna') },
                    { etichetta: 'Rientro', icona: <Copy size={16} aria-hidden="true" />, disattiva: !prenotazione.rientro, nota: !prenotazione.rientro ? 'non ancora avvenuto' : undefined, onClick: () => copiaTesto('rientro') },
                  ],
                },
              ]}
            />
          )}
          {!soloLettura && (
            <>
              <span className="pz-menu-spazio" />
              <button type="button" className="vd-btn" onClick={() => onModifica(prenotazione)}><Pencil size={16} aria-hidden="true" /> Modifica date o dati</button>
              <span className="pz-altre-azioni" role="group" aria-label="Altre azioni">
                <span className="pz-altre-azioni-titolo">Altre azioni</span>
                <button type="button" className="vd-btn vd-btn--pericolo" onClick={() => onElimina(prenotazione)}>
                  <Ban size={16} aria-hidden="true" /> {isPagataOnline(prenotazione) ? 'Annulla e rimborsa' : 'Annulla prenotazione'}
                </button>
              </span>
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
