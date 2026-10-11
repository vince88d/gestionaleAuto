import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { X } from 'lucide-react';
import { ascoltaEtaConducenti, salvaEtaConducenti } from '../lib/firestoreEtaConducenti';
import {
  ETA_MINIMA_LEGALE, ETA_LIMITE, chiedeEta, etaConducentiPerForm, etaSelezionabili,
  preparaEtaConducenti, supplementoGiovane, testoSpuntaEta, validaEtaConducenti,
} from '../utils/etaConducenti';
import { euro } from '../utils/protezioni';
import { CampoEuro } from '../components/CampiForm';
import './CatalogoOptional.css';
import './AddebitiRientro.css';
import './EtaConducenti.css';

const da = (inizio, fine) => Array.from({ length: Math.max(0, fine - inizio + 1) }, (_, i) => inizio + i);

function SceltaEta({ valore, opzioni, onChange, etichetta, errore }) {
  const lista = opzioni.includes(Number(valore)) || valore === '' ? opzioni : [Number(valore), ...opzioni];
  return (
    <select className="opt-input eta-select" value={valore} onChange={(e) => onChange(e.target.value)} aria-label={etichetta} aria-invalid={errore ? true : undefined}>
      {valore === '' && <option value="">—</option>}
      {lista.map((n) => <option key={n} value={String(n)}>{n}</option>)}
    </select>
  );
}

// Come lo vede il cliente sul sito, dalle impostazioni scritte (anche non salvate).
function Anteprima({ dati }) {
  if (!chiedeEta(dati)) {
    return (
      <p className="opt-esempio">
        <b>Sul sito</b> non si chiede l&apos;età: chi prenota deve solo essere maggiorenne.
      </p>
    );
  }
  const { eta, oltre } = etaSelezionabili(dati);
  const fasce = dati.attivo ? dati.fasce : [];
  return (
    <div className="opt-esempio eta-anteprima">
      <b>Come lo vede il cliente sul sito</b>
      <br />«{testoSpuntaEta(dati)}» (spunta già attiva: nessun supplemento).
      <br />Se la toglie sceglie la sua età da un elenco ({eta.slice(0, 3).join(', ')} … {eta[eta.length - 1]}
      {oltre !== null && <>, «Oltre {oltre} anni»</>}), senza prezzi.
      {oltre !== null && <> Oltre {oltre} anni non si prenota online: chiama la sede.</>}
      {fasce.length > 0 && <> Il supplemento lo vede alla fine, come riga «Giovane conducente».</>}
      {fasce.length > 0 && (
        <>
          <br />Esempio per 3 giorni: {fasce.map((f) => {
            const s = supplementoGiovane(dati, f.finoA, 3);
            return `${f.finoA} anni = ${euro(s.importo)}${s.alMassimo ? ' (massimo)' : ''}`;
          }).join(' · ')}.
        </>
      )}
      <br />Sotto i {dati.etaMinima} anni non si può prenotare.
    </div>
  );
}

// Scheda "Età dei conducenti" di Tariffe e optional: eta' minima e massima e
// supplemento al giorno per i conducenti giovani, a fasce, con un tetto
// facoltativo. Il sito la legge (documento pubblico impostazioni/etaConducenti).
// Mockup: formiarent-documenti/mockup/gestionale-giovane-conducente.html
function EtaConducenti() {
  const [salvati, setSalvati] = useState(null);
  const [esiste, setEsiste] = useState(true);
  const [form, setForm] = useState(null);
  const [erroreLettura, setErroreLettura] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tentato, setTentato] = useState(false);
  const modificatoRef = useRef(false);

  // Anche una fascia aggiunta ma ancora vuota conta: al salvataggio dice cosa manca.
  const modificato = Boolean(form && salvati)
    && JSON.stringify(form) !== JSON.stringify(etaConducentiPerForm(salvati.dati));
  modificatoRef.current = modificato;

  useEffect(() => ascoltaEtaConducenti(({ dati, esiste: c }) => {
    setSalvati({ dati });
    setEsiste(c);
    // Se nessuno sta scrivendo, il form segue i dati (anche da un'altra postazione).
    if (!modificatoRef.current) setForm(etaConducentiPerForm(dati));
  }, (e) => {
    console.error('Errore lettura età dei conducenti:', e);
    setErroreLettura(true);
  }), []);

  if (erroreLettura) return <p className="opt-errore">Non riesco a leggere le età dei conducenti. Ricarica la pagina.</p>;
  if (!form) return <p className="opt-nota">Caricamento…</p>;

  const errori = validaEtaConducenti(form);
  const mostra = (k) => (tentato ? errori[k] : undefined);
  const cambia = (campi) => setForm((f) => ({ ...f, ...campi }));
  const fascia = (i, campi) => setForm((f) => ({ ...f, fasce: f.fasce.map((x, j) => (j === i ? { ...x, ...campi } : x)) }));

  const minima = Number(form.etaMinima) || ETA_MINIMA_LEGALE;
  const massima = form.conMassima ? Number(form.etaMassima) || ETA_LIMITE : ETA_LIMITE;
  const etaFasce = da(minima, Math.max(minima, massima - 1));
  const aggiungiFascia = () => {
    const ultima = Math.max(minima - 1, ...form.fasce.map((f) => Number(f.finoA) || 0));
    const proposta = Math.min(ultima + 1, massima - 1);
    cambia({ fasce: [...form.fasce, { finoA: String(proposta), euroGiorno: '' }] });
  };

  const salva = async (e) => {
    e.preventDefault();
    setTentato(true);
    if (Object.keys(errori).length > 0) return;
    setSalvando(true);
    try {
      await salvaEtaConducenti(form);
      toast.success('Età dei conducenti salvate: il sito le usa già.');
      setTentato(false);
    } catch (err) {
      console.error('Errore salvataggio età dei conducenti:', err);
      toast.error('Età dei conducenti non salvate, riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const erroreLimiti = mostra('etaMinima') || mostra('etaMassima');

  return (
    <form className="opt" onSubmit={salva} noValidate aria-label="Età dei conducenti">
      <section className="opt-box eta-box">
        <div className="opt-box-testa">
          <h2 className="opt-box-titolo">Età dei conducenti</h2>
        </div>
        <p className="opt-nota eta-intro">
          Da che età si può noleggiare e quanto paga in più al giorno chi è giovane. Il sito e la Nuova prenotazione lo calcolano da soli.
        </p>
        {!esiste && (
          <p className="eta-avviso" role="status">
            Non ancora impostate: oggi si noleggia dai 18 anni, senza supplemento. Cambia quello che serve e premi «Salva».
          </p>
        )}

        <div className="add-campi">
          <div className="opt-campo">
            <span className="opt-titolo-campo">Età minima e massima</span>
            <div className="eta-riga">
              Si può noleggiare da
              <SceltaEta
                valore={form.etaMinima} opzioni={da(ETA_MINIMA_LEGALE, 30)} etichetta="Età minima"
                errore={mostra('etaMinima')} onChange={(v) => cambia({ etaMinima: v })}
              />
              anni
            </div>
            <div className="eta-riga">
              <label className="opt-spunta">
                <input type="checkbox" checked={form.conMassima} onChange={(e) => cambia({ conMassima: e.target.checked })} />
                fino a
              </label>
              {form.conMassima ? (
                <>
                  <SceltaEta
                    valore={form.etaMassima} opzioni={da(60, ETA_LIMITE)} etichetta="Età massima"
                    errore={mostra('etaMassima')} onChange={(v) => cambia({ etaMassima: v })}
                  />
                  anni
                </>
              ) : (
                <span className="opt-aiuto eta-aiuto-riga">nessun limite di età massima</span>
              )}
            </div>
            {erroreLimiti && <span className="opt-errore-campo" role="alert">{errori.etaMinima || errori.etaMassima}</span>}
          </div>

          <div className="opt-campo">
            <span className="opt-titolo-campo">Supplemento giovane conducente</span>
            <label className="opt-spunta">
              <input type="checkbox" checked={form.attivo} onChange={(e) => cambia({ attivo: e.target.checked })} />
              Applica un supplemento al giorno ai conducenti giovani
            </label>

            {form.attivo && (
              <>
                <div className="eta-fasce">
                  {form.fasce.map((f, i) => {
                    const erroreFascia = mostra(`fasce.${i}.finoA`) || mostra(`fasce.${i}.euroGiorno`);
                    return (
                      <div key={i} className={`eta-fascia ${erroreFascia ? 'eta-fascia--errore' : ''}`}>
                        <span className="eta-q">
                          Fino a
                          <SceltaEta
                            valore={f.finoA} opzioni={etaFasce} etichetta={`Fascia ${i + 1}: fino a quanti anni`}
                            errore={mostra(`fasce.${i}.finoA`)} onChange={(v) => fascia(i, { finoA: v })}
                          />
                          anni compresi
                        </span>
                        <span className="eta-q">
                          <span className="eta-euro">
                            <CampoEuro
                              id={`eta-fascia-${i}`} valore={f.euroGiorno} placeholder="15,00"
                              invalido={Boolean(mostra(`fasce.${i}.euroGiorno`))} onChange={(v) => fascia(i, { euroGiorno: v })}
                            />
                          </span>
                          <label htmlFor={`eta-fascia-${i}`}>al giorno</label>
                        </span>
                        <button
                          type="button" className="eta-togli" aria-label={`Togli la fascia ${i + 1}`}
                          onClick={() => cambia({ fasce: form.fasce.filter((_, j) => j !== i) })}
                        >
                          <X size={18} aria-hidden="true" />
                        </button>
                        {erroreFascia && (
                          <span className="opt-errore-campo eta-errore-fascia" role="alert">
                            {errori[`fasce.${i}.finoA`] || errori[`fasce.${i}.euroGiorno`]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {mostra('fasce') && <span className="opt-errore-campo" role="alert">{errori.fasce}</span>}
                <button type="button" className="eta-link" onClick={aggiungiFascia}>+ Aggiungi una fascia</button>
              </>
            )}
          </div>

          {form.attivo && (
            <div className="opt-campo">
              <label className="opt-spunta">
                <input type="checkbox" checked={form.conMassimo} onChange={(e) => cambia({ conMassimo: e.target.checked })} />
                Massimo a noleggio
              </label>
              <span className="opt-aiuto">Il supplemento non supera questa cifra, qualunque sia la durata.</span>
              {form.conMassimo && (
                <div className="add-riga">
                  <CampoEuro
                    id="eta-massimo" valore={form.massimo} placeholder="300,00"
                    invalido={Boolean(mostra('massimo'))} onChange={(v) => cambia({ massimo: v })}
                  />
                </div>
              )}
              {mostra('massimo') && <span className="opt-errore-campo" role="alert">{errori.massimo}</span>}
            </div>
          )}

          <Anteprima dati={preparaEtaConducenti(form)} />
        </div>

        <div className="add-piede eta-piede">
          {tentato && Object.keys(errori).length > 0 && <span className="opt-errore eta-piede-errore">Controlla i campi segnati.</span>}
          {modificato && (
            <button type="button" className="opt-btn" onClick={() => { setForm(etaConducentiPerForm(salvati.dati)); setTentato(false); }} disabled={salvando}>
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

export default EtaConducenti;
