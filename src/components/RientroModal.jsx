import React, { useMemo, useRef, useState } from 'react';
import Modal from 'react-modal';
import { Upload, X } from 'lucide-react';
import { dataEOra, formattaData, giornoLocale } from '../utils/scadenze';
import { leggiEuro, euro } from '../utils/protezioni';
import {
  LIVELLI, kmPercorsi, giorniInPiu, rientroEntro, proponiAddebiti, erroriAddebiti, erroriRientro,
  totaleAddebiti, esitoCauzione, tettoDanno, daRiportare, quartiMancanti,
} from '../utils/rientro';
import '../styles/Prenotazione.css';
import './RientroModal.css';

const oraAdesso = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const soldi = (n) => `${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function Passi({ attivo }) {
  const passo = (n, testo) => {
    const stato = n < attivo ? 'fatto' : n === attivo ? 'attivo' : '';
    return (
      <span className={`pz-passo ${stato ? `pz-passo--${stato}` : ''}`}>
        <span className="pz-passo-numero">{n < attivo ? '✓' : n}</span>
        {testo}
      </span>
    );
  };
  return (
    <div className="pz-passi" aria-label={`Passo ${attivo} di 2`}>
      {passo(1, "Com'è tornata")}
      <span className="pz-passi-linea" aria-hidden="true" />
      {passo(2, 'Addebiti e cauzione')}
    </div>
  );
}

// Ricevi l'auto: il rientro in due passi, come la consegna. Passo 1 «Com'e'
// tornata» (ora, km, carburante, dotazione, chiavi, danni), passo 2 «Addebiti
// e cauzione» (righe gia' compilate dal passo 1 e dai prezzi fissi). Solo
// registrazione: l'addebito e lo sblocco veri si fanno sul POS o su Stripe.
// `onConferma(dati)` salva; mockup: formiarent-documenti/mockup/gestionale-rientro.html
function RientroModal({ isOpen, onClose, onConferma, prenotazione, veicolo, prezzi, tolleranza }) {
  const [passo, setPasso] = useState(1);
  const [tentato, setTentato] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dataRientro, setDataRientro] = useState(giornoLocale());
  const [oraRientro, setOraRientro] = useState(oraAdesso());
  const [km, setKm] = useState('');
  const [carburante, setCarburante] = useState('');
  const [chiaviTornate, setChiaviTornate] = useState(null);
  const [mancanti, setMancanti] = useState({}); // nome -> { addebita, togli }
  const [extraMancanti, setExtraMancanti] = useState({}); // nome -> true
  const [danno, setDanno] = useState('');
  const [daRiparare, setDaRiparare] = useState(false);
  const [foto, setFoto] = useState([]);
  const [righe, setRighe] = useState([]);
  const [scelta, setScelta] = useState('trattieni'); // 'trattieni' | 'sblocca'
  const [trattieniScritto, setTrattieniScritto] = useState(null); // null = automatico
  const inputFoto = useRef(null);

  const riportare = useMemo(() => daRiportare(prenotazione), [prenotazione]);
  const consegna = prenotazione?.schedaVeicolo || {};
  const cauzione = typeof prenotazione?.protezione?.cauzione === 'number' ? prenotazione.protezione.cauzione : null;
  const tetto = tettoDanno(prenotazione);

  const svuota = () => {
    setPasso(1); setTentato(false); setDataRientro(giornoLocale()); setOraRientro(oraAdesso());
    setKm(''); setCarburante(''); setChiaviTornate(null); setMancanti({}); setExtraMancanti({});
    setDanno(''); setDaRiparare(false); setFoto([]); setRighe([]); setScelta('trattieni'); setTrattieniScritto(null);
  };

  // Una volta per prenotazione: km proposti dal veicolo non servono, si legge il contachilometri.
  const chiavi = chiaviTornate ?? (riportare.chiaviConsegnate ? undefined : null);
  const datiPasso1 = { prenotazione, dataRientro, oraRientro, km, carburante, chiaviTornate: chiavi === undefined ? null : chiavi };
  const errori = tentato ? erroriRientro(datiPasso1) : {};
  const percorsi = kmPercorsi(consegna.kmIniziali, km);
  const giorniExtra = giorniInPiu({ prenotazione, dataRientro, oraRientro, tolleranza });
  const entro = rientroEntro(prenotazione, tolleranza);
  const quartiPersi = quartiMancanti(consegna.carburante, carburante);

  const nonTornati = riportare.dotazione.filter((v) => mancanti[v]);
  const statoMancante = (v) => mancanti[v] || { addebita: true, togli: false };
  const segnaMancante = (v, no) => setMancanti((m) => {
    const resto = { ...m };
    if (no) resto[v] = m[v] || { addebita: true, togli: false }; else delete resto[v];
    return resto;
  });
  const cambiaMancante = (v, campi) => setMancanti((m) => ({ ...m, [v]: { ...statoMancante(v), ...campi } }));

  const avanti = () => {
    setTentato(true);
    if (Object.keys(erroriRientro(datiPasso1)).length > 0) return;
    const proposte = proponiAddebiti({
      prenotazione, prezzi, dataRientro, oraRientro, carburante, chiaviTornate: datiPasso1.chiaviTornate,
      nonTornati: nonTornati.map((nome) => ({ nome, addebita: statoMancante(nome).addebita })), danno, tolleranza,
    });
    // Tornando indietro e cambiando qualcosa si tiene quello che e' stato
    // scritto nelle righe che ci sono ancora; le altre voci sono nuove.
    setRighe((prima) => {
      const vecchie = new Map(prima.map((r) => [r.id, r]));
      const unite = proposte.map((r) => (vecchie.has(r.id) ? { ...r, importo: vecchie.get(r.id).importo ?? r.importo, attiva: vecchie.get(r.id).attiva } : r));
      return [...unite, ...prima.filter((r) => r.id.startsWith('altro:'))];
    });
    setTentato(false);
    setPasso(2);
  };

  const cambiaRiga = (id, campi) => setRighe((rs) => rs.map((r) => (r.id === id ? { ...r, ...campi } : r)));
  const aggiungiAltro = () => setRighe((rs) => [...rs, { id: `altro:${Date.now()}`, nome: '', dettaglio: '', importo: '', attiva: true, libera: true }]);
  const eliminaRiga = (id) => setRighe((rs) => rs.filter((r) => r.id !== id));

  const totale = totaleAddebiti(righe, tetto);
  const erroriRighe = tentato ? erroriAddebiti(righe) : {};
  const trattieniAuto = cauzione === null ? 0 : Math.min(cauzione, totale);
  const trattieni = scelta === 'sblocca' ? 0 : (trattieniScritto ?? trattieniAuto);
  const esito = cauzione === null ? null : esitoCauzione({ cauzione, totale, trattieni });
  const restano = esito ? esito.restano : totale;

  const conferma = async () => {
    if (salvando) return;
    setTentato(true);
    if (Object.keys(erroriAddebiti(righe)).length > 0 || righe.some((r) => r.attiva && r.libera && !String(r.nome).trim())) return;
    setSalvando(true);
    try {
      const ok = await onConferma({
        dataRientro, oraRientro, km, carburante, chiaviTornate: datiPasso1.chiaviTornate,
        dotazioneNonTornata: nonTornati,
        dotazioneTolta: nonTornati.filter((v) => statoMancante(v).togli),
        extraNonTornati: riportare.extra.filter((r) => extraMancanti[r.nome]).map((r) => r.nome),
        descrizioneDanno: danno.trim(), daRiparare, fotoDanni: foto.length > 0 ? foto : null,
        righe, trattieni: cauzione === null ? undefined : trattieni, tolleranza,
      });
      if (ok !== false) svuota();
    } finally {
      setSalvando(false);
    }
  };

  const chiudi = () => { if (!salvando) { svuota(); onClose(); } };

  const leggiFoto = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setFoto((prima) => [...prima, ev.target.result]);
      reader.readAsDataURL(file);
    });
  };

  if (!prenotazione) return null;
  const nomiMancanti = nonTornati.length;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={chiudi}
      contentLabel="Ricevi l'auto"
      className={{ base: 'Modal pz-modal', afterOpen: 'Modal--after-open', beforeClose: 'Modal--before-close' }}
      overlayClassName={{ base: 'Overlay', afterOpen: 'Overlay--after-open', beforeClose: 'Overlay--before-close' }}
      ariaHideApp={false}
    >
      <div className="pz">
        <header className="pz-testa">
          <div>
            <h2 className="pz-titolo">Ricevi l'auto</h2>
            <span className="pz-sottotitolo">
              {prenotazione.cliente} · {prenotazione.veicolo} ({prenotazione.targa})
              {passo === 1
                ? ` · ${dataEOra(prenotazione.dataInizio, prenotazione.oraInizio)} → ${dataEOra(prenotazione.dataFine, prenotazione.oraFine)}`
                : `${prenotazione.protezione ? ` · protezione ${prenotazione.protezione.tipo === 'totale' ? 'Totale' : 'Base'}` : ''}${cauzione !== null ? ` · cauzione ${euro(cauzione)}` : ''}`}
            </span>
            <Passi attivo={passo} />
          </div>
          <button type="button" className="pz-chiudi" onClick={chiudi} aria-label="Chiudi">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {passo === 1 ? (
          <div className="pz-corpo">
            <section className="pz-sezione">
              <h3 className="pz-titolo-sezione">Rientro, km e carburante</h3>
              <div className="pz-griglia pz-griglia--2">
                <div className={`pz-campo ${errori.dataRientro || errori.oraRientro ? 'pz-campo--errore' : ''}`}>
                  <span className="pz-etichetta">Rientrata il</span>
                  <div className="rn-riga">
                    <input type="date" aria-label="Data del rientro" value={dataRientro} onChange={(e) => setDataRientro(e.target.value)} />
                    <input type="time" step="60" aria-label="Ora del rientro" value={oraRientro} onChange={(e) => setOraRientro(e.target.value)} />
                  </div>
                  {entro && <p className="pz-aiuto">Prevista entro le {entro}</p>}
                  {(errori.dataRientro || errori.oraRientro) && <p className="pz-errore" role="alert">{errori.dataRientro || errori.oraRientro}</p>}
                </div>
                <label className={`pz-campo ${errori.km ? 'pz-campo--errore' : ''}`} htmlFor="rientro-km">
                  <span className="pz-etichetta">Km al rientro <span className="pz-obbligatorio">*</span></span>
                  <input id="rientro-km" type="number" min="0" value={km} onChange={(e) => setKm(e.target.value)} placeholder="Km sul contachilometri" />
                  <p className="pz-aiuto">
                    Alla consegna {consegna.kmIniziali ? Number(consegna.kmIniziali).toLocaleString('it-IT') : '—'}
                    {percorsi !== null && <> · percorsi <b>{percorsi.toLocaleString('it-IT')} km</b></>}
                  </p>
                  {errori.km && <p className="pz-errore" role="alert">{errori.km}</p>}
                </label>
              </div>
              {giorniExtra > 0 && (
                <p className="pz-avviso pz-avviso--attenzione" style={{ marginTop: 12 }}>
                  <b>Rientrata in ritardo</b>{entro ? ` rispetto alle ${prenotazione.oraFine} concordate (oltre la tolleranza)` : ''}: si conta{' '}
                  <b>{giorniExtra} {giorniExtra === 1 ? 'giorno' : 'giorni'} in più</b>. Lo trovi già nel passo 2, puoi toglierlo.
                </p>
              )}
              <div className={`pz-campo ${errori.carburante ? 'pz-campo--errore' : ''}`} style={{ marginTop: 14 }}>
                <span className="pz-etichetta" id="rientro-carburante">
                  Carburante al rientro <span className="pz-obbligatorio">*</span>
                  {consegna.carburante && <span className="rn-leggero"> · alla consegna {consegna.carburante}</span>}
                </span>
                <div className="pz-scelte" role="radiogroup" aria-labelledby="rientro-carburante">
                  {LIVELLI.map((l) => (
                    <button key={l} type="button" role="radio" aria-checked={carburante === l}
                      className={`pz-scelta ${carburante === l ? 'pz-scelta--attiva' : ''}`} onClick={() => setCarburante(l)}>
                      {l}
                    </button>
                  ))}
                </div>
                {errori.carburante && <p className="pz-errore" role="alert">{errori.carburante}</p>}
                {quartiPersi > 0 && <p className="pz-aiuto">Mancano {quartiPersi} {quartiPersi === 1 ? 'quarto' : 'quarti'} rispetto alla consegna: nel passo 2 c'è il rifornimento.</p>}
              </div>
            </section>

            <section className="pz-sezione">
              <h3 className="pz-titolo-sezione">Dotazione, chiavi ed extra</h3>
              <p className="pz-aiuto" style={{ margin: '0 0 10px' }}>Togli la spunta a quello che non è tornato.</p>
              {riportare.dotazione.length === 0 && riportare.extra.length === 0 && (
                <p className="pz-aiuto" style={{ margin: 0 }}>Alla consegna non è stata segnata nessuna dotazione.</p>
              )}
              <div className="rn-lista">
                {riportare.dotazione.map((v) => {
                  const no = Boolean(mancanti[v]);
                  const m = statoMancante(v);
                  return (
                    <div key={v} className={`rn-voce ${no ? 'rn-voce--manca' : ''}`}>
                      <label className="rn-voce-riga">
                        <input type="checkbox" checked={!no} onChange={(e) => segnaMancante(v, !e.target.checked)} />
                        <span className="rn-voce-nome">{v}</span>
                        <span className="rn-stato">{no ? 'NON TORNATO' : 'Tornato'}</span>
                      </label>
                      {no && (
                        <div className="rn-voce-opzioni">
                          <label><input type="checkbox" checked={m.addebita} onChange={(e) => cambiaMancante(v, { addebita: e.target.checked })} /> Addebita al cliente ({euro(prezzi.oggettoMancante)})</label>
                          <label><input type="checkbox" checked={m.togli} onChange={(e) => cambiaMancante(v, { togli: e.target.checked })} /> Togli dalla dotazione dell'auto <span className="rn-leggero">(la prossima consegna non lo dà per presente)</span></label>
                        </div>
                      )}
                    </div>
                  );
                })}
                {riportare.extra.map((r) => {
                  const no = Boolean(extraMancanti[r.nome]);
                  return (
                    <div key={r.id || r.nome} className={`rn-voce ${no ? 'rn-voce--manca' : ''}`}>
                      <label className="rn-voce-riga">
                        <input type="checkbox" checked={!no} onChange={(e) => setExtraMancanti((m) => ({ ...m, [r.nome]: !e.target.checked }))} />
                        <span className="rn-voce-nome">{r.nome} × {r.quantita}</span>
                        <span className="rn-stato">Extra · {no ? 'NON TORNATO' : 'Tornato'}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
              {riportare.chiaviConsegnate && (
                <div className={`pz-campo ${errori.chiavi ? 'pz-campo--errore' : ''}`} style={{ marginTop: 14 }}>
                  <span className="pz-etichetta" id="rientro-chiavi">Chiavi tornate <span className="rn-leggero">· consegnate {riportare.chiaviConsegnate}</span></span>
                  <div className="pz-scelte" role="radiogroup" aria-labelledby="rientro-chiavi" style={{ maxWidth: 220 }}>
                    {[0, 1, 2].filter((n) => n <= riportare.chiaviConsegnate).map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={datiPasso1.chiaviTornate === n}
                        className={`pz-scelta ${datiPasso1.chiaviTornate === n ? 'pz-scelta--attiva' : ''}`} onClick={() => setChiaviTornate(n)}>
                        {n}
                      </button>
                    ))}
                  </div>
                  {errori.chiavi && <p className="pz-errore" role="alert">{errori.chiavi}</p>}
                </div>
              )}
            </section>

            <section className="pz-sezione">
              <h3 className="pz-titolo-sezione">Danni nuovi</h3>
              {consegna.danni && (
                <p className="pz-aiuto" style={{ margin: '0 0 10px' }}>
                  Alla consegna c'era già: <b>{consegna.danni}</b>{consegna.fotoDanni ? ' (1 foto)' : ''}
                </p>
              )}
              <label className="pz-campo">
                <span className="pz-etichetta">Descrizione</span>
                <textarea value={danno} onChange={(e) => setDanno(e.target.value)} rows={3}
                  placeholder="Es. graffio sul paraurti posteriore. Lascia vuoto se è rientrata senza danni." />
              </label>
              <label className="pz-opzione" style={{ marginTop: 12 }}>
                <input type="checkbox" checked={daRiparare} onChange={(e) => setDaRiparare(e.target.checked)} />
                <span>
                  Da riparare
                  <span className="pz-aiuto" style={{ display: 'block' }}>Il veicolo apparirà in «Da fare» sulla Dashboard finché non lo segni riparato.</span>
                </span>
              </label>
              <div className="pz-foto">
                {foto.map((img, i) => <img key={img.slice(-32) + i} src={img} alt={`Danno ${i + 1}`} />)}
                <input ref={inputFoto} type="file" accept="image/*" multiple hidden onChange={leggiFoto} />
                <button type="button" className="vd-btn" onClick={() => inputFoto.current?.click()}>
                  <Upload size={16} aria-hidden="true" /> {foto.length ? 'Aggiungi altre foto' : 'Aggiungi foto'}
                </button>
                {foto.length > 0 && (
                  <button type="button" className="pz-link" style={{ alignSelf: 'center', color: '#c0392b' }} onClick={() => setFoto([])}>Togli le foto</button>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="pz-corpo">
            <section className="pz-sezione">
              <h3 className="pz-titolo-sezione">Addebiti</h3>
              <p className="pz-aiuto" style={{ margin: '0 0 10px' }}>
                Le righe sono già compilate da quello che hai segnato e dai prezzi di «Addebiti al rientro». Ogni importo si cambia; la spunta decide se conta.
              </p>
              <div className="rn-lista">
                {righe.map((r) => (
                  <div key={r.id} className={`rn-addebito ${r.attiva ? '' : 'rn-addebito--spento'}`}>
                    <input type="checkbox" checked={r.attiva} onChange={(e) => cambiaRiga(r.id, { attiva: e.target.checked })}
                      aria-label={`Conta: ${r.nome || 'altro addebito'}`} />
                    <div className="rn-addebito-testo">
                      {r.libera ? (
                        <input type="text" className="rn-nome-libero" value={r.nome} placeholder="Es. multa, pedaggio" aria-label="Descrizione dell'addebito"
                          onChange={(e) => cambiaRiga(r.id, { nome: e.target.value })} />
                      ) : (
                        <b>{r.nome}</b>
                      )}
                      {r.dettaglio && <span className="pz-aiuto">{r.dettaglio}</span>}
                      {erroriRighe[r.id] && <span className="pz-errore" role="alert">{erroriRighe[r.id]}</span>}
                    </div>
                    <div className="rn-importo">
                      <input type="text" inputMode="decimal" value={r.importo ?? ''} aria-label={`Importo: ${r.nome || 'altro addebito'}`}
                        onChange={(e) => cambiaRiga(r.id, { importo: e.target.value })} />
                      <span aria-hidden="true">€</span>
                    </div>
                    {r.libera && <button type="button" className="pz-link" onClick={() => eliminaRiga(r.id)} aria-label="Togli questa riga">Togli</button>}
                  </div>
                ))}
              </div>
              <button type="button" className="vd-btn" style={{ marginTop: 10 }} onClick={aggiungiAltro}>+ Altro addebito</button>
              {tetto !== null && righe.some((r) => r.id === 'danno' && r.attiva && (leggiEuro(r.importo) || 0) > tetto) && (
                <p className="pz-avviso pz-avviso--attenzione" style={{ marginTop: 12 }}>
                  Il danno supera la franchigia: al cliente se ne addebitano al massimo <b>{euro(tetto)}</b>.
                </p>
              )}
              <p className="rn-totale">Totale addebiti <b>{soldi(totale)}</b></p>
            </section>

            <section className="pz-sezione">
              <h3 className="pz-titolo-sezione">Cauzione</h3>
              {cauzione === null ? (
                <p className="pz-aiuto" style={{ margin: 0 }}>
                  Questa prenotazione non ha una cauzione.{totale > 0 ? <> Il cliente deve pagare <b>{soldi(totale)}</b>.</> : ' Non c\'è nulla da addebitare.'}
                </p>
              ) : (
                <>
                  <p className="pz-aiuto" style={{ margin: '0 0 10px' }}>
                    <b>{euro(cauzione)}</b> {prenotazione.cauzioneBloccata ? 'bloccati sulla carta alla consegna.' : 'di cauzione (alla consegna non è stato segnato il blocco).'}
                  </p>
                  <div className="rn-lista">
                    <label className="rn-scelta">
                      <input type="radio" name="cauzione" checked={scelta === 'sblocca'} onChange={() => setScelta('sblocca')} />
                      Sblocca tutta la cauzione
                    </label>
                    <label className="rn-scelta">
                      <input type="radio" name="cauzione" checked={scelta === 'trattieni'} onChange={() => setScelta('trattieni')} />
                      Trattieni
                      <span className="rn-importo rn-importo--corto">
                        <input type="text" inputMode="decimal" aria-label="Importo da trattenere" disabled={scelta !== 'trattieni'}
                          value={scelta === 'trattieni' ? (trattieniScritto ?? String(trattieniAuto).replace('.', ',')) : ''}
                          onChange={(e) => setTrattieniScritto(e.target.value)} />
                        <span aria-hidden="true">€</span>
                      </span>
                      e sblocca il resto
                    </label>
                  </div>
                  <p className="pz-avviso pz-avviso--info" style={{ marginTop: 12 }}>
                    {esito.trattenuta > 0 ? <>Trattieni <b>{soldi(esito.trattenuta)}</b> · sblocchi <b>{soldi(esito.sbloccata)}</b>. </> : <>Sblocchi <b>{soldi(esito.sbloccata)}</b>. </>}
                    {esito.restano > 0 ? <b>Restano da pagare {soldi(esito.restano)}.</b> : 'Il cliente non deve altro.'}
                  </p>
                </>
              )}
              <p className="pz-aiuto" style={{ margin: '10px 0 0' }}>
                Il gestionale registra e scrive nel verbale: l'addebito e lo sblocco veri si fanno sul POS (o su Stripe per i pagamenti online).
              </p>
            </section>
          </div>
        )}

        <footer className="pz-piede">
          {passo === 1 ? (
            <>
              <span className="pz-piede-nota">{nomiMancanti > 0 ? `${nomiMancanti} ${nomiMancanti === 1 ? 'voce non tornata' : 'voci non tornate'}` : ''}</span>
              <button type="button" className="vd-btn" onClick={chiudi}>Annulla</button>
              <button type="button" className="vd-btn vd-btn--primario" onClick={avanti}>Avanti: addebiti e cauzione</button>
            </>
          ) : (
            <>
              <span className="pz-piede-nota">{restano > 0 ? `Restano da pagare ${soldi(restano)}` : ''}</span>
              <button type="button" className="vd-btn" onClick={() => { setTentato(false); setPasso(1); }} disabled={salvando}>Indietro</button>
              <button type="button" className="vd-btn vd-btn--successo" onClick={conferma} disabled={salvando}>
                {salvando ? 'Salvataggio…' : 'Concludi il noleggio'}
              </button>
            </>
          )}
        </footer>
      </div>
    </Modal>
  );
}

export default RientroModal;
