import React, { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Clock, Inbox, Info, Phone, X } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import Aiuto from './Aiuto';
import { dataEOra } from '../utils/scadenze';
import { euro } from '../utils/protezioni';
import { leggiPrezzo, richiesteDaGestire, sceltaRichiesta, tempoRimasto } from '../utils/richiesteSito';
import { confermaRichiestaSito, messaggioErroreRichiesta, rifiutaRichiestaSito } from '../lib/richiesteSito';
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
  const [daRifiutare, setDaRifiutare] = useState(null);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(null);

  if (richieste.length === 0) return null;

  const apriConferma = (p) => {
    setDaConfermare(p);
    setPrezzo(typeof p.totaleListino === 'number' && p.totaleListino > 0 ? String(p.totaleListino).replace('.', ',') : '');
    setErrore(null);
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
                <Clock size={15} aria-hidden="true" /> {tempo.testo}
              </span>
            </div>
            <div className="ric-azioni">
              <button type="button" className="ric-btn ric-btn--si" onClick={() => apriConferma(p)}>
                <Check size={18} aria-hidden="true" /> Conferma
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
