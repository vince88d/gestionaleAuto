import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Gauge, Info, PenLine, Plus, Trash2 } from 'lucide-react';
import { ascoltaChilometri, salvaChilometri } from '../lib/firestoreChilometri';
import { ascoltaModalitaSito } from '../lib/firestoreSito';
import { useAddebiti } from '../lib/firestoreAddebiti';
import { nuovaFormula, schemaAFormule, schemaPerScheda, validaSchema } from '../utils/chilometri';
import { euro } from '../utils/protezioni';
import ComeFunziona from '../components/ComeFunziona';
import Aiuto from '../components/Aiuto';
import './CatalogoOptional.css';
import './AddebitiRientro.css';
import './ChilometriFormule.css';
import { scorriAlPrimoErrore } from '../utils/scorriAlPrimoErrore';

const numero = (n) => n.toLocaleString('it-IT', { useGrouping: 'always' });

// Come vede il pacchetto il cliente, dalla riga del form (anche non salvata).
function testoCliente(r, conPrezzi) {
  const km = Number(String(r.km).replace(/\./g, ''));
  if (!r.illimitati && !(Number.isInteger(km) && km > 0)) return '—';
  const nome = r.illimitati ? 'Km illimitati' : `${numero(km)} km al giorno`;
  if (!conPrezzi) return `«${nome}»`;
  const s = Number(String(r.supplemento).replace(',', '.'));
  return s > 0 ? `«${nome}», +${euro(s)} al giorno` : `«${nome}», incluso`;
}

// Scheda «Chilometri» di Tariffe e optional. In cima lo staff decide COME il cliente
// indica i km: scegliendo tra pacchetti (200 km, 400 km, illimitati...) oppure
// scrivendo lui quanti km pensa di fare (solo con il sito in «Solo richieste»).
// Il prezzo del km in piu' sta in «Penali e addebiti».
// Mockup: formiarent-documenti/mockup/gestionale-km-formule-v4.html
function ChilometriFormule({ onVaiAPenali }) {
  const [salvato, setSalvato] = useState(null);
  const [schema, setSchema] = useState(null);
  const [modalita, setModalita] = useState(null); // 'pagamento' | 'richiesta'
  const [erroreLettura, setErroreLettura] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tentato, setTentato] = useState(false);
  const prezzi = useAddebiti();
  const modificatoRef = useRef(false);

  const modificato = Boolean(schema && salvato) && JSON.stringify(schema) !== JSON.stringify(salvato);
  modificatoRef.current = modificato;

  useEffect(() => ascoltaChilometri((dati) => {
    const s = schemaPerScheda(dati);
    setSalvato(s);
    if (!modificatoRef.current) setSchema(s);
  }, (e) => {
    console.error('Errore lettura formule km:', e);
    setErroreLettura(true);
  }), []);
  useEffect(() => ascoltaModalitaSito(setModalita, (e) => console.error('Errore lettura modalita sito:', e)), []);

  if (erroreLettura) return <p className="opt-errore">Non riesco a leggere le formule dei chilometri. Ricarica la pagina.</p>;
  if (!schema || !modalita) return <p className="opt-nota">Caricamento…</p>;

  const conPrezzi = modalita === 'pagamento';
  const errori = validaSchema(schema, { conPrezzi });
  const mostra = (k) => (tentato ? errori[k] : undefined);
  const dichiarati = schema.modo === 'dichiarati';
  const kmInPiuTolto = (prezzi.tolte || []).includes('kmInPiu');
  const cambiaModo = (modo) => setSchema((s) => ({ ...s, modo }));
  const cambiaRiga = (i, campi) => setSchema((s) => ({ ...s, formule: s.formule.map((r, j) => (j === i ? { ...r, ...campi } : r)) }));
  const togli = (i) => setSchema((s) => ({ ...s, formule: s.formule.filter((_, j) => j !== i) }));
  const aggiungi = () => setSchema((s) => ({ ...s, formule: [...s.formule, nuovaFormula()] }));

  const salva = async (e) => {
    e.preventDefault();
    setTentato(true);
    if (Object.keys(errori).length > 0) {
      scorriAlPrimoErrore();
      return;
    }
    setSalvando(true);
    try {
      await salvaChilometri(schemaAFormule(schema));
      toast.success('Formule dei chilometri salvate: valgono dalla prossima prenotazione.');
      setTentato(false);
    } catch (err) {
      console.error('Errore salvataggio formule km:', err);
      toast.error('Formule non salvate, riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const kmInPiu = (
    <div className="km-piu">
      {kmInPiuTolto
        ? <span><b>Ogni km in più:</b> nessun addebito <span className="km-piu-nota">· l’hai tolto in «Penali e addebiti»</span></span>
        : <span><b>Ogni km in più{dichiarati ? '' : ' (pacchetti limitati)'}:</b> {euro(prezzi.kmInPiu)} al km <span className="km-piu-nota">· si cambia in «Penali e addebiti»</span></span>}
      {onVaiAPenali && <button type="button" className="km-link" onClick={onVaiAPenali}>Vai a Penali e addebiti</button>}
    </div>
  );

  return (
    <form className="opt" onSubmit={salva} noValidate aria-label="Formule dei chilometri">
      <ComeFunziona
        passi={[
          'Scegli come il cliente indica i km: tra pacchetti che decidi tu, oppure scrivendo lui quanti km pensa di fare.',
          'Il cliente lo fa sul sito, quando prenota o chiede un preventivo: tu trovi la sua scelta nella richiesta.',
          'Se al rientro ha fatto più km di quelli scelti o dichiarati, il gestionale conta i km in più.',
        ]}
        dettagli="Con un solo pacchetto il cliente non fa nessuna scelta. Le prenotazioni già fatte tengono la formula e i prezzi di quando sono state fatte."
      />
      <section className="opt-box km-box">
        <div className="opt-box-testa">
          <h2 className="opt-box-titolo km-titolo">
            Formule dei chilometri
            <Aiuto titolo="Pacchetti o km scritti dal cliente?" esempio="Esempio: pacchetto «200 km al giorno», noleggio di 3 giorni → 600 km. Oppure il cliente scrive «1500 km in tutto» e fai il preventivo su quelli.">
              Con i pacchetti il cliente sceglie tra formule fisse (anche «Km illimitati»). Con i km scritti dal cliente decide lui quanti km pensa di fare e tu fai il preventivo. I km oltre quelli scelti si pagano al rientro.
            </Aiuto>
          </h2>
        </div>
        <p className="opt-nota km-intro">Decidi come il cliente indica i km quando prenota o chiede un preventivo dal sito.</p>

        <div className="km-modo" role="radiogroup" aria-label="Come sceglie i km il cliente">
          <button type="button" role="radio" aria-checked={!dichiarati} className={`km-opz${!dichiarati ? ' km-opz--on' : ''}`} onClick={() => cambiaModo('pacchetti')}>
            <span className="km-pal" aria-hidden="true" />
            <Gauge className="km-ico" size={20} aria-hidden="true" />
            <span><b>Pacchetti che decido io</b><span className="km-d">Il cliente sceglie tra le formule che inserisci (es. 200 km, 400 km, illimitati).</span></span>
          </button>
          <button type="button" role="radio" aria-checked={dichiarati} disabled={conPrezzi} className={`km-opz${dichiarati ? ' km-opz--on' : ''}${conPrezzi ? ' km-opz--spenta' : ''}`}
            onClick={() => cambiaModo('dichiarati')}>
            <span className="km-pal" aria-hidden="true" />
            <PenLine className="km-ico" size={20} aria-hidden="true" />
            <span>
              <b>Il cliente scrive i km</b>
              <span className="km-d">
                {conPrezzi
                  ? 'Non disponibile con «Prezzi online»: online serve un prezzo certo. Passa a «Solo richieste» in questa pagina per usarlo.'
                  : 'Dichiara quanti km pensa di fare; tu fai il preventivo su quelli.'}
              </span>
            </span>
          </button>
        </div>

        {conPrezzi && dichiarati && (
          <div className="km-avv km-avv--att" role="status">
            <Info size={18} aria-hidden="true" />
            <div>Il sito è in <b>«Prezzi online»</b>: finché non torni a «Solo richieste» il cliente sceglie tra i pacchetti, perché online serve un prezzo certo. I tuoi pacchetti restano salvati.</div>
          </div>
        )}

        {!dichiarati && (
          <>
            <div className="km-avv">
              <Info size={18} aria-hidden="true" />
              <div>
                {conPrezzi
                  ? <>Il tuo sito è in <b>«Prezzi online»</b>: il cliente vede quanto costa ogni pacchetto e il costo entra nel totale. 0 € = incluso nel prezzo al giorno.</>
                  : <>Il tuo sito è in <b>«Solo richieste»</b>: i prezzi non si vedono online. Il cliente sceglie il pacchetto e tu lo trovi nella richiesta, per fare il preventivo.</>}
              </div>
            </div>
            <table className="opt-tabella km-tabella">
              <thead>
                <tr><th>Chilometri</th>{conPrezzi && <th>Costo in più al giorno</th>}<th className="km-col-cliente">Il cliente vede</th><th aria-label="Azioni" /></tr>
              </thead>
              <tbody>
                {schema.formule.map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      <div className="km-riga">
                        <span className="km-seg" role="radiogroup" aria-label={`Pacchetto ${i + 1}: chilometri`}>
                          <button type="button" role="radio" aria-checked={r.illimitati} className={r.illimitati ? 'km-seg--on' : ''} onClick={() => cambiaRiga(i, { illimitati: true })}>Illimitati</button>
                          <button type="button" role="radio" aria-checked={!r.illimitati} className={!r.illimitati ? 'km-seg--on' : ''} onClick={() => cambiaRiga(i, { illimitati: false })}>Limitati</button>
                        </span>
                        {!r.illimitati && (
                          <span className="opt-euro km-campo">
                            <input className="opt-input" inputMode="numeric" value={r.km} onChange={(e) => cambiaRiga(i, { km: e.target.value })}
                              aria-label={`Pacchetto ${i + 1}: km al giorno`} aria-invalid={mostra(`${i}.km`) ? true : undefined} placeholder="Es. 200" />
                            <span className="opt-euro-simbolo" aria-hidden="true">km al giorno</span>
                          </span>
                        )}
                      </div>
                      {mostra(`${i}.km`) && <span className="opt-errore-campo" role="alert">{errori[`${i}.km`]}</span>}
                    </td>
                    {conPrezzi && (
                      <td>
                        <span className="opt-euro km-campo">
                          <input className="opt-input" inputMode="decimal" value={r.supplemento} onChange={(e) => cambiaRiga(i, { supplemento: e.target.value })}
                            aria-label={`Pacchetto ${i + 1}: costo in più al giorno`} aria-invalid={mostra(`${i}.supplemento`) ? true : undefined} placeholder="Es. 6" />
                          <span className="opt-euro-simbolo" aria-hidden="true">€ al giorno</span>
                        </span>
                        {mostra(`${i}.supplemento`) && <span className="opt-errore-campo" role="alert">{errori[`${i}.supplemento`]}</span>}
                      </td>
                    )}
                    <td className="km-col-cliente km-cliente">{testoCliente(r, conPrezzi)}</td>
                    <td>
                      {schema.formule.length > 1 && (
                        <button type="button" className="km-togli" onClick={() => togli(i)}><Trash2 size={16} aria-hidden="true" /> Togli</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mostra('doppie') && <p className="opt-errore-campo km-doppie" role="alert">{errori.doppie}</p>}
            {mostra('ordine') && <p className="opt-errore-campo km-doppie" role="alert">{errori.ordine}</p>}
            <div className="km-esempio km-esempio--riga">
              <Info size={18} aria-hidden="true" />
              <div>Sul sito i pacchetti compaiono in ordine (meno km prima, illimitati per ultimi) e <b>nessuno è già scelto</b>: il cliente deve sceglierne uno. Con un solo pacchetto non sceglie nulla.</div>
            </div>
          </>
        )}

        {dichiarati && (
          <div className="km-corpo">
            <div className="km-passo">
              <h3 className="km-passo-t">Cosa succede</h3>
              <ol className="km-lista">
                <li>Il cliente scrive sul sito <b>quanti km pensa di fare in tutto</b> (è obbligatorio).</li>
                <li>Tu trovi i km dichiarati nella richiesta e fai il preventivo.</li>
                <li>Al rientro i km <b>oltre quelli dichiarati</b> si pagano al prezzo «km in più».</li>
              </ol>
            </div>
            <div className="km-passo">
              <h3 className="km-passo-t">Il cliente può scegliere anche «Km illimitati»?</h3>
              <button type="button" role="switch" aria-checked={schema.dichiaratiIllimitati} className={`km-sw${schema.dichiaratiIllimitati ? ' km-sw--on' : ''}`}
                onClick={() => setSchema((s) => ({ ...s, dichiaratiIllimitati: !s.dichiaratiIllimitati }))}>
                <i aria-hidden="true" /> {schema.dichiaratiIllimitati ? "Sì, accanto ai km c'è la scelta «Km illimitati»" : 'No, il cliente deve sempre scrivere un numero di km'}
              </button>
            </div>
          </div>
        )}

        {kmInPiu}

        <div className="add-piede">
          {!dichiarati && <button type="button" className="opt-btn" onClick={aggiungi}><Plus size={18} aria-hidden="true" /> Aggiungi un pacchetto</button>}
          <span className="km-spazio" />
          {tentato && Object.keys(errori).length > 0 && <span className="opt-errore">Controlla i campi segnati.</span>}
          {modificato && (
            <button type="button" className="opt-btn" onClick={() => { setSchema(salvato); setTentato(false); }} disabled={salvando}>
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

export default ChilometriFormule;
