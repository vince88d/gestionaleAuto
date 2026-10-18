import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { X } from 'lucide-react';
import { ascoltaAddebiti, salvaAddebiti } from '../lib/firestoreAddebiti';
import { useOrari } from '../lib/firestoreOrari';
import {
  ADDEBITI, MODI_VOCE, RITARDO, addebitiPerForm, nuovaVoce, preparaAddebiti, validaAddebiti, vociPerSito,
} from '../utils/addebiti';
import { CampoEuro } from '../components/CampiForm';
import { leggiEuro } from '../utils/protezioni';
import './CatalogoOptional.css';
import './AddebitiRientro.css';

// Scheda «Penali e addebiti» di Tariffe e optional: il listino. Importi fissi
// che il gestionale propone, gia' compilati, quando si riceve l'auto (si
// cambiano caso per caso) e voci libere del titolare. Con «Mostra sul sito» il
// cliente le legge nelle condizioni, prima di pagare. Il ritardo e' automatico.
// Mockup: formiarent-documenti/mockup/gestionale-listino-penali.html
function AddebitiRientro() {
  const [salvati, setSalvati] = useState(null); // null = in caricamento
  const [form, setForm] = useState(null);
  const [errore, setErrore] = useState('');
  const [tentato, setTentato] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const modificatoRef = useRef(false);
  const orari = useOrari();

  const modificato = Boolean(form && salvati) && JSON.stringify(form) !== JSON.stringify(addebitiPerForm(salvati));
  modificatoRef.current = modificato;

  useEffect(() => ascoltaAddebiti((dati) => {
    setSalvati(dati);
    // Se nessuno sta scrivendo, il form segue i dati (anche da un'altra postazione).
    if (!modificatoRef.current) setForm(addebitiPerForm(dati));
  }, (e) => {
    console.error('Errore lettura addebiti:', e);
    setErrore('Non riesco a leggere i prezzi. Ricarica la pagina.');
  }), []);

  if (errore) return <p className="opt-errore">{errore}</p>;
  if (!salvati || !form) return <p className="opt-nota">Caricamento…</p>;

  const errori = validaAddebiti(form);
  const mostra = (k) => (tentato ? errori[k] : undefined);
  const cambia = (campi) => setForm((f) => ({ ...f, ...campi }));
  const sito = (chiave, valore) => setForm((f) => ({ ...f, sito: { ...f.sito, [chiave]: valore } }));
  const voce = (i, campi) => setForm((f) => ({ ...f, voci: f.voci.map((v, j) => (j === i ? { ...v, ...campi } : v)) }));
  const anteprima = vociPerSito(preparaAddebiti(form), orari?.tolleranzaMinuti);

  const salva = async (e) => {
    e.preventDefault();
    setTentato(true);
    if (Object.keys(errori).length > 0) return;
    setSalvando(true);
    try {
      await salvaAddebiti(form);
      setTentato(false);
      toast.success('Penali e addebiti salvati.');
    } catch (err) {
      console.error('Errore salvataggio addebiti:', err);
      toast.error('Penali e addebiti non salvati, riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const Interruttore = ({ acceso, onChange, nome, bloccato }) => (
    <label className={`add-tg ${acceso && !bloccato ? 'add-tg--on' : ''} ${bloccato ? 'add-tg--dis' : ''}`}>
      <input type="checkbox" role="switch" checked={acceso && !bloccato} disabled={bloccato} onChange={(e) => onChange(e.target.checked)} aria-label={`Mostra sul sito: ${nome}`} />
      <span className="add-tg-sw" aria-hidden="true" />
      {acceso && !bloccato ? 'Sì' : 'No'}
    </label>
  );
  const gratis = (valore) => leggiEuro(valore) === 0;
  const unita = (u) => (u === '€' ? 'una volta' : u.replace('€ / ', 'per '));

  return (
    <form className="opt" onSubmit={salva} noValidate aria-label="Penali e addebiti">
      <p className="add-intro">
        Si scrivono una volta: quando ricevi l’auto vengono proposti già compilati e li puoi cambiare caso per caso.
        Con <b>«Il cliente la vede sul sito»</b> su Sì, li legge nelle condizioni prima di prenotare.
      </p>
      <div className="add-lay">
        <div className="add-colonna">
          <section className="opt-box add-box">
            <div className="add-testa">
              <h2 className="opt-box-titolo">Addebiti fissi</h2>
              <p>Importi che il gestionale propone al rientro dell’auto.</p>
            </div>
            <table className="add-tab">
              <thead><tr><th scope="col">Voce</th><th scope="col">Importo</th><th scope="col">Il cliente la vede sul sito</th></tr></thead>
              <tbody>
                {ADDEBITI.map(({ chiave, nome, aiuto, unita: u }) => (
                  <tr key={chiave}>
                    <td className="add-voce-nome-cella"><b>{nome}</b><span>{aiuto}</span></td>
                    <td>
                      <CampoEuro id={`add-${chiave}`} valore={form[chiave]} onChange={(v) => cambia({ [chiave]: v })} invalido={Boolean(mostra(chiave))} />
                      <label htmlFor={`add-${chiave}`} className="add-vis-nascosta">{nome}</label>
                      <span className="add-unita">{unita(u)}</span>
                      {mostra(chiave) && <span className="opt-errore-campo" role="alert">{mostra(chiave)}</span>}
                      {!mostra(chiave) && gratis(form[chiave]) && <span className="add-gratis">Importo 0: è gratis, non si mostra.</span>}
                    </td>
                    <td><Interruttore acceso={form.sito[chiave]} onChange={(x) => sito(chiave, x)} nome={nome} bloccato={gratis(form[chiave])} /></td>
                  </tr>
                ))}
                <tr>
                  <td className="add-voce-nome-cella"><b>{RITARDO.nome}</b><span>{RITARDO.aiuto}</span></td>
                  <td><span className="add-auto">Automatico</span></td>
                  <td><Interruttore acceso={form.sito.ritardo} onChange={(x) => sito('ritardo', x)} nome={RITARDO.nome} /></td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="opt-box add-box">
            <div className="add-testa">
              <h2 className="opt-box-titolo">Le tue voci</h2>
              <p>Altre penali o costi che applichi, per esempio fumo nell’auto, sabbia, pedaggi non pagati.</p>
            </div>
            {form.voci.map((v, i) => (
              <div key={v.id} className="add-voce">
                <div className="add-voce-riga">
                  <div className="add-voce-nome">
                    <label htmlFor={`add-voce-nome-${i}`} className="add-voce-et">Nome</label>
                    <input
                      id={`add-voce-nome-${i}`} type="text" className="opt-input" value={v.nome} placeholder="Es. Fumo nell’auto"
                      aria-invalid={mostra(`voci.${i}.nome`) ? true : undefined} onChange={(e) => voce(i, { nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor={`add-voce-importo-${i}`} className="add-voce-et">Importo</label>
                    <CampoEuro id={`add-voce-importo-${i}`} valore={v.importo} onChange={(x) => voce(i, { importo: x })} invalido={Boolean(mostra(`voci.${i}.importo`))} />
                  </div>
                  <div>
                    <label htmlFor={`add-voce-modo-${i}`} className="add-voce-et">Si applica</label>
                    <select id={`add-voce-modo-${i}`} className="opt-input" value={v.modo} onChange={(e) => voce(i, { modo: e.target.value })}>
                      {MODI_VOCE.map((m) => <option key={m.valore} value={m.valore}>{m.testo}</option>)}
                    </select>
                  </div>
                  <button type="button" className="add-togli" onClick={() => cambia({ voci: form.voci.filter((_, j) => j !== i) })}>
                    Togli<span className="add-vis-nascosta"> la voce {v.nome || i + 1}</span>
                  </button>
                </div>
                <div>
                  <label htmlFor={`add-voce-desc-${i}`} className="add-voce-et">Cosa legge il cliente <span className="add-fac">(facoltativo)</span></label>
                  <input
                    id={`add-voce-desc-${i}`} type="text" className="opt-input" value={v.descrizione} placeholder="Es. È vietato fumare nei veicoli."
                    onChange={(e) => voce(i, { descrizione: e.target.value })}
                  />
                </div>
                {(mostra(`voci.${i}.nome`) || mostra(`voci.${i}.importo`)) && (
                  <span className="opt-errore-campo" role="alert">{errori[`voci.${i}.nome`] || errori[`voci.${i}.importo`]}</span>
                )}
                {!mostra(`voci.${i}.importo`) && gratis(v.importo) && <span className="add-gratis">Importo 0: è gratis, non si mostra al cliente.</span>}
                <div className="add-voce-sito">
                  <span>Il cliente la vede sul sito:</span>
                  <Interruttore acceso={v.sito} onChange={(x) => voce(i, { sito: x })} nome={v.nome || `voce ${i + 1}`} bloccato={gratis(v.importo)} />
                </div>
              </div>
            ))}
            <div className="add-aggiungi">
              <button type="button" className="opt-btn" onClick={() => cambia({ voci: [...form.voci, nuovaVoce()] })}>+ Aggiungi una voce</button>
            </div>
          </section>
        </div>

        <aside className="add-anteprima" aria-label="Cosa legge il cliente">
          <h3>Cosa legge il cliente</h3>
          <p className="add-anteprima-d">Nelle condizioni sul sito, riga «Penali e costi aggiuntivi». Si aggiorna mentre scrivi.</p>
          {anteprima.length > 0 ? (
            <ul>
              {anteprima.map((r) => <li key={r.id}><b>{r.nome}</b><small>{r.testo}</small></li>)}
            </ul>
          ) : <p className="add-anteprima-d">Niente: nessuna voce è accesa, la riga non compare.</p>}
          <p className="add-anteprima-d">Cambiando un importo le riconsegne già registrate non cambiano.</p>
        </aside>
      </div>

      <div className="add-barra">
        <span className={modificato ? 'add-stato add-stato--mod' : 'add-stato'} role="status">
          {tentato && Object.keys(errori).length > 0 ? 'Controlla i campi segnati.' : modificato ? 'Modifiche non salvate' : 'Tutto salvato'}
        </span>
        <span className="add-azioni">
          {modificato && (
            <button type="button" className="opt-btn" onClick={() => { setForm(addebitiPerForm(salvati)); setTentato(false); }} disabled={salvando}>
              Annulla modifiche
            </button>
          )}
          <button type="submit" className="opt-btn opt-btn--salva" disabled={!modificato || salvando}>
            {salvando ? 'Salvo…' : 'Salva'}
          </button>
        </span>
      </div>
    </form>
  );
}

export default AddebitiRientro;
