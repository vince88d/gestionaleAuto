import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { AlertTriangle, IdCard, Save, X } from 'lucide-react';
import { ascoltaEtaConducenti, salvaEtaConducenti } from '../lib/firestoreEtaConducenti';
import {
  ETA_MINIMA_LEGALE, ETA_LIMITE, chiedeEta, etaConducentiPerForm, etaSelezionabili,
  preparaEtaConducenti, supplementoGiovane, testoSpuntaEta, validaEtaConducenti,
} from '../utils/etaConducenti';
import { euro } from '../utils/protezioni';
import './OrariSede.css';
import './EtaConducenti.css';

const da = (inizio, fine) => Array.from({ length: Math.max(0, fine - inizio + 1) }, (_, i) => inizio + i);

function SceltaEta({ valore, opzioni, onChange, etichetta, errore }) {
  const lista = opzioni.includes(Number(valore)) || valore === '' ? opzioni : [Number(valore), ...opzioni];
  return (
    <select className={`or-select${errore ? ' imp-input--errore' : ''}`} value={valore} onChange={(e) => onChange(e.target.value)} aria-label={etichetta}>
      {valore === '' && <option value="">—</option>}
      {lista.map((n) => <option key={n} value={String(n)}>{n}</option>)}
    </select>
  );
}

// Come lo vede il cliente sul sito, dalle impostazioni scritte (anche non salvate).
function Anteprima({ dati }) {
  if (!chiedeEta(dati)) {
    return (
      <p className="or-anteprima">
        <b>Sul sito</b> non si chiede l&apos;età: chi prenota deve solo essere maggiorenne.
      </p>
    );
  }
  const { eta, oltre } = etaSelezionabili(dati);
  const fasce = dati.attivo ? dati.fasce : [];
  return (
    <div className="or-anteprima ec-anteprima">
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

// Sezione "Età dei conducenti" delle Impostazioni: eta' minima e massima e
// supplemento per i conducenti giovani a fasce, con un tetto facoltativo.
// Il sito la legge (documento pubblico impostazioni/etaConducenti).
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

  if (!form) {
    return (
      <section className="imp-sezione">
        <p className="imp-intro" style={{ margin: 0 }}>{erroreLettura ? 'Non riesco a leggere le età dei conducenti: controlla la connessione.' : 'Caricamento delle età dei conducenti…'}</p>
      </section>
    );
  }

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

  const salva = async () => {
    setTentato(true);
    if (Object.keys(errori).length > 0) return;
    setSalvando(true);
    try {
      await salvaEtaConducenti(form);
      toast.success('Età dei conducenti salvate: il sito le usa già.');
      setTentato(false);
    } catch (e) {
      console.error('Errore salvataggio età dei conducenti:', e);
      toast.error('Età dei conducenti non salvate, riprova.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="imp-sezione">
      <header className="imp-sezione-testa">
        <span className="imp-sezione-icona" aria-hidden="true"><IdCard size={18} /></span>
        <div>
          <h2>Età dei conducenti</h2>
          <p>Da che età si può noleggiare e quanto paga in più al giorno chi è giovane. Il sito e la Nuova prenotazione lo calcolano da soli.</p>
        </div>
      </header>

      {!esiste && (
        <div className="imp-avviso" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>Non ancora impostate: oggi si noleggia dai 18 anni, senza supplemento. Cambia quello che serve e premi «Salva».</span>
        </div>
      )}

      <p className="or-sotto">Età minima e massima</p>
      <div className="or-riga">
        Si può noleggiare da
        <SceltaEta
          valore={form.etaMinima} opzioni={da(ETA_MINIMA_LEGALE, 30)} etichetta="Età minima"
          errore={mostra('etaMinima')} onChange={(v) => cambia({ etaMinima: v })}
        />
        anni
        <label className="ec-check ec-check--a-destra">
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
          <span className="or-nota">nessun limite di età massima</span>
        )}
      </div>
      {(mostra('etaMinima') || mostra('etaMassima')) && <span className="imp-errore">{errori.etaMinima || errori.etaMassima}</span>}

      <p className="or-sotto">Supplemento giovane conducente</p>
      <label className="ec-check">
        <input type="checkbox" checked={form.attivo} onChange={(e) => cambia({ attivo: e.target.checked })} />
        Applica un supplemento al giorno ai conducenti giovani
      </label>

      {form.attivo && (
        <>
          <div className="ec-fasce">
            {form.fasce.map((f, i) => (
              <div key={i} className="ec-fascia">
                <span className="ec-q">
                  Fino a
                  <SceltaEta
                    valore={f.finoA} opzioni={etaFasce} etichetta={`Fascia ${i + 1}: fino a quanti anni`}
                    errore={mostra(`fasce.${i}.finoA`)} onChange={(v) => fascia(i, { finoA: v })}
                  />
                  anni compresi
                </span>
                <span className="ec-q">
                  <input
                    type="text" inputMode="decimal" className={`imp-input ec-euro${mostra(`fasce.${i}.euroGiorno`) ? ' imp-input--errore' : ''}`}
                    value={f.euroGiorno} placeholder="15,00" aria-label={`Fascia ${i + 1}: euro al giorno`}
                    onChange={(e) => fascia(i, { euroGiorno: e.target.value })}
                  />
                  € al giorno
                </span>
                <button
                  type="button" className="or-togli" aria-label={`Togli la fascia ${i + 1}`}
                  onClick={() => cambia({ fasce: form.fasce.filter((_, j) => j !== i) })}
                >
                  <X size={16} aria-hidden="true" />
                </button>
                {(mostra(`fasce.${i}.finoA`) || mostra(`fasce.${i}.euroGiorno`)) && (
                  <span className="imp-errore or-errore">{errori[`fasce.${i}.finoA`] || errori[`fasce.${i}.euroGiorno`]}</span>
                )}
              </div>
            ))}
          </div>
          {mostra('fasce') && <span className="imp-errore">{errori.fasce}</span>}
          <div className="or-azioni">
            <button type="button" className="or-link" onClick={aggiungiFascia}>+ Aggiungi una fascia</button>
          </div>

          <div className="or-riga ec-tetto">
            <label className="ec-check">
              <input type="checkbox" checked={form.conMassimo} onChange={(e) => cambia({ conMassimo: e.target.checked })} />
              Massimo a noleggio
            </label>
            {form.conMassimo && (
              <>
                <input
                  type="text" inputMode="decimal" className={`imp-input ec-euro${mostra('massimo') ? ' imp-input--errore' : ''}`}
                  value={form.massimo} placeholder="300,00" aria-label="Massimo a noleggio in euro"
                  onChange={(e) => cambia({ massimo: e.target.value })}
                />
                €
              </>
            )}
            <span className="or-nota">il supplemento non supera questa cifra, qualunque sia la durata</span>
          </div>
          {mostra('massimo') && <span className="imp-errore">{errori.massimo}</span>}
        </>
      )}

      <Anteprima dati={preparaEtaConducenti(form)} />

      <div className="imp-piede">
        {tentato && Object.keys(errori).length > 0 && <span className="imp-errore" style={{ marginRight: 'auto' }}>Controlla i campi segnati.</span>}
        {modificato && (
          <button type="button" className="imp-btn" onClick={() => { setForm(etaConducentiPerForm(salvati.dati)); setTentato(false); }} disabled={salvando}>
            Annulla modifiche
          </button>
        )}
        <button type="button" className="imp-btn imp-btn--primario" onClick={salva} disabled={(!modificato && esiste) || salvando}>
          <Save size={16} aria-hidden="true" /> {salvando ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>
    </section>
  );
}

export default EtaConducenti;
