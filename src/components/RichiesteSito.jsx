import React, { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Clock, Copy, Inbox, Info, Mail, Phone, X } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import Aiuto from './Aiuto';
import { dataEOra } from '../utils/scadenze';
import { euro } from '../utils/protezioni';
import {
  leggiPrezzo, ORE_PREVENTIVO, ORE_PREVENTIVO_DEFAULT, preventivoInviato, richiesteDaGestire, scadenzaPreventivo, sceltaRichiesta, tempoRimasto,
} from '../utils/richiesteSito';
import { confermaRichiestaSito, inviaPreventivoRichiesta, messaggioErroreRichiesta, rifiutaRichiestaSito } from '../lib/richiesteSito';
import './BookingModal.css';
import './RichiesteSito.css';

// «Richieste dal sito da confermare», in cima a Prenotazioni e Dashboard: i
// clienti che dal sito (modalita' «Solo richieste») hanno chiesto un'auto senza
// pagare. Lo staff li chiama, dice il prezzo e conferma o rifiuta. Ogni
// richiesta tiene l'auto per 24 ore: il tempo rimasto si vede.
// Non mostra nulla se non ce ne sono.
// Mockup: formiarent-documenti/mockup/gestionale-aiuti-e-richieste.html (parte C)
export default function RichiesteSito({ prenotazioni, oggi }) {
  // Si aggiorna ogni minuto per il conto alla rovescia.
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAdesso(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const richieste = useMemo(() => richiesteDaGestire(prenotazioni, adesso, oggi), [prenotazioni, adesso, oggi]);

  const [daConfermare, setDaConfermare] = useState(null);
  const [prezzo, setPrezzo] = useState('');
  // Preventivo con link: finestra con prezzo e validita'; dopo l'invio mostra l'esito.
  const [daPreventivare, setDaPreventivare] = useState(null);
  const [ore, setOre] = useState(ORE_PREVENTIVO_DEFAULT);
  const [esitoPreventivo, setEsitoPreventivo] = useState(null);
  const [linkCopiato, setLinkCopiato] = useState(false);
  const [daRifiutare, setDaRifiutare] = useState(null);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(null);

  if (richieste.length === 0) return null;

  const apriConferma = (p) => {
    setDaConfermare(p);
    setPrezzo(typeof p.totaleListino === 'number' && p.totaleListino > 0 ? String(p.totaleListino).replace('.', ',') : '');
    setErrore(null);
  };
  const apriPreventivo = (p) => {
    setDaPreventivare(p);
    setPrezzo(typeof p.totaleListino === 'number' && p.totaleListino > 0 ? String(p.totaleListino).replace('.', ',') : '');
    setOre(ORE_PREVENTIVO_DEFAULT);
    setEsitoPreventivo(null);
    setLinkCopiato(false);
    setErrore(null);
  };
  // inviaEmail false: solo il link, copiato negli appunti per mandarlo a mano (WhatsApp).
  const preventivo = async (inviaEmail) => {
    const totale = leggiPrezzo(prezzo);
    if (totale === null || totale < 1) { setErrore('Scrivi il prezzo concordato, almeno 1 €, ad esempio 285.'); return; }
    setInCorso(true);
    setErrore(null);
    try {
      const esito = await inviaPreventivoRichiesta(daPreventivare.id, totale, ore, inviaEmail);
      let copiato = false;
      if (!inviaEmail) {
        try { await navigator.clipboard.writeText(esito.link); copiato = true; } catch { copiato = false; }
      }
      setLinkCopiato(copiato);
      setEsitoPreventivo({ ...esito, inviaEmail });
    } catch (err) {
      setErrore(messaggioErroreRichiesta(err));
    } finally {
      setInCorso(false);
    }
  };
  const conferma = async () => {
    const totale = leggiPrezzo(prezzo);
    if (totale === null) { setErrore('Scrivi il prezzo che hai detto al cliente, ad esempio 135.'); return; }
    setInCorso(true);
    setErrore(null);
    try {
      await confermaRichiestaSito(daConfermare.id, totale);
      setDaConfermare(null);
    } catch (err) {
      setErrore(messaggioErroreRichiesta(err));
    } finally {
      setInCorso(false);
    }
  };
  const rifiuta = async () => {
    setInCorso(true);
    try {
      await rifiutaRichiestaSito(daRifiutare.id);
      setDaRifiutare(null);
    } catch (err) {
      window.alert(messaggioErroreRichiesta(err));
    } finally {
      setInCorso(false);
    }
  };

  return (
    <section className="ric" aria-label="Richieste dal sito da confermare">
      <div className="ric-testa">
        <span className="ric-icona" aria-hidden="true"><Inbox size={22} /></span>
        <h2 className="ric-titolo">
          Richieste dal sito da confermare <span className="ric-conto">{richieste.length}</span>
        </h2>
        <Aiuto titolo="Cosa sono?" esempio="Se non rispondi entro 24 ore la richiesta scade e l'auto torna libera.">
          Clienti che dal sito hanno chiesto un'auto. Non hanno pagato e non sanno il prezzo: chiamali, digli il prezzo e conferma.
        </Aiuto>
      </div>
      <p className="ric-cosa">
        <Info size={18} aria-hidden="true" />
        <span><b>Cosa fare:</b> chiama il cliente, digli il prezzo, poi premi «Conferma» se accetta o «Rifiuta» se non va bene.</span>
      </p>

      {richieste.map(({ prenotazione: p, scadeMs, scaduta }) => {
        const tempo = scaduta ? { testo: 'Scaduta: conferma solo se l\'auto è ancora libera', urgente: true } : tempoRimasto(scadeMs, adesso);
        const scelta = sceltaRichiesta(p);
        const inviato = preventivoInviato(p);
        return (
          <div key={p.id} className="ric-riga">
            <div className="ric-testi">
              <span className="ric-nome">{p.cliente || 'Cliente'}</span>
              <span className="ric-det">
                <b>{p.categoria || '—'}</b> · dal <b>{dataEOra(p.dataInizio, p.oraInizio)}</b> al <b>{dataEOra(p.dataFine, p.oraFine)}</b>
                {scelta && <> · {scelta}</>}
              </span>
              {p.note && <span className="ric-det">Note: «{p.note}»</span>}
              {p.telefono && (
                <a className="ric-tel" href={`tel:${String(p.telefono).replace(/\s/g, '')}`}>
                  <Phone size={18} aria-hidden="true" /> {p.telefono}
                </a>
              )}
              <span className={`ric-tempo ${tempo.urgente ? 'ric-tempo--urgente' : ''}`}>
                <Clock size={15} aria-hidden="true" /> {inviato !== null && !scaduta ? `Preventivo di ${euro(inviato)} inviato · ` : ''}{tempo.testo}
              </span>
            </div>
            <div className="ric-azioni">
              <button type="button" className="ric-btn ric-btn--si" onClick={() => apriConferma(p)}>
                <Check size={18} aria-hidden="true" /> Conferma, paga al ritiro
              </button>
              <button type="button" className="ric-btn ric-btn--prev" onClick={() => apriPreventivo(p)}>
                <Mail size={18} aria-hidden="true" /> {inviato !== null ? 'Nuovo preventivo con link' : 'Invia preventivo con link'}
              </button>
              <button type="button" className="ric-btn ric-btn--no" onClick={() => setDaRifiutare(p)}>
                <X size={18} aria-hidden="true" /> Rifiuta
              </button>
            </div>
          </div>
        );
      })}

      <Dialog.Root open={daConfermare !== null} onOpenChange={(v) => { if (!v && !inCorso) setDaConfermare(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="DialogOverlay" />
          <Dialog.Content className="DialogContent confirm-dialog">
            <Dialog.Title className="confirm-dialog-title">Conferma la richiesta di {daConfermare?.cliente || 'questo cliente'}</Dialog.Title>
            <Dialog.Description className="confirm-dialog-message">
              Diventa una prenotazione: il cliente riceve un'email con il prezzo, da pagare al ritiro.
            </Dialog.Description>
            <form onSubmit={(e) => { e.preventDefault(); conferma(); }}>
              <label className="ric-campo-etichetta" htmlFor="ric-prezzo">Prezzo concordato</label>
              <p className="ric-campo-aiuto" id="ric-prezzo-aiuto">
                Quello che hai detto al cliente al telefono, per tutto il noleggio.
                {typeof daConfermare?.totaleListino === 'number' && daConfermare.totaleListino > 0 && <> Da listino sarebbe {euro(daConfermare.totaleListino)}.</>}
              </p>
              <div className="ric-campo">
                <input id="ric-prezzo" inputMode="decimal" autoFocus aria-describedby="ric-prezzo-aiuto" value={prezzo}
                  onChange={(e) => setPrezzo(e.target.value)} />
                <span aria-hidden="true">€</span>
              </div>
              {errore && <p className="ric-errore" role="alert">{errore}</p>}
              <div className="confirm-dialog-actions">
                <button type="button" onClick={() => setDaConfermare(null)} disabled={inCorso} className="confirm-dialog-btn confirm-dialog-btn-secondary">Annulla</button>
                <button type="submit" disabled={inCorso} className="confirm-dialog-btn confirm-dialog-btn-primary">
                  {inCorso ? 'Conferma in corso…' : 'Conferma e avvisa il cliente'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={daPreventivare !== null} onOpenChange={(v) => { if (!v && !inCorso) setDaPreventivare(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="DialogOverlay" />
          <Dialog.Content className="DialogContent confirm-dialog">
            <Dialog.Title className="confirm-dialog-title">Preventivo per {daPreventivare?.cliente || 'questo cliente'}</Dialog.Title>
            {esitoPreventivo ? (
              <>
                <Dialog.Description className="confirm-dialog-message">
                  {esitoPreventivo.inviaEmail
                    ? (esitoPreventivo.emailInviata
                      ? 'Email inviata al cliente con il link per accettare e pagare.'
                      : 'Il preventivo è pronto ma l\'email non è partita (manca l\'indirizzo o la posta non risponde): usa «Copia link per WhatsApp» per mandarlo a mano.')
                    : (linkCopiato ? 'Link copiato: incollalo nel messaggio al cliente.' : 'Il preventivo è pronto, ma non riesco a copiare il link: usa «Copia link».')}
                  {' '}L'auto è tenuta fino a <b>{scadenzaPreventivo(0, esitoPreventivo.scadeIl)}</b>. Quando il cliente paga, la prenotazione passa da sola tra quelle attive.
                </Dialog.Description>
                <div className="confirm-dialog-actions">
                  <button type="button" className="confirm-dialog-btn confirm-dialog-btn-secondary"
                    onClick={async () => { try { await navigator.clipboard.writeText(esitoPreventivo.link); setLinkCopiato(true); } catch { setLinkCopiato(false); } }}>
                    <Copy size={16} aria-hidden="true" /> {linkCopiato ? 'Link copiato' : 'Copia link'}
                  </button>
                  <button type="button" className="confirm-dialog-btn confirm-dialog-btn-primary" onClick={() => setDaPreventivare(null)}>Chiudi</button>
                </div>
              </>
            ) : (
              <>
                <Dialog.Description className="confirm-dialog-message">
                  Il cliente riceve un link per vedere il preventivo, accettarlo e pagare online. Fino alla scadenza l'auto resta tenuta per lui.
                </Dialog.Description>
                <form onSubmit={(e) => { e.preventDefault(); preventivo(true); }}>
                  <label className="ric-campo-etichetta" htmlFor="ric-prev-prezzo">Prezzo concordato (tutto compreso)</label>
                  <p className="ric-campo-aiuto" id="ric-prev-aiuto">
                    {daPreventivare?.chilometri?.kmDichiarati ? <>Il cliente ha dichiarato <b>{daPreventivare.chilometri.kmDichiarati} km</b>: il loro prezzo lo scrivi tu nel totale. </> : null}
                    {typeof daPreventivare?.totaleListino === 'number' && daPreventivare.totaleListino > 0 && <>Da listino sarebbe {euro(daPreventivare.totaleListino)}.</>}
                  </p>
                  <div className="ric-campo">
                    <input id="ric-prev-prezzo" inputMode="decimal" autoFocus aria-describedby="ric-prev-aiuto" value={prezzo}
                      onChange={(e) => setPrezzo(e.target.value)} />
                    <span aria-hidden="true">€</span>
                  </div>
                  <span className="ric-campo-etichetta" id="ric-prev-validita">Il preventivo è valido per</span>
                  <div className="ric-seg" role="radiogroup" aria-labelledby="ric-prev-validita">
                    {ORE_PREVENTIVO.map((o) => (
                      <button key={o} type="button" role="radio" aria-checked={ore === o} className={`ric-seg-voce ${ore === o ? 'ric-seg-voce--on' : ''}`} onClick={() => setOre(o)}>
                        {o} ore
                      </button>
                    ))}
                  </div>
                  <p className="ric-campo-aiuto">Scade <b>{scadenzaPreventivo(ore, Date.now())}</b>. Dopo, l'auto torna libera e il cliente non può più pagare.</p>
                  {errore && <p className="ric-errore" role="alert">{errore}</p>}
                  <div className="confirm-dialog-actions">
                    <button type="button" onClick={() => setDaPreventivare(null)} disabled={inCorso} className="confirm-dialog-btn confirm-dialog-btn-secondary">Annulla</button>
                    <button type="button" onClick={() => preventivo(false)} disabled={inCorso} className="confirm-dialog-btn confirm-dialog-btn-secondary">
                      <Copy size={16} aria-hidden="true" /> Copia link per WhatsApp
                    </button>
                    <button type="submit" disabled={inCorso} className="confirm-dialog-btn confirm-dialog-btn-primary">
                      {inCorso ? 'Invio in corso…' : 'Invia email con il link'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={daRifiutare !== null}
        title={`Rifiutare la richiesta di ${daRifiutare?.cliente || 'questo cliente'}?`}
        message={daRifiutare?.status === 'scaduta'
          ? "L'auto è già libera. La richiesta sparisce dall'elenco."
          : "L'auto torna libera e il cliente riceve un'email gentile: può fare una nuova richiesta quando vuole."}
        cancelLabel="No, aspetta"
        confirmLabel={inCorso ? 'Un momento…' : 'Sì, rifiuta'}
        tone="danger"
        onCancel={() => { if (!inCorso) setDaRifiutare(null); }}
        onConfirm={rifiuta}
      />
    </section>
  );
}
