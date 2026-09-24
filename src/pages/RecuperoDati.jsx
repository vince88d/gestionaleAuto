import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FolderOpen, Archive, SearchCheck, CheckCircle, AlertTriangle, Info, FileText, DownloadCloud, ExternalLink,
} from 'lucide-react';
import { toast } from 'react-toastify';
import './ImpostazioniAzienda.css';
import { analizzaRecupero, testoResoconto, testoEsitoRecupero } from '../utils/recuperoDati';
import {
  leggiEsistentiPerRecupero, leggiMemoriaInterna, eseguiRecupero, ascoltaArchivioDocumenti,
} from '../lib/recuperoDati';

// Recupero dei dati dalla versione precedente del gestionale (file sul
// computer). Passo 1: trovare la cartella, farne una copia di sicurezza
// completa e analizzare cosa verrebbe recuperato. Non scrive nulla su Firebase.

const MB = (byte) => `${(byte / 1024 / 1024).toFixed(1)} MB`;
const conta = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;

const ICONA_GRAVITA = { grave: AlertTriangle, attenzione: AlertTriangle, info: Info };

function RigaConteggio({ etichetta, valore }) {
  return (
    <tr>
      <td>{etichetta}</td>
      <td className="rec-numero">{valore.totale}</td>
      <td className="rec-numero">{valore.nuovi}</td>
      <td className="rec-numero">{valore.giaPresenti}</td>
    </tr>
  );
}

function RecuperoDati() {
  const navigate = useNavigate();
  const [cartella, setCartella] = useState(null);
  const [cercando, setCercando] = useState(true);
  const [copia, setCopia] = useState(null);
  const [copiando, setCopiando] = useState(false);
  const [analisi, setAnalisi] = useState(null);
  const [analizzando, setAnalizzando] = useState(false);
  const [letti, setLetti] = useState(null);
  const [conferma, setConferma] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [esito, setEsito] = useState(null);
  const [documenti, setDocumenti] = useState([]);
  const inCorso = Boolean(progresso) && !esito;

  useEffect(() => ascoltaArchivioDocumenti(
    setDocumenti,
    (error) => console.error('Errore lettura archivio documenti:', error),
  ), []);

  useEffect(() => {
    window.electronAPI.recuperoTrovaCartella()
      .then(setCartella)
      .catch((error) => console.error('Errore ricerca cartella:', error))
      .finally(() => setCercando(false));
  }, []);

  const cambiaCartella = async () => {
    const scelta = await window.electronAPI.recuperoScegliCartella();
    if (!scelta) return;
    setCartella(scelta);
    setCopia(null);
    setAnalisi(null);
    setEsito(null);
    setProgresso(null);
  };

  const faiCopia = async () => {
    setCopiando(true);
    try {
      const memoria = cartella.eQuestoComputer ? leggiMemoriaInterna() : null;
      const extra = memoria
        ? [{ nome: 'memoria-interna.json', contenuto: JSON.stringify(memoria, null, 2) }]
        : [];
      const res = await window.electronAPI.recuperoCopiaSicurezza({ cartella: cartella.cartella, extra });
      if (res.success) {
        setCopia(res);
        toast.success('Copia di sicurezza salvata.');
      } else if (!res.annullato) {
        toast.error(`Copia non riuscita: ${res.error}`);
      }
    } finally {
      setCopiando(false);
    }
  };

  const analizza = async () => {
    setAnalizzando(true);
    try {
      const datiLetti = await window.electronAPI.recuperoLeggi(cartella.cartella);
      if (!datiLetti.success) throw new Error(datiLetti.error);
      const esistenti = await leggiEsistentiPerRecupero();
      const risultato = analizzaRecupero(datiLetti, esistenti, { immagini: datiLetti.immagini, contratti: datiLetti.contratti });
      setLetti(datiLetti);
      setAnalisi({ ...risultato, fatta: new Date() });
      setConferma(false);
    } catch (error) {
      console.error('Errore analisi recupero:', error);
      toast.error('Analisi non riuscita: controlla la connessione e riprova.');
    } finally {
      setAnalizzando(false);
    }
  };

  const salvaResoconto = async () => {
    const d = analisi.fatta;
    const due = (n) => String(n).padStart(2, '0');
    const res = await window.electronAPI.salvaBackup({
      nomeFile: `resoconto-recupero-${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}.txt`,
      contenuto: testoResoconto(analisi, { cartella: cartella.cartella, data: d }),
    });
    if (res.success) toast.success('Resoconto salvato.');
    else if (!res.annullato) toast.error(`Errore: ${res.error}`);
  };

  const recupera = async () => {
    setConferma(false);
    setEsito(null);
    setProgresso({ fase: 'Preparazione', fatti: 0, totale: 0 });
    try {
      const risultato = await eseguiRecupero({
        cartella: cartella.cartella, analisi, letti, onProgresso: setProgresso,
      });
      setEsito({ ...risultato, finito: new Date() });
      const errori = ['veicoli', 'clienti', 'prenotazioni', 'file'].reduce((n, k) => n + risultato[k].errori.length, 0);
      if (errori) toast.warn(`Recupero finito con ${errori} errori: guarda l'elenco e ripetilo.`);
      else toast.success('Recupero completato.');
    } catch (error) {
      console.error('Errore recupero:', error);
      setProgresso(null);
      toast.error(`Recupero interrotto: ${error.message}. Puoi ripeterlo: quello gia' scritto non viene duplicato.`);
    }
  };

  const salvaEsito = async () => {
    const d = esito.finito;
    const due = (n) => String(n).padStart(2, '0');
    const res = await window.electronAPI.salvaBackup({
      nomeFile: `esito-recupero-${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}.txt`,
      contenuto: testoEsitoRecupero(esito, { data: d }),
    });
    if (res.success) toast.success('Esito salvato.');
    else if (!res.annullato) toast.error(`Errore: ${res.error}`);
  };

  const apriDocumento = async (url) => {
    const res = await window.electronAPI.apriDocumentoOnline(url);
    if (!res.success) toast.error(`Non riesco ad aprire il documento: ${res.error}`);
  };

  const c = analisi?.conteggi;
  const haGravi = analisi?.problemi.some((p) => p.gravita === 'grave');
  const erroriEsito = esito
    ? [...esito.veicoli.errori, ...esito.clienti.errori, ...esito.prenotazioni.errori, ...esito.file.errori]
    : [];

  return (
    <div className="imp">
      <div className="imp-toolbar">
        <h1 className="imp-titolo">Recupero dati</h1>
        <button type="button" className="imp-btn" onClick={() => navigate('/impostazioni-azienda')}>
          <ArrowLeft size={16} aria-hidden="true" /> Impostazioni
        </button>
      </div>
      <p className="imp-intro">
        Porta nel gestionale i veicoli, le prenotazioni, i clienti, le foto e i contratti salvati dalla versione
        precedente sul computer. La vecchia cartella viene solo letta: non viene mai modificata.
      </p>

      {/* 1. Cartella */}
      <section className="imp-sezione">
        <header className="imp-sezione-testa">
          <span className="imp-sezione-icona" aria-hidden="true"><FolderOpen size={18} /></span>
          <div>
            <h2>1. Cartella della versione precedente</h2>
            <p>Si trova da sola su questo computer. Per una prova puoi scegliere una copia portata da un altro computer.</p>
          </div>
        </header>
        {cercando && <p className="rec-nota">Ricerca in corso…</p>}
        {!cercando && cartella?.haDati && (
          <div className="rec-cartella">
            <code>{cartella.cartella}</code>
            <span>
              {cartella.fileDati.join(', ')} · {cartella.immagini} foto · {cartella.contratti} contratti PDF
              {cartella.eQuestoComputer ? ' · questo computer' : ' · copia da un altro computer'}
            </span>
          </div>
        )}
        {!cercando && cartella && !cartella.haDati && (
          <div className="imp-avviso">
            <Info size={16} aria-hidden="true" />
            <span>In questa cartella non ci sono dati della versione precedente ({cartella.cartella}).</span>
          </div>
        )}
        <div className="imp-piede imp-piede--sinistra rec-spazio">
          <button type="button" className="imp-btn" onClick={cambiaCartella} disabled={copiando || analizzando || inCorso}>
            <FolderOpen size={16} aria-hidden="true" /> Scegli un&apos;altra cartella
          </button>
        </div>
      </section>

      {/* 2. Copia di sicurezza */}
      <section className={`imp-sezione${cartella?.haDati ? '' : ' rec-spenta'}`}>
        <header className="imp-sezione-testa">
          <span className="imp-sezione-icona" aria-hidden="true"><Archive size={18} /></span>
          <div>
            <h2>2. Copia di sicurezza</h2>
            <p>
              Uno ZIP con tutta la cartella: dati, foto, contratti e conferme OTP. Conservalo fuori da questo computer
              (chiavetta o cloud) e non cancellarlo per qualche mese.
            </p>
          </div>
          {copia && <span className="imp-stato imp-stato--ok"><CheckCircle size={14} aria-hidden="true" /> Fatta</span>}
        </header>
        {copia && (
          <p className="rec-nota">
            {copia.file} file, {MB(copia.byte)} in <code>{copia.path}</code>
            {copia.saltati.length > 0 && (
              <span className="imp-errore"> — {copia.saltati.length} file non leggibili: {copia.saltati.join(', ')}</span>
            )}
          </p>
        )}
        <div className="imp-piede imp-piede--sinistra">
          <button
            type="button"
            className={`imp-btn${copia ? '' : ' imp-btn--primario'}`}
            onClick={faiCopia}
            disabled={!cartella?.haDati || copiando || inCorso}
          >
            <Archive size={16} aria-hidden="true" /> {copiando ? 'Copia in corso…' : copia ? 'Rifai la copia' : 'Salva la copia di sicurezza'}
          </button>
        </div>
      </section>

      {/* 3. Analisi */}
      <section className={`imp-sezione${copia ? '' : ' rec-spenta'}`}>
        <header className="imp-sezione-testa">
          <span className="imp-sezione-icona" aria-hidden="true"><SearchCheck size={18} /></span>
          <div>
            <h2>3. Analisi</h2>
            <p>Mostra cosa verrebbe recuperato e cosa controllare prima. Non scrive nulla.</p>
          </div>
        </header>

        {c && (
          <>
            <div className="rec-tabella-box">
              <table className="rec-tabella">
                <thead>
                  <tr><th /><th>Trovati</th><th>Da recuperare</th><th>Già presenti</th></tr>
                </thead>
                <tbody>
                  <RigaConteggio etichetta="Veicoli" valore={c.veicoli} />
                  <RigaConteggio etichetta="Prenotazioni" valore={c.prenotazioni} />
                  <RigaConteggio etichetta="Clienti" valore={c.clienti} />
                </tbody>
              </table>
            </div>
            <ul className="rec-elenco">
              {c.clientiRicavati > 0 && <li>{conta(c.clientiRicavati, 'cliente ricavato', 'clienti ricavati')} dalle prenotazioni ({c.clientiRicavati === 1 ? 'mancava' : 'mancavano'} in anagrafica)</li>}
              <li>{conta(c.fileDaCaricare, 'foto da caricare', 'foto da caricare')} online{c.fileMancanti > 0 ? `, ${c.fileMancanti} mancanti` : ''}</li>
              <li>
                {conta(c.contrattiArchivio, 'contratto PDF', 'contratti PDF')} per l&apos;archivio documenti
                {c.contrattiGiaInArchivio > 0 ? ` (${c.contrattiGiaInArchivio} già in archivio)` : ''}
              </li>
              <li>{conta(c.confermeOtpCollegate, 'conferma OTP collegata alla sua prenotazione', 'conferme OTP collegate alle loro prenotazioni')}</li>
              {c.immaginiNonUsate > 0 && <li>{conta(c.immaginiNonUsate, 'immagine non usata', 'immagini non usate')}: restano solo nella copia di sicurezza</li>}
            </ul>

            <h3 className="rec-sottotitolo">Da controllare</h3>
            {analisi.problemi.length === 0 ? (
              <p className="rec-nota"><CheckCircle size={14} aria-hidden="true" /> Nessun problema trovato.</p>
            ) : (
              <ul className="rec-problemi">
                {analisi.problemi.map((p, i) => {
                  const Icona = ICONA_GRAVITA[p.gravita] || Info;
                  return (
                    // eslint-disable-next-line react/no-array-index-key
                    <li key={i} className={`rec-problema rec-problema--${p.gravita}`}>
                      <Icona size={15} aria-hidden="true" />
                      <div>
                        <span>{p.messaggio}</span>
                        {p.dettagli.length > 0 && (
                          <details>
                            <summary>Dettagli ({p.dettagli.length})</summary>
                            <ul>{p.dettagli.map((d) => <li key={d}>{d}</li>)}</ul>
                          </details>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        <div className="imp-piede imp-piede--sinistra rec-spazio">
          <button
            type="button"
            className={`imp-btn${analisi ? '' : ' imp-btn--primario'}`}
            onClick={analizza}
            disabled={!copia || analizzando || inCorso}
          >
            <SearchCheck size={16} aria-hidden="true" /> {analizzando ? 'Analisi in corso…' : analisi ? 'Rifai l\'analisi' : 'Analizza'}
          </button>
          {analisi && (
            <button type="button" className="imp-btn" onClick={salvaResoconto}>
              <FileText size={16} aria-hidden="true" /> Salva il resoconto
            </button>
          )}
        </div>
      </section>

      {/* 4. Recupero */}
      <section className={`imp-sezione${analisi && !haGravi ? '' : ' rec-spenta'}`}>
        <header className="imp-sezione-testa">
          <span className="imp-sezione-icona" aria-hidden="true"><DownloadCloud size={18} /></span>
          <div>
            <h2>4. Recupero</h2>
            <p>
              Carica foto e contratti online e scrive i dati nel gestionale. Quello che c&apos;e&apos; gia&apos; non
              viene mai sovrascritto: se si interrompe, puoi ripeterlo senza creare doppioni.
            </p>
          </div>
          {esito && erroriEsito.length === 0 && (
            <span className="imp-stato imp-stato--ok"><CheckCircle size={14} aria-hidden="true" /> Fatto</span>
          )}
        </header>

        {haGravi && (
          <div className="imp-avviso imp-avviso--errore">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Ci sono problemi gravi nell&apos;analisi: risolvili prima di recuperare.</span>
          </div>
        )}

        {conferma && c && (
          <div className="imp-avviso">
            <Info size={16} aria-hidden="true" />
            <div>
              <span>
                Verranno scritti {conta(c.veicoli.nuovi, 'veicolo', 'veicoli')}, {conta(c.clienti.nuovi, 'cliente', 'clienti')} e
                {' '}{conta(c.prenotazioni.nuovi, 'prenotazione', 'prenotazioni')}, caricati
                {' '}{conta(c.fileDaCaricare, 'foto o file', 'foto o file')} e {conta(c.contrattiArchivio, 'contratto', 'contratti')}.
                I dati gia&apos; presenti non verranno toccati. Confermi?
              </span>
              <div className="imp-avviso-azioni">
                <button type="button" className="imp-btn imp-btn--primario" onClick={recupera}>Si&apos;, recupera</button>
                <button type="button" className="imp-btn" onClick={() => setConferma(false)}>Annulla</button>
              </div>
            </div>
          </div>
        )}

        {inCorso && (
          <div className="rec-progresso" role="status">
            <span>{progresso.fase}{progresso.totale ? `: ${progresso.fatti} di ${progresso.totale}` : '…'}</span>
            <div className="rec-barra">
              <div style={{ width: `${progresso.totale ? Math.round((progresso.fatti / progresso.totale) * 100) : 0}%` }} />
            </div>
            <small>Non chiudere il gestionale finche&apos; non ha finito.</small>
          </div>
        )}

        {esito && (
          <>
            <div className="rec-tabella-box">
              <table className="rec-tabella">
                <thead>
                  <tr><th /><th>Scritti</th><th>Già presenti</th><th>Errori</th></tr>
                </thead>
                <tbody>
                  {[['Veicoli', esito.veicoli], ['Clienti', esito.clienti], ['Prenotazioni', esito.prenotazioni]].map(([nome, e]) => (
                    <tr key={nome}>
                      <td>{nome}</td>
                      <td className="rec-numero">{e.scritti}</td>
                      <td className="rec-numero">{e.giaPresenti}</td>
                      <td className="rec-numero">{e.errori.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="rec-elenco">
              <li>{conta(esito.file.caricati, 'foto o file caricato', 'foto o file caricati')} online</li>
              <li>{conta(esito.archivio.scritti, 'contratto aggiunto', 'contratti aggiunti')} all&apos;archivio documenti</li>
            </ul>
            {erroriEsito.length > 0 ? (
              <ul className="rec-problemi">
                {erroriEsito.map((e) => (
                  <li key={e} className="rec-problema rec-problema--grave">
                    <AlertTriangle size={15} aria-hidden="true" /><span>{e}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rec-nota">
                <CheckCircle size={14} aria-hidden="true" />
                Tutto recuperato. Per verificare, rifai l&apos;analisi: ora deve dire &quot;gia&apos; presenti&quot; per tutto.
              </p>
            )}
          </>
        )}

        <div className="imp-piede imp-piede--sinistra rec-spazio">
          <button
            type="button"
            className="imp-btn imp-btn--primario"
            onClick={() => setConferma(true)}
            disabled={!analisi || haGravi || inCorso || conferma}
          >
            <DownloadCloud size={16} aria-hidden="true" /> {esito ? 'Ripeti il recupero' : 'Recupera i dati'}
          </button>
          {esito && (
            <button type="button" className="imp-btn" onClick={salvaEsito}>
              <FileText size={16} aria-hidden="true" /> Salva l&apos;esito
            </button>
          )}
        </div>
      </section>

      {/* 5. Documenti recuperati */}
      {documenti.length > 0 && (
        <section className="imp-sezione">
          <header className="imp-sezione-testa">
            <span className="imp-sezione-icona" aria-hidden="true"><FileText size={18} /></span>
            <div>
              <h2>Documenti della versione precedente</h2>
              <p>Contratti PDF che non erano collegati a nessuna prenotazione. Visibili solo allo staff.</p>
            </div>
          </header>
          <ul className="rec-documenti">
            {documenti.map((d) => (
              <li key={d.id}>
                <span>
                  <strong>{d.nome}</strong>
                  {d.data && <small> · {new Date(d.data).toLocaleString('it-IT')}</small>}
                </span>
                <button type="button" className="imp-btn" onClick={() => apriDocumento(d.url)}>
                  <ExternalLink size={15} aria-hidden="true" /> Apri
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default RecuperoDati;
