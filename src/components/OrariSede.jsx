import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { AlertTriangle, Clock, Save, X } from 'lucide-react';
import { ascoltaOrari, salvaOrari } from '../lib/firestoreOrari';
import { GIORNI, oreImpostazioni, testoChiusure, testoSettimana, validaOrari, preparaOrari } from '../utils/orari';
import './OrariSede.css';

const FERIALI = ['mar', 'mer', 'gio', 'ven'];
const POMERIGGIO = { da: '15:00', a: '19:00' };
const copia = (x) => JSON.parse(JSON.stringify(x));
// Esempio con ritiro alle 9:00: "9:29", "10:00".
const entroLe = (t) => {
  const m = 9 * 60 + Math.max(0, Math.min(180, Number(t) || 0));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

function SceltaOra({ valore, onChange, etichetta }) {
  return (
    <select className="or-select" value={valore} onChange={(e) => onChange(e.target.value)} aria-label={etichetta}>
      {oreImpostazioni(valore).map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// Sezione "Orari della sede" delle Impostazioni: settimana, chiusure
// straordinarie e tolleranza alla riconsegna. Il sito li legge (documento
// pubblico impostazioni/orari). Mockup: formiarent-documenti/mockup/gestionale-orari.html
function OrariSede() {
  const [salvati, setSalvati] = useState(null);
  const [esiste, setEsiste] = useState(true);
  const [form, setForm] = useState(null);
  const [erroreLettura, setErroreLettura] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tentato, setTentato] = useState(false);
  const modificatoRef = useRef(false);

  // Anche una chiusura aggiunta ma ancora vuota conta: al salvataggio dice cosa manca.
  const modificato = Boolean(form && salvati)
    && (JSON.stringify(preparaOrari(form)) !== JSON.stringify(salvati) || form.chiusure.length !== salvati.chiusure.length);
  modificatoRef.current = modificato;

  useEffect(() => ascoltaOrari(({ orari, esiste: c }) => {
    setSalvati(orari);
    setEsiste(c);
    // Se nessuno sta scrivendo, il form segue i dati (anche da un'altra postazione).
    if (!modificatoRef.current) setForm(copia(orari));
  }, (e) => {
    console.error('Errore lettura orari:', e);
    setErroreLettura(true);
  }), []);

  if (!form) {
    return (
      <section className="imp-sezione">
        <p className="imp-intro" style={{ margin: 0 }}>{erroreLettura ? 'Non riesco a leggere gli orari: controlla la connessione.' : 'Caricamento degli orari…'}</p>
      </section>
    );
  }

  const errori = validaOrari(form);
  const mostra = (k) => tentato && errori[k];
  const giorno = (k, campi) => setForm((f) => ({ ...f, settimana: { ...f.settimana, [k]: { ...f.settimana[k], ...campi } } }));
  const fascia = (k, i, campi) => setForm((f) => {
    const fasce = f.settimana[k].fasce.map((x, j) => (j === i ? { ...x, ...campi } : x));
    return { ...f, settimana: { ...f.settimana, [k]: { ...f.settimana[k], fasce } } };
  });
  const apri = (k) => giorno(k, { aperto: true, fasce: form.settimana[k].fasce.length ? form.settimana[k].fasce : [{ da: '09:00', a: '13:00' }] });
  const copiaLunedi = () => setForm((f) => ({
    ...f,
    settimana: { ...f.settimana, ...Object.fromEntries(FERIALI.map((k) => [k, copia(f.settimana.lun)])) },
  }));
  const chiusura = (i, campi) => setForm((f) => ({ ...f, chiusure: f.chiusure.map((c, j) => (j === i ? { ...c, ...campi } : c)) }));

  const salva = async () => {
    setTentato(true);
    if (Object.keys(errori).length > 0) return;
    setSalvando(true);
    try {
      await salvaOrari(form);
      toast.success('Orari salvati: il sito li mostra già.');
      setTentato(false);
    } catch (e) {
      console.error('Errore salvataggio orari:', e);
      toast.error('Orari non salvati, riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const anteprima = preparaOrari(form);
  const chiusureTesto = testoChiusure(anteprima);

  return (
    <section className="imp-sezione">
      <header className="imp-sezione-testa">
        <span className="imp-sezione-icona" aria-hidden="true"><Clock size={18} /></span>
        <div>
          <h2>Orari della sede</h2>
          <p>Il sito li mostra ai clienti e fa scegliere ritiro e riconsegna solo quando la sede è aperta.</p>
        </div>
      </header>

      {!esiste && (
        <div className="imp-avviso" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>Orari non ancora salvati: questi sono quelli scritti oggi sul sito. Controllali e premi «Salva orari».</span>
        </div>
      )}

      <div className="or-settimana">
        {GIORNI.map(([k, nome]) => {
          const g = form.settimana[k];
          return (
            <div key={k} className={`or-giorno ${g.aperto ? '' : 'or-giorno--chiuso'}`}>
              <span className="or-nome">{nome}</span>
              <span className="or-stato" role="group" aria-label={`${nome}: aperto o chiuso`}>
                <button type="button" className={g.aperto ? 'or-si' : ''} aria-pressed={g.aperto} onClick={() => apri(k)}>Aperto</button>
                <button type="button" className={g.aperto ? '' : 'or-si or-chiuso'} aria-pressed={!g.aperto} onClick={() => giorno(k, { aperto: false })}>Chiuso</button>
              </span>
              <span className="or-fasce">
                {!g.aperto ? (
                  <span className="or-nota">Chiusa tutto il giorno</span>
                ) : (
                  <>
                    {g.fasce.map((f, i) => (
                      <span key={i} className="or-fascia">
                        <SceltaOra valore={f.da} onChange={(v) => fascia(k, i, { da: v })} etichetta={`${nome}, ${i === 0 ? 'mattina' : 'pomeriggio'}: apre alle`} />
                        –
                        <SceltaOra valore={f.a} onChange={(v) => fascia(k, i, { a: v })} etichetta={`${nome}, ${i === 0 ? 'mattina' : 'pomeriggio'}: chiude alle`} />
                        {i === 1 && (
                          <button type="button" className="or-togli" onClick={() => giorno(k, { fasce: [g.fasce[0]] })} aria-label={`${nome}: togli il pomeriggio`}>
                            <X size={16} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    ))}
                    {g.fasce.length === 1 && (
                      <button type="button" className="or-link" onClick={() => giorno(k, { fasce: [g.fasce[0], POMERIGGIO] })}>+ Pomeriggio</button>
                    )}
                  </>
                )}
              </span>
              {(mostra(`${k}.0`) || mostra(`${k}.1`)) && (
                <span className="imp-errore or-errore">{errori[`${k}.0`] || errori[`${k}.1`]}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="or-azioni">
        <button type="button" className="or-link" onClick={copiaLunedi}>Copia gli orari del lunedì su tutti i giorni feriali</button>
      </div>

      <p className="or-sotto">Chiusure straordinarie</p>
      {form.chiusure.length === 0 && <p className="or-nota">Nessuna: aggiungi festivi o ferie, sul sito non si potranno scegliere.</p>}
      <div className="or-chiusure">
        {form.chiusure.map((c, i) => (
          <div key={i} className="or-chiusura">
            <label className="or-mini">Dal
              <input type="date" className="imp-input" value={c.dal} onChange={(e) => chiusura(i, { dal: e.target.value })} />
            </label>
            <label className="or-mini">Al
              <input type="date" className="imp-input" value={c.al} min={c.dal || undefined} onChange={(e) => chiusura(i, { al: e.target.value })} />
            </label>
            <label className="or-mini or-mini--largo">Motivo
              <input type="text" className="imp-input" value={c.motivo} placeholder="Es. Ferragosto" onChange={(e) => chiusura(i, { motivo: e.target.value })} />
            </label>
            <button type="button" className="or-togli" onClick={() => setForm((f) => ({ ...f, chiusure: f.chiusure.filter((_, j) => j !== i) }))} aria-label="Togli questa chiusura">
              <X size={16} aria-hidden="true" />
            </button>
            {mostra(`chiusura.${i}`) && <span className="imp-errore or-errore">{errori[`chiusura.${i}`]}</span>}
          </div>
        ))}
      </div>
      <div className="or-azioni">
        <button type="button" className="or-link" onClick={() => setForm((f) => ({ ...f, chiusure: [...f.chiusure, { dal: '', al: '', motivo: '' }] }))}>
          + Aggiungi chiusura (un giorno o un periodo)
        </button>
      </div>

      <p className="or-sotto">Riconsegna</p>
      <label className="or-riga">
        Tolleranza:
        <input
          type="number"
          min="0"
          max="180"
          className={`imp-input or-tolleranza${mostra('tolleranza') ? ' imp-input--errore' : ''}`}
          value={form.tolleranzaMinuti}
          onChange={(e) => setForm((f) => ({ ...f, tolleranzaMinuti: e.target.value }))}
        />
        minuti
        <span className="or-nota">Oltre, al rientro si conta un giorno in più (es. ritiro alle 9:00, riconsegna entro le {entroLe(form.tolleranzaMinuti)}).</span>
      </label>
      {mostra('tolleranza') && <span className="imp-errore">{errori.tolleranza}</span>}

      <p className="or-anteprima">
        Sul sito si legge: <b>{testoSettimana(anteprima)}</b>
        {chiusureTesto && <> · chiuso {chiusureTesto}</>}
      </p>

      <div className="imp-piede">
        {tentato && Object.keys(errori).length > 0 && <span className="imp-errore" style={{ marginRight: 'auto' }}>Controlla gli orari segnati.</span>}
        {modificato && (
          <button type="button" className="imp-btn" onClick={() => { setForm(copia(salvati)); setTentato(false); }} disabled={salvando}>
            Annulla modifiche
          </button>
        )}
        <button type="button" className="imp-btn imp-btn--primario" onClick={salva} disabled={(!modificato && esiste) || salvando}>
          <Save size={16} aria-hidden="true" /> {salvando ? 'Salvataggio…' : 'Salva orari'}
        </button>
      </div>
    </section>
  );
}

export default OrariSede;
