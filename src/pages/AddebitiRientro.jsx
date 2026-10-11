import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { X } from 'lucide-react';
import { ascoltaAddebiti, salvaAddebiti } from '../lib/firestoreAddebiti';
import { useOrari } from '../lib/firestoreOrari';
import {
  ADDEBITI, MODI_VOCE, RITARDO, addebitiPerForm, nuovaVoce, preparaAddebiti, validaAddebiti, vociPerSito,
} from '../utils/addebiti';
import { Campo, CampoEuro } from '../components/CampiForm';
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

  const MostraSulSito = ({ chiave, nome }) => (
    <label className="opt-spunta add-sito">
      <input type="checkbox" checked={form.sito[chiave]} onChange={(e) => sito(chiave, e.target.checked)} aria-label={`Mostra sul sito: ${nome}`} />
      Mostra sul sito
    </label>
  );

  return (
    <form className="opt" onSubmit={salva} noValidate aria-label="Penali e addebiti">
      <section className="opt-box add-box">
        <div className="opt-box-testa">
          <h2 className="opt-box-titolo">Penali e addebiti</h2>
        </div>
        <p className="opt-nota">
          Si scrivono una volta: quando ricevi l’auto vengono proposti già compilati e li puoi cambiare caso per caso.
          Con «Mostra sul sito» il cliente li legge nelle condizioni, prima di pagare.
        </p>
        <div className="add-campi">
          {ADDEBITI.map(({ chiave, nome, aiuto, unita }) => (
            <Campo key={chiave} id={`add-${chiave}`} titolo={nome} aiuto={aiuto} errore={mostra(chiave)}>
              <div className="add-riga">
                <CampoEuro id={`add-${chiave}`} valore={form[chiave]} onChange={(v) => cambia({ [chiave]: v })} invalido={Boolean(mostra(chiave))} />
                {unita !== '€' && <span className="add-unita">{unita.replace('€ ', '')}</span>}
              </div>
              <MostraSulSito chiave={chiave} nome={nome} />
            </Campo>
          ))}

          <div className="opt-campo">
            <span className="opt-titolo-campo">{RITARDO.nome}</span>
            <span className="opt-aiuto">{RITARDO.aiuto}</span>
            <span className="add-auto">automatico</span>
            <MostraSulSito chiave="ritardo" nome={RITARDO.nome} />
          </div>

          <div className="opt-campo">
            <span className="opt-titolo-campo">Le tue voci</span>
            <span className="opt-aiuto">Altre penali o costi che applichi (es. fumo nell’auto, sabbia, pedaggi non pagati).</span>
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
                  <button type="button" className="add-togli" aria-label={`Togli la voce ${v.nome || i + 1}`} onClick={() => cambia({ voci: form.voci.filter((_, j) => j !== i) })}>
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <div>
                  <label htmlFor={`add-voce-desc-${i}`} className="add-voce-et">Cosa vede il cliente (facoltativo)</label>
                  <input
                    id={`add-voce-desc-${i}`} type="text" className="opt-input" value={v.descrizione} placeholder="Es. È vietato fumare nei veicoli."
                    onChange={(e) => voce(i, { descrizione: e.target.value })}
                  />
                </div>
                <label className="opt-spunta add-sito">
                  <input type="checkbox" checked={v.sito} onChange={(e) => voce(i, { sito: e.target.checked })} aria-label={`Mostra sul sito: ${v.nome || `voce ${i + 1}`}`} />
                  Mostra sul sito
                </label>
                {(mostra(`voci.${i}.nome`) || mostra(`voci.${i}.importo`)) && (
                  <span className="opt-errore-campo" role="alert">{errori[`voci.${i}.nome`] || errori[`voci.${i}.importo`]}</span>
                )}
              </div>
            ))}
            <button type="button" className="add-link" onClick={() => cambia({ voci: [...form.voci, nuovaVoce()] })}>+ Aggiungi una voce</button>
          </div>

          <div className="opt-esempio add-anteprima">
            <b>Come lo vede il cliente sul sito</b> (nelle condizioni, riga «Penali e costi aggiuntivi»)
            <br />
            {anteprima.length > 0
              ? anteprima.map((r) => `${r.nome} ${r.testo}`).join(' · ')
              : 'Niente: nessuna voce è accesa, la riga non compare.'}
          </div>
          <p className="opt-aiuto">Importo 0 = gratis: la voce non si mostra. Cambiando un importo le riconsegne già registrate non cambiano.</p>
        </div>
        <div className="add-piede">
          {tentato && Object.keys(errori).length > 0 && <span className="opt-errore add-piede-errore">Controlla i campi segnati.</span>}
          {modificato && (
            <button type="button" className="opt-btn" onClick={() => { setForm(addebitiPerForm(salvati)); setTentato(false); }} disabled={salvando}>
              Annulla modifiche
            </button>
          )}
          <button type="submit" className="opt-btn opt-btn--salva" disabled={!modificato || salvando}>
            {salvando ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </section>
    </form>
  );
}

export default AddebitiRientro;
