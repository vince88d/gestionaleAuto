import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ascoltaChilometri, salvaChilometri } from '../lib/firestoreChilometri';
import { useAddebiti } from '../lib/firestoreAddebiti';
import { Gauge, Infinity as Infinito, Info, Eye, Check } from 'lucide-react';
import { opzionePossibile, schemaAFormule, schemaPerScheda, sceltePerCliente, validaSchema } from '../utils/chilometri';
import { euro } from '../utils/protezioni';
import ComeFunziona from '../components/ComeFunziona';
import Aiuto from '../components/Aiuto';
import './CatalogoOptional.css';
import './AddebitiRientro.css';
import './ChilometriFormule.css';

// Scheda "Chilometri" di Tariffe e optional, a due passi: 1) cosa e' compreso nel
// prezzo al giorno, 2) un'opzione a pagamento facoltativa. Sotto, l'anteprima di
// quello che vede il cliente. Il prezzo del km in piu' sta in «Penali e addebiti».
// Mockup: formiarent-documenti/mockup/gestionale-km-formule-v2.html (ipotesi A)
function ChilometriFormule({ onVaiAPenali }) {
  const [salvato, setSalvato] = useState(null);
  const [schema, setSchema] = useState(null);
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

  if (erroreLettura) return <p className="opt-errore">Non riesco a leggere le formule dei chilometri. Ricarica la pagina.</p>;
  if (!schema) return <p className="opt-nota">Caricamento…</p>;

  const { base, opzione } = schema;
  const errori = validaSchema(schema);
  const mostra = (k) => (tentato ? errori[k] : undefined);
  const cambiaBase = (campi) => setSchema((s) => ({ ...s, base: { ...s.base, ...campi } }));
  const cambiaOpzione = (campi) => setSchema((s) => ({ ...s, opzione: { ...s.opzione, ...campi } }));
  const possibile = opzionePossibile(schema);
  const kmInPiuTolto = (prezzi.tolte || []).includes('kmInPiu');
  const kmBaseNum = Number(String(base.km).replace(/\./g, ''));
  const esempioKm = Number.isInteger(kmBaseNum) && kmBaseNum > 0 ? kmBaseNum : null;
  const scelte = Object.keys(validaSchema({ ...schema, opzione: { ...opzione, attiva: false } })).length === 0 ? sceltePerCliente(schema) : null;

  const salva = async (e) => {
    e.preventDefault();
    setTentato(true);
    if (Object.keys(errori).length > 0) return;
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

  return (
    <form className="opt" onSubmit={salva} noValidate aria-label="Formule dei chilometri">
      <ComeFunziona
        passi={[
          'Scegli cosa è compreso nel prezzo al giorno: km illimitati oppure un numero di km al giorno.',
          'Se vuoi, offri una opzione a pagamento: il cliente la sceglie e il supplemento si aggiunge da solo al prezzo.',
          'Se fa più km di quelli compresi, al rientro il gestionale conta i km in più.',
        ]}
        dettagli="Senza opzione il cliente non vede nessuna scelta: trova scritto cosa è compreso. Le prenotazioni già fatte tengono la formula e i prezzi di quando sono state fatte."
      />
      <section className="opt-box km-box">
        <div className="opt-box-testa">
          <h2 className="opt-box-titolo km-titolo">
            Formule dei chilometri
            <Aiuto titolo="Km illimitati o limitati?" esempio="Esempio: 200 km al giorno, noleggio di 3 giorni → 600 km compresi. Se ne fa 610, paga 10 km in più.">
              Con i km limitati il cliente può fare un certo numero di km al giorno; quelli in più li paga al rientro. L'opzione a pagamento è una scelta in più, per chi vuole guidare di più.
            </Aiuto>
          </h2>
        </div>
        <p className="opt-nota km-intro">Valgono per tutte le categorie. Decidi quanti km sono compresi nel prezzo e, se vuoi, cosa può aggiungere il cliente.</p>

        <div className="km-corpo">
          <div className="km-passo">
            <h3 className="km-passo-t"><span className="km-num">1</span> Cosa è compreso nel prezzo al giorno?</h3>
            <div className="km-due" role="radiogroup" aria-label="Chilometri compresi nel prezzo">
              <button type="button" role="radio" aria-checked={base.illimitati} className={`km-opz${base.illimitati ? ' km-opz--on' : ''}`} onClick={() => cambiaBase({ illimitati: true })}>
                <span className="km-pal" aria-hidden="true" />
                <Infinito className="km-ico" size={20} aria-hidden="true" />
                <span><b>Km illimitati</b><span className="km-d">Il cliente guida quanto vuole, senza controllo al rientro.</span></span>
              </button>
              <button type="button" role="radio" aria-checked={!base.illimitati} className={`km-opz${!base.illimitati ? ' km-opz--on' : ''}`} onClick={() => cambiaBase({ illimitati: false })}>
                <span className="km-pal" aria-hidden="true" />
                <Gauge className="km-ico" size={20} aria-hidden="true" />
                <span><b>Km limitati</b><span className="km-d">Un numero di km al giorno compresi; quelli in più si pagano.</span></span>
              </button>
            </div>
            {!base.illimitati && (
              <>
                <div className="km-rig">
                  <label className="km-lab" htmlFor="km-base">Km compresi ogni giorno</label>
                  <span className="opt-euro km-campo">
                    <input id="km-base" className="opt-input" inputMode="numeric" value={base.km} onChange={(e) => cambiaBase({ km: e.target.value })}
                      aria-invalid={mostra('base.km') ? true : undefined} placeholder="Es. 200" />
                    <span className="opt-euro-simbolo" aria-hidden="true">km al giorno</span>
                  </span>
                </div>
                {mostra('base.km') && <span className="opt-errore-campo" role="alert">{errori['base.km']}</span>}
                <div className="km-esempio">
                  <Info size={18} aria-hidden="true" />
                  <div>
                    {kmInPiuTolto
                      ? <>Se il cliente supera i km compresi non paga nulla in più: l'hai tolto in «Penali e addebiti».</>
                      : <><b>Esempio:</b> noleggio di 3 giorni → {esempioKm ? `${(esempioKm * 3).toLocaleString('it-IT')} km compresi` : 'i km compresi si moltiplicano per i giorni'}. Ogni km in più costa {euro(prezzi.kmInPiu)}.</>}
                    {' '}Il prezzo del km in più si cambia in «Penali e addebiti».
                    {onVaiAPenali && <> <button type="button" className="km-link" onClick={onVaiAPenali}>Vai a Penali e addebiti</button></>}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="km-passo">
            <h3 className="km-passo-t"><span className="km-num">2</span> Vuoi offrire un'opzione in più a pagamento? <span className="km-facolt">(facoltativo)</span></h3>
            {!possibile ? (
              <p className="km-ass">Non c'è nulla da aggiungere: i km compresi sono già illimitati.</p>
            ) : (
              <>
                <button type="button" role="switch" aria-checked={opzione.attiva} className={`km-sw${opzione.attiva ? ' km-sw--on' : ''}`} onClick={() => cambiaOpzione({ attiva: !opzione.attiva })}>
                  <i aria-hidden="true" /> {opzione.attiva ? "Sì, il cliente può scegliere un'opzione" : "No, il cliente non vede nessuna scelta"}
                </button>
                {opzione.attiva && (
                  <>
                    <div className="km-rig">
                      <span className="km-lab" id="km-cosa">Cosa offri</span>
                      <span className="km-seg" role="radiogroup" aria-labelledby="km-cosa">
                        <button type="button" role="radio" aria-checked={opzione.illimitati} className={opzione.illimitati ? 'km-seg--on' : ''} onClick={() => cambiaOpzione({ illimitati: true })}>Km illimitati</button>
                        <button type="button" role="radio" aria-checked={!opzione.illimitati} className={!opzione.illimitati ? 'km-seg--on' : ''} onClick={() => cambiaOpzione({ illimitati: false })}>Più km al giorno</button>
                      </span>
                    </div>
                    {!opzione.illimitati && (
                      <div className="km-rig">
                        <label className="km-lab" htmlFor="km-opz-km">Km al giorno</label>
                        <span className="opt-euro km-campo">
                          <input id="km-opz-km" className="opt-input" inputMode="numeric" value={opzione.km} onChange={(e) => cambiaOpzione({ km: e.target.value })}
                            aria-invalid={mostra('opzione.km') ? true : undefined} placeholder="Es. 300" />
                          <span className="opt-euro-simbolo" aria-hidden="true">km al giorno</span>
                        </span>
                      </div>
                    )}
                    {mostra('opzione.km') && <span className="opt-errore-campo" role="alert">{errori['opzione.km']}</span>}
                    <div className="km-rig">
                      <label className="km-lab" htmlFor="km-opz-sup">Quanto costa in più</label>
                      <span className="opt-euro km-campo">
                        <input id="km-opz-sup" className="opt-input" inputMode="decimal" value={opzione.supplemento} onChange={(e) => cambiaOpzione({ supplemento: e.target.value })}
                          aria-invalid={mostra('opzione.supplemento') ? true : undefined} placeholder="Es. 6" />
                        <span className="opt-euro-simbolo" aria-hidden="true">€ al giorno</span>
                      </span>
                    </div>
                    {mostra('opzione.supplemento') && <span className="opt-errore-campo" role="alert">{errori['opzione.supplemento']}</span>}
                    <div className="km-esempio">
                      <Info size={18} aria-hidden="true" />
                      <div>Se il cliente la sceglie, il supplemento si aggiunge da solo al prezzo. Con l'interruttore su «No» il cliente trova scritto cosa è compreso e non sceglie nulla.</div>
                    </div>
                  </>
                )}
                {schema.scartate > 0 && (
                  <p className="opt-errore-campo km-doppie" role="status">
                    Avevi salvato {schema.scartate === 1 ? 'un\'altra opzione' : `altre ${schema.scartate} opzioni`}: con questa scheda se ne offre una sola. Salvando, {schema.scartate === 1 ? 'viene tolta' : 'vengono tolte'}; le prenotazioni già fatte non cambiano.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {scelte && (
          <div className="km-anteprima">
            <div className="km-anteprima-t"><Eye size={18} aria-hidden="true" /> Quello che vede il cliente sul sito</div>
            <div className="km-scelte">
              {scelte.map((c) => (
                <div key={c.nome} className={`km-sc${c.compresa ? ' km-sc--on' : ''}`}>
                  <b>{c.nome}</b>
                  {c.compresa
                    ? <span className="km-sc-pr km-sc-pr--ok"><Check size={14} aria-hidden="true" /> Incluso nel prezzo</span>
                    : <span className="km-sc-pr">+ {euro(c.supplemento)} al giorno</span>}
                </div>
              ))}
            </div>
            {scelte.length === 1 && <p className="km-ass km-ass--s">Con una sola formula il cliente non fa nessuna scelta: vede scritto cosa è incluso.</p>}
          </div>
        )}

        <div className="add-piede">
          <span className="km-spazio" />
          {tentato && Object.keys(errori).length > 0 && <span className="opt-errore">Controlla i campi segnati.</span>}
          {modificato && (
            <button type="button" className="opt-btn" onClick={() => { setSchema(salvato); setTentato(false); }} disabled={salvando}>
              Annulla modifiche
            </button>
          )}
          <button type="submit" className="opt-btn opt-btn--salva" disabled={!modificato || salvando}>
            {salvando ? 'Salvo…' : 'Salva formule'}
          </button>
        </div>
      </section>
    </form>
  );
}

export default ChilometriFormule;
