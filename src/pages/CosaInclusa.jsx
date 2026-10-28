import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ChevronDown, ChevronUp, Lock, X } from 'lucide-react';
import { ascoltaIncluso, salvaIncluso } from '../lib/firestoreIncluso';
import {
  MAX_TESTO_INCLUSO, MAX_VOCI_INCLUSO, inclusoPerForm, nuovaVoceIncluso, preparaIncluso, validaIncluso, vociInclusePerSito,
} from '../utils/incluso';
import './CatalogoOptional.css';
import './AddebitiRientro.css';
import './EtaConducenti.css';
import './CosaInclusa.css';
import { scorriAlPrimoErrore } from '../utils/scorriAlPrimoErrore';

// Le voci che il sito aggiunge da solo: dipendono da altre schede, non si scrivono qui.
const AUTOMATICHE = [
  { id: 'cancellazione', testo: 'Cancellazione gratuita fino a 48 ore prima', da: 'Regola del sito' },
  { id: 'pagamento', testo: 'Pagamento: «Niente da pagare online» o «Pagamento sicuro con carta»', da: 'Da «Prezzi sul sito»' },
  { id: 'km', testo: 'Chilometraggio (illimitato o la formula scelta dal cliente)', da: 'Da «Chilometri»' },
  { id: 'categoria', testo: 'Categoria scelta garantita', da: 'Automatica' },
];

// Scheda «Cosa è incluso» di Tariffe e optional: le voci che il sito mostra sotto
// «Incluso» nella tappa «Il tuo noleggio», con interruttore acceso/spento.
// Il sito le legge (documento pubblico impostazioni/incluso).
// Mockup: formiarent-documenti/mockup/sito-patente-e-incluso.html
function CosaInclusa() {
  const [salvati, setSalvati] = useState(null);
  const [esiste, setEsiste] = useState(true);
  const [form, setForm] = useState(null);
  const [erroreLettura, setErroreLettura] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tentato, setTentato] = useState(false);
  const modificatoRef = useRef(false);

  const modificato = Boolean(form && salvati)
    && JSON.stringify(form) !== JSON.stringify(inclusoPerForm(salvati.dati));
  modificatoRef.current = modificato;

  useEffect(() => ascoltaIncluso(({ dati, esiste: c }) => {
    setSalvati({ dati });
    setEsiste(c);
    // Se nessuno sta scrivendo, il form segue i dati (anche da un'altra postazione).
    if (!modificatoRef.current) setForm(inclusoPerForm(dati));
  }, (e) => {
    console.error('Errore lettura delle voci incluse:', e);
    setErroreLettura(true);
  }), []);

  if (erroreLettura) return <p className="opt-errore">Non riesco a leggere le voci incluse. Ricarica la pagina.</p>;
  if (!form) return <p className="opt-nota">Caricamento…</p>;

  const errori = validaIncluso(form);
  const cambiaVoce = (i, campi) => setForm((f) => ({ ...f, voci: f.voci.map((v, j) => (j === i ? { ...v, ...campi } : v)) }));
  const sposta = (i, verso) => setForm((f) => {
    const voci = [...f.voci];
    const j = i + verso;
    if (j < 0 || j >= voci.length) return f;
    [voci[i], voci[j]] = [voci[j], voci[i]];
    return { ...f, voci };
  });
  const aggiungi = () => setForm((f) => ({ ...f, voci: [...f.voci, nuovaVoceIncluso()] }));

  const salva = async (e) => {
    e.preventDefault();
    setTentato(true);
    if (Object.keys(errori).length > 0) {
      scorriAlPrimoErrore();
      return;
    }
    setSalvando(true);
    try {
      await salvaIncluso(form);
      toast.success('Voci salvate: il sito le usa già.');
      setTentato(false);
    } catch (err) {
      console.error('Errore salvataggio delle voci incluse:', err);
      toast.error('Voci non salvate, riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const sulSito = vociInclusePerSito(preparaIncluso(form));

  return (
    <form className="opt" onSubmit={salva} noValidate aria-label="Cosa è incluso nel noleggio">
      <section className="opt-box inc-box">
        <div className="opt-box-testa">
          <h2 className="opt-box-titolo">Cosa è incluso nel noleggio</h2>
        </div>
        <p className="opt-nota inc-intro">
          Queste voci compaiono sul sito, nella tappa «Il tuo noleggio», sotto «Incluso». Scrivi solo ciò che è davvero compreso nel prezzo: le cose a pagamento vanno negli Extra.
        </p>
        {!esiste && (
          <p className="inc-avviso" role="status">
            Non ancora scritte: oggi il sito mostra solo le voci automatiche. Aggiungi le tue e premi «Salva».
          </p>
        )}

        <div className="add-campi">
          <ul className="inc-lista" aria-label="Voci automatiche">
            {AUTOMATICHE.map((a) => (
              <li key={a.id} className="inc-riga inc-riga--auto">
                <Lock size={16} aria-hidden="true" className="inc-lucchetto" />
                <span className="inc-testo-auto">{a.testo}</span>
                <span className="inc-tag">{a.da}</span>
              </li>
            ))}
          </ul>

          <ul className="inc-lista" aria-label="Le tue voci">
            {form.voci.map((v, i) => {
              const errore = tentato ? errori[`voci.${i}`] : undefined;
              return (
                <li key={v.id} className={`inc-riga ${errore ? 'inc-riga--errore' : ''}`}>
                  <span className="inc-ordine">
                    <button type="button" className="inc-freccia" aria-label={`Sposta su la voce ${i + 1}`} disabled={i === 0} onClick={() => sposta(i, -1)}>
                      <ChevronUp size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="inc-freccia" aria-label={`Sposta giù la voce ${i + 1}`} disabled={i === form.voci.length - 1} onClick={() => sposta(i, 1)}>
                      <ChevronDown size={16} aria-hidden="true" />
                    </button>
                  </span>
                  <input
                    className="opt-input inc-input" value={v.testo} maxLength={MAX_TESTO_INCLUSO + 20}
                    placeholder="Es. Assicurazione RCA inclusa" aria-label={`Voce ${i + 1}`}
                    aria-invalid={errore ? true : undefined}
                    onChange={(e) => cambiaVoce(i, { testo: e.target.value })}
                  />
                  <button
                    type="button" role="switch" aria-checked={v.attiva} aria-label={`Mostra sul sito: voce ${i + 1}`}
                    className={`inc-interruttore ${v.attiva ? 'inc-interruttore--on' : ''}`}
                    onClick={() => cambiaVoce(i, { attiva: !v.attiva })}
                  />
                  <button
                    type="button" className="eta-togli" aria-label={`Togli la voce ${i + 1}`}
                    onClick={() => setForm((f) => ({ ...f, voci: f.voci.filter((_, j) => j !== i) }))}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                  {errore && <span className="opt-errore-campo inc-errore" role="alert">{errore}</span>}
                </li>
              );
            })}
          </ul>
          {form.voci.length < MAX_VOCI_INCLUSO && (
            <button type="button" className="eta-link" onClick={aggiungi}>+ Aggiungi una voce</button>
          )}
          <p className="opt-aiuto">Le voci spente restano salvate, ma il cliente non le vede.</p>

          <div className="opt-esempio" aria-live="polite">
            <b>Come lo vede il cliente sul sito</b>
            <br />
            {sulSito.length > 0
              ? <>In più delle voci automatiche: {sulSito.join(' · ')}.</>
              : <>Solo le voci automatiche.</>}
          </div>
        </div>

        <div className="add-piede">
          {tentato && Object.keys(errori).length > 0 && <span className="opt-errore add-piede-errore">Controlla le voci segnate.</span>}
          {modificato && (
            <button type="button" className="opt-btn" onClick={() => { setForm(inclusoPerForm(salvati.dati)); setTentato(false); }} disabled={salvando}>
              Annulla modifiche
            </button>
          )}
          <button type="submit" className="opt-btn opt-btn--salva" disabled={(!modificato && esiste) || salvando}>
            {salvando ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </section>
    </form>
  );
}

export default CosaInclusa;
