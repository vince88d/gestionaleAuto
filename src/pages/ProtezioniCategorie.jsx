import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Pencil, X } from 'lucide-react';
import { ascoltaVeicoli } from '../lib/firestoreVeicoli';
import { ascoltaCategorie } from '../lib/firestoreCategorie';
import { ascoltaProtezioni, salvaProtezioni, salvaTestiProtezioni } from '../lib/firestoreProtezioni';
import { normalizzaElencoCategorie, contaVeicoliPerCategoria } from '../utils/categorie';
import {
  COPERTURE, perForm, validaProtezione, preparaProtezione, protezioneImpostata, esempioProtezione, euro,
} from '../utils/protezioni';
import CampoRicerca, { filtraPerTesto } from '../components/CampoRicerca';
import { Campo, CampoEuro } from '../components/CampiForm';
import './CatalogoOptional.css';
import './ProtezioniCategorie.css';

const IMPORTI = [['danni', 'Danni'], ['furto', 'Furto'], ['cauzione', 'Cauzione']];
const conta = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;

// Tre importi affiancati (danni, furto, cauzione): titoli di una parola,
// quindi le caselle restano allineate anche su una riga sola.
function TreImporti({ prefisso, valori, errori, onChange }) {
  return (
    <div className="pro-tre">
      {IMPORTI.map(([k, titolo]) => (
        <Campo key={k} id={`${prefisso}-${k}`} titolo={titolo} errore={errori[`${prefisso}.${k}`]}>
          <CampoEuro id={`${prefisso}-${k}`} valore={valori[k]} onChange={(v) => onChange(k, v)} invalido={Boolean(errori[`${prefisso}.${k}`])} />
        </Campo>
      ))}
    </div>
  );
}

// Scheda "Protezioni e cauzione" di Tariffe e optional: per ogni categoria
// la protezione Base (inclusa) e la Totale (a pagamento, facoltativa).
// Il sito le legge per mostrarle al cliente prima di pagare.
function ProtezioniCategorie() {
  const [veicoli, setVeicoli] = useState([]);
  const [categorieList, setCategorieList] = useState([]);
  const [dati, setDati] = useState(null); // null = in caricamento
  const [caricati, setCaricati] = useState({ veicoli: false, categorie: false });
  const [errore, setErrore] = useState('');
  const [ricerca, setRicerca] = useState('');
  const [aperta, setAperta] = useState(null); // categoria in modifica
  const [form, setForm] = useState(null);
  const [tentato, setTentato] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testi, setTesti] = useState(null); // null = come salvati
  const [copiaAperta, setCopiaAperta] = useState(false);
  const [copiaSu, setCopiaSu] = useState([]); // altre categorie a cui applicare gli stessi valori

  const segnalaErrore = (cosa) => (err) => {
    console.error(`Errore lettura ${cosa}:`, err);
    setErrore('Non riesco a leggere le protezioni. Controlla la connessione e riprova.');
  };
  useEffect(() => ascoltaVeicoli((d) => { setVeicoli(d); setCaricati((c) => ({ ...c, veicoli: true })); }, segnalaErrore('veicoli')), []);
  useEffect(() => ascoltaCategorie((d) => { setCategorieList(d); setCaricati((c) => ({ ...c, categorie: true })); }, segnalaErrore('categorie')), []);
  useEffect(() => ascoltaProtezioni(setDati, segnalaErrore('protezioni')), []);

  const conteggio = useMemo(() => contaVeicoliPerCategoria(veicoli), [veicoli]);
  const categorie = useMemo(
    () => normalizzaElencoCategorie([...categorieList, ...veicoli.map((v) => v.categoria).filter(Boolean)]),
    [categorieList, veicoli],
  );
  const mostrate = useMemo(() => filtraPerTesto(categorie, ricerca, (c) => c), [categorie, ricerca]);

  const apri = (categoria) => {
    setAperta(categoria);
    setForm(perForm(dati?.perCategoria[categoria]));
    setTentato(false);
    setCopiaAperta(false);
    setCopiaSu([]);
  };
  const chiudi = () => { setAperta(null); setForm(null); };

  const errori = form ? validaProtezione(form) : {};
  const mostra = tentato ? errori : {};
  const aggiornaBase = (k, v) => setForm((f) => ({ ...f, base: { ...f.base, [k]: v } }));
  const aggiornaTotale = (campi) => setForm((f) => ({ ...f, totale: { ...f.totale, ...campi } }));

  const salva = async (e) => {
    e.preventDefault();
    setTentato(true);
    if (Object.keys(errori).length > 0) return;
    setSalvando(true);
    try {
      await salvaProtezioni([aperta, ...copiaSu], preparaProtezione(form));
      toast.success(copiaSu.length > 0
        ? `Protezioni salvate su ${copiaSu.length + 1} categorie.`
        : `Protezioni di ${aperta} salvate.`);
      chiudi();
    } catch (err) {
      console.error('Errore salvataggio protezioni:', err);
      toast.error('Protezioni non salvate, riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const testiSalvati = { nonCopre: dati?.nonCopre ?? '', cauzioneTesto: dati?.cauzioneTesto ?? '' };
  const testiForm = testi ?? testiSalvati;
  const testiCambiati = testi !== null
    && (testi.nonCopre !== testiSalvati.nonCopre || testi.cauzioneTesto !== testiSalvati.cauzioneTesto);
  const salvaTesti = async () => {
    try {
      await salvaTestiProtezioni({ nonCopre: testiForm.nonCopre.trim(), cauzioneTesto: testiForm.cauzioneTesto.trim() });
      setTesti(null);
      toast.success('Testi salvati.');
    } catch (err) {
      console.error('Errore salvataggio testi protezioni:', err);
      toast.error('Testi non salvati, riprova.');
    }
  };

  const altre = aperta ? categorie.filter((c) => c !== aperta) : [];
  const giaImpostate = copiaSu.filter((c) => protezioneImpostata(dati?.perCategoria[c]));
  const scegliCopia = (c, si) => setCopiaSu((prima) => (si ? [...prima, c] : prima.filter((x) => x !== c)));

  if (errore) return <p className="opt-errore">{errore}</p>;
  if (!dati || !caricati.veicoli || !caricati.categorie) return <p className="opt-nota">Caricamento…</p>;

  return (
    <div className={`opt ${form ? 'opt--con-riquadro' : ''}`}>
      <div>
        <section className="opt-box">
          <div className="opt-box-testa">
            <div>
              <h2 className="opt-box-titolo">Protezioni e cauzione per categoria</h2>
              <span className="opt-conteggio">
                {ricerca.trim()
                  ? `Mostro ${mostrate.length} di ${conta(categorie.length, 'categoria', 'categorie')}`
                  : 'Quanto paga al massimo il cliente per danni e furto, e quanto si blocca sulla carta.'}
              </span>
            </div>
            {categorie.length > 0 && (
              <CampoRicerca valore={ricerca} onChange={setRicerca} placeholder="Cerca categoria…" etichetta="Cerca categoria" />
            )}
          </div>

          {categorie.length === 0 ? (
            <p className="opt-vuoto">Non ci sono ancora categorie: aggiungine una dalla pagina Categorie.</p>
          ) : mostrate.length === 0 ? (
            <p className="campo-ricerca-vuoto pro-vuoto">Nessuna categoria trovata per «{ricerca.trim()}».</p>
          ) : (
            <table className="opt-tabella">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Base · inclusa</th>
                  <th className="opt-col-extra">Totale · a pagamento</th>
                  <th aria-label="Azioni" />
                </tr>
              </thead>
              <tbody>
                {mostrate.map((categoria) => {
                  const p = dati.perCategoria[categoria];
                  const impostata = protezioneImpostata(p);
                  const numero = conteggio.get(categoria) || 0;
                  return (
                    <tr key={categoria} className={aperta === categoria ? 'opt-riga--aperta' : ''}>
                      <td>
                        <span className="opt-nome">{categoria}</span>
                        <span className="opt-sotto">{numero === 0 ? 'Nessun veicolo' : conta(numero, 'veicolo', 'veicoli')}</span>
                      </td>
                      {impostata ? (
                        <>
                          <td>
                            <span className="pro-cifre">
                              Danni <b>{euro(p.base.danni)}</b> · Furto <b>{euro(p.base.furto)}</b><br />
                              Cauzione <b>{euro(p.base.cauzione)}</b>
                            </span>
                          </td>
                          <td className="opt-col-extra">
                            {p.totale.offerta ? (
                              <span className="pro-cifre">
                                <b>+{euro(p.totale.prezzoGiorno)}</b> al giorno{p.totale.massimo ? ` · max ${euro(p.totale.massimo)}` : ''}<br />
                                Danni <b>{euro(p.totale.danni)}</b> · Cauzione <b>{euro(p.totale.cauzione)}</b>
                              </span>
                            ) : (
                              <span className="opt-etichetta">Non offerta</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <span className="opt-etichetta pro-etichetta--manca">Da impostare · sul sito non si può prenotare</span>
                          </td>
                          <td className="opt-col-extra" aria-label="Non impostata">—</td>
                        </>
                      )}
                      <td className="opt-azioni">
                        <button type="button" className={`opt-btn ${impostata ? '' : 'opt-btn--primario'}`} onClick={() => apri(categoria)}>
                          {impostata ? <><Pencil size={15} aria-hidden="true" /> Modifica</> : 'Imposta'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="opt-nota">
            Il cliente vede questi importi sul sito prima di pagare. Le prenotazioni già fatte tengono i valori di quando sono state fatte.
          </p>
        </section>

        <section className="opt-box pro-box-testi">
          <div className="opt-box-testa">
            <h2 className="opt-box-titolo">Valgono per tutte le categorie</h2>
            <button type="button" className="opt-btn opt-btn--salva" onClick={salvaTesti} disabled={!testiCambiati}>
              Salva testi
            </button>
          </div>
          <div className="pro-testi">
            <Campo id="pro-non-copre" titolo="Cosa non copre nessuna protezione" aiuto="Si vede sul sito sotto le protezioni («Cosa non copre»).">
              <textarea
                id="pro-non-copre"
                className="pro-testo"
                value={testiForm.nonCopre}
                onChange={(e) => setTesti({ ...testiForm, nonCopre: e.target.value })}
                placeholder="Es. danni guidando in stato di ebbrezza, rifornimento sbagliato, chiavi perse"
                aria-describedby="pro-non-copre-aiuto"
              />
            </Campo>
            <Campo id="pro-cauzione-testo" titolo="Come funziona la cauzione" aiuto="Si vede sul sito e nel contratto.">
              <textarea
                id="pro-cauzione-testo"
                className="pro-testo"
                value={testiForm.cauzioneTesto}
                onChange={(e) => setTesti({ ...testiForm, cauzioneTesto: e.target.value })}
                placeholder="Es. bloccata sulla carta al ritiro, non addebitata; si sblocca alla riconsegna"
                aria-describedby="pro-cauzione-testo-aiuto"
              />
            </Campo>
          </div>
        </section>
      </div>

      {form && (
        <form className="opt-riquadro" onSubmit={salva} noValidate aria-label={`Protezioni ${aperta}`}>
          <div className="opt-riquadro-testa">
            <h2 className="opt-box-titolo">{protezioneImpostata(dati.perCategoria[aperta]) ? 'Modifica' : 'Imposta'}: {aperta}</h2>
            <button type="button" className="opt-chiudi" onClick={chiudi} aria-label="Chiudi">
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="pro-sezione">
            <h3 className="pro-sezione-titolo">Protezione Base <em>· inclusa nel prezzo</em></h3>
            <div className="opt-campo">
              <span className="opt-titolo-campo">Quanto paga al massimo il cliente</span>
              <span className="opt-aiuto">È la franchigia: oltre questa cifra paga l&apos;assicurazione. La cauzione si blocca sulla carta.</span>
            </div>
            <TreImporti prefisso="base" valori={form.base} errori={mostra} onChange={aggiornaBase} />
          </div>

          <div className={`pro-sezione ${form.totale.offerta ? '' : 'pro-sezione--spenta'}`}>
            <h3 className="pro-sezione-titolo">Protezione Totale <em>· a pagamento</em></h3>
            <label className="opt-spunta">
              <input type="checkbox" checked={form.totale.offerta} onChange={(e) => aggiornaTotale({ offerta: e.target.checked })} />
              La offriamo per questa categoria
            </label>

            {form.totale.offerta && (
              <>
                <Campo id="tot-prezzo" titolo="Prezzo al giorno" aiuto="Il cliente la sceglie sul sito: non è mai già spuntata." errore={mostra['totale.prezzoGiorno']}>
                  <CampoEuro id="tot-prezzo" valore={form.totale.prezzoGiorno} onChange={(v) => aggiornaTotale({ prezzoGiorno: v })} invalido={Boolean(mostra['totale.prezzoGiorno'])} />
                </Campo>
                <Campo id="tot-massimo" titolo="Non far pagare più di" aiuto="Per i noleggi lunghi. Vuoto = nessun limite." errore={mostra['totale.massimo']}>
                  <CampoEuro id="tot-massimo" valore={form.totale.massimo} onChange={(v) => aggiornaTotale({ massimo: v })} placeholder="nessuno" invalido={Boolean(mostra['totale.massimo'])} />
                </Campo>
                <div className="opt-campo">
                  <span className="opt-titolo-campo">Con questa protezione paga al massimo</span>
                  <span className="opt-aiuto">Meno della Base (o uguale).</span>
                </div>
                <TreImporti prefisso="totale" valori={form.totale} errori={mostra} onChange={(k, v) => aggiornaTotale({ [k]: v })} />
                <fieldset className="pro-coperture">
                  <legend className="opt-titolo-campo">Copre anche</legend>
                  {COPERTURE.map(([k, nome]) => (
                    <label key={k} className={`pro-chip ${form.totale.copre[k] ? 'pro-chip--si' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.totale.copre[k]}
                        onChange={(e) => aggiornaTotale({ copre: { ...form.totale.copre, [k]: e.target.checked } })}
                      />
                      {nome}
                    </label>
                  ))}
                </fieldset>
              </>
            )}
          </div>

          {esempioProtezione(form) && <p className="opt-esempio">{esempioProtezione(form)}</p>}

          {altre.length > 0 && !copiaAperta && (
            <button type="button" className="pro-link" onClick={() => setCopiaAperta(true)}>
              Copia questi valori su altre categorie…
            </button>
          )}
          {copiaAperta && (
            <fieldset className="pro-sezione pro-copia">
              <legend className="pro-sezione-titolo">Applica gli stessi valori anche a</legend>
              <div className="pro-copia-azioni">
                <button type="button" className="pro-link" onClick={() => setCopiaSu(altre)}>Tutte</button>
                <button type="button" className="pro-link" onClick={() => setCopiaSu([])}>Nessuna</button>
              </div>
              <div className="pro-coperture">
                {altre.map((c) => (
                  <label key={c} className={`pro-chip ${copiaSu.includes(c) ? 'pro-chip--si' : ''}`}>
                    <input type="checkbox" checked={copiaSu.includes(c)} onChange={(e) => scegliCopia(c, e.target.checked)} />
                    {c}
                  </label>
                ))}
              </div>
              {giaImpostate.length > 0 && (
                <p className="pro-avviso" role="status">
                  {giaImpostate.length === 1 ? `${giaImpostate[0]} ha già i suoi valori:` : `${giaImpostate.join(', ')} hanno già i loro valori:`}
                  {' '}salvando vengono sostituiti.
                </p>
              )}
            </fieldset>
          )}

          <div className="opt-riquadro-piede">
            <button type="button" className="opt-btn opt-btn--largo" onClick={chiudi} disabled={salvando}>Annulla</button>
            <button type="submit" className="opt-btn opt-btn--largo opt-btn--salva" disabled={salvando}>
              {salvando ? 'Salvo…' : copiaSu.length > 0 ? `Salva su ${copiaSu.length + 1} categorie` : 'Salva'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default ProtezioniCategorie;
