import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ascoltaChilometri, salvaChilometri } from '../lib/firestoreChilometri';
import { useAddebiti } from '../lib/firestoreAddebiti';
import { formulePerForm, nomeFormula, nuovaFormula, validaFormule } from '../utils/chilometri';
import { euro, leggiEuro } from '../utils/protezioni';
import ComeFunziona from '../components/ComeFunziona';
import Aiuto from '../components/Aiuto';
import './CatalogoOptional.css';
import './AddebitiRientro.css';
import './ChilometriFormule.css';

// Come vede la formula il cliente, dalla riga del form (anche non salvata).
function testoCliente(r) {
  const km = Number(String(r.km).replace(/\./g, ''));
  if (!r.illimitati && !(Number.isInteger(km) && km > 0)) return '—';
  const nome = nomeFormula({ km: r.illimitati ? null : km });
  if (r.partenza) return `«${nome}», inclusa`;
  const s = leggiEuro(r.supplemento);
  return `«${nome}», +${euro(s > 0 ? s : 0)} al giorno`;
}

// Scheda "Chilometri" di Tariffe e optional: le formule dei km che il cliente
// sceglie quando prenota, con il supplemento al giorno (uguale per tutte le
// categorie). Il prezzo del km in piu' sta in «Penali e addebiti».
// Mockup: formiarent-documenti/mockup/gestionale-sito-km.html (parte A)
function ChilometriFormule({ onVaiAPenali }) {
  const [salvate, setSalvate] = useState(null);
  const [righe, setRighe] = useState(null);
  const [erroreLettura, setErroreLettura] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tentato, setTentato] = useState(false);
  const prezzi = useAddebiti();
  const modificatoRef = useRef(false);

  const modificato = Boolean(righe && salvate) && JSON.stringify(righe) !== JSON.stringify(formulePerForm(salvate));
  modificatoRef.current = modificato;

  useEffect(() => ascoltaChilometri((dati) => {
    setSalvate(dati);
    if (!modificatoRef.current) setRighe(formulePerForm(dati));
  }, (e) => {
    console.error('Errore lettura formule km:', e);
    setErroreLettura(true);
  }), []);

  if (erroreLettura) return <p className="opt-errore">Non riesco a leggere le formule dei chilometri. Ricarica la pagina.</p>;
  if (!righe) return <p className="opt-nota">Caricamento…</p>;

  const errori = validaFormule(righe);
  const mostra = (k) => (tentato ? errori[k] : undefined);
  const cambia = (i, campi) => setRighe((rr) => rr.map((r, j) => (j === i ? { ...r, ...campi } : r)));
  const scegliPartenza = (i) => setRighe((rr) => rr.map((r, j) => ({ ...r, partenza: j === i, supplemento: j === i ? '0' : r.supplemento })));
  const togli = (i) => setRighe((rr) => {
    const dopo = rr.filter((_, j) => j !== i);
    return dopo.some((r) => r.partenza) ? dopo : dopo.map((r, j) => ({ ...r, partenza: j === 0, supplemento: j === 0 ? '0' : r.supplemento }));
  });

  const salva = async (e) => {
    e.preventDefault();
    setTentato(true);
    if (Object.keys(errori).length > 0) return;
    setSalvando(true);
    try {
      await salvaChilometri(righe);
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
          'Crea le formule dei km che offri: quanti km al giorno e quanto costa in più.',
          'Il cliente sceglie la formula quando prenota: il supplemento si aggiunge da solo al prezzo.',
          'Se fa più km di quelli inclusi, al rientro il gestionale conta i km in più.',
        ]}
        dettagli="Con una sola formula il cliente non vede nessuna scelta. Le prenotazioni già fatte tengono la formula e i prezzi di quando sono state fatte."
      />
      <section className="opt-box km-box">
        <div className="opt-box-testa">
          <h2 className="opt-box-titolo km-titolo">
            Formule dei chilometri
            <Aiuto titolo="Km illimitati o limitati?" esempio="Esempio: 200 km al giorno, noleggio di 3 giorni → 600 km inclusi. Se ne fa 610, paga 10 km in più.">
              Con una formula limitata il cliente può fare un certo numero di km al giorno; quelli in più li paga al rientro. La formula «di partenza» è già scelta ed è compresa nel prezzo al giorno.
            </Aiuto>
          </h2>
        </div>
        <p className="opt-nota km-intro">Valgono per tutte le categorie. Il pallino «Di partenza» è la formula già scelta, compresa nel prezzo al giorno.</p>

        <table className="opt-tabella km-tabella">
          <thead>
            <tr><th>Di partenza</th><th>Chilometri</th><th>Supplemento</th><th className="km-col-cliente">Il cliente vede</th><th aria-label="Azioni" /></tr>
          </thead>
          <tbody>
            {righe.map((r, i) => (
              <tr key={r.id}>
                <td>
                  <input type="radio" name="km-partenza" className="km-radio" checked={r.partenza} onChange={() => scegliPartenza(i)}
                    aria-label={`Formula ${i + 1} di partenza`} />
                </td>
                <td>
                  <div className="km-riga">
                    <span className="km-seg" role="radiogroup" aria-label={`Formula ${i + 1}: chilometri`}>
                      <button type="button" role="radio" aria-checked={r.illimitati} className={r.illimitati ? 'km-seg--on' : ''} onClick={() => cambia(i, { illimitati: true })}>Illimitati</button>
                      <button type="button" role="radio" aria-checked={!r.illimitati} className={!r.illimitati ? 'km-seg--on' : ''} onClick={() => cambia(i, { illimitati: false })}>Limitati</button>
                    </span>
                    {!r.illimitati && (
                      <span className="opt-euro km-campo">
                        <input className="opt-input" inputMode="numeric" value={r.km} onChange={(e) => cambia(i, { km: e.target.value })}
                          aria-label={`Formula ${i + 1}: km al giorno`} aria-invalid={mostra(`${i}.km`) ? true : undefined} placeholder="Es. 200" />
                        <span className="opt-euro-simbolo" aria-hidden="true">km al giorno</span>
                      </span>
                    )}
                  </div>
                  {mostra(`${i}.km`) && <span className="opt-errore-campo" role="alert">{errori[`${i}.km`]}</span>}
                </td>
                <td>
                  <span className="opt-euro km-campo">
                    <input className="opt-input" inputMode="decimal" value={r.partenza ? '0' : r.supplemento} disabled={r.partenza}
                      onChange={(e) => cambia(i, { supplemento: e.target.value })} aria-label={`Formula ${i + 1}: supplemento al giorno`}
                      aria-invalid={mostra(`${i}.supplemento`) ? true : undefined} placeholder="Es. 6" />
                    <span className="opt-euro-simbolo" aria-hidden="true">€ al giorno</span>
                  </span>
                  {mostra(`${i}.supplemento`) && <span className="opt-errore-campo" role="alert">{errori[`${i}.supplemento`]}</span>}
                </td>
                <td className="km-col-cliente km-cliente">{testoCliente(r)}</td>
                <td>
                  {righe.length > 1 && <button type="button" className="km-togli" onClick={() => togli(i)}>Togli</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {mostra('doppie') && <p className="opt-errore-campo km-doppie" role="alert">{errori.doppie}</p>}

        <div className="km-piu">
          {(prezzi.tolte || []).includes('kmInPiu')
            ? <span><b>Ogni km in più:</b> nessun addebito <span className="km-piu-nota">· l’hai tolto in «Penali e addebiti»</span></span>
            : <span><b>Ogni km in più:</b> {euro(prezzi.kmInPiu)} al km <span className="km-piu-nota">· si cambia in «Penali e addebiti»</span></span>}
          {onVaiAPenali && <button type="button" className="km-link" onClick={onVaiAPenali}>Vai a Penali e addebiti</button>}
        </div>

        <div className="add-piede">
          <button type="button" className="opt-btn" onClick={() => setRighe((rr) => [...rr, nuovaFormula()])}>+ Aggiungi una formula</button>
          <span className="km-spazio" />
          {tentato && Object.keys(errori).length > 0 && <span className="opt-errore">Controlla i campi segnati.</span>}
          {modificato && (
            <button type="button" className="opt-btn" onClick={() => { setRighe(formulePerForm(salvate)); setTentato(false); }} disabled={salvando}>
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
