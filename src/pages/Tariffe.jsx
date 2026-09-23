import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Save, RotateCcw, AlertTriangle, Undo2 } from 'lucide-react';
import { ascoltaVeicoli } from '../lib/firestoreVeicoli';
import { ascoltaTariffe, writeTariffe } from '../lib/firestoreTariffe';
import { suggerisciTariffe, tariffeDaCampi, differenzeTariffe } from '../utils/tariffe';
import ConfirmDialog from '../components/ConfirmDialog';
import './Tariffe.css';

const formattaPrezzo = (valore) => (
  valore === undefined ? null : `${Number(valore).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`
);

// Prezzo al giorno di ogni categoria. Vale per le prenotazioni online (è il prezzo
// che il cliente vede e paga sul sito) e come listino quando si prenota dal gestionale.
// Veicoli e tariffe arrivano in tempo reale, così la pagina non rischia di salvare
// sopra dati vecchi se qualcuno cambia qualcosa da un'altra postazione.
function Tariffe() {
  const [veicoliCaricati, setVeicoliCaricati] = useState(false);
  const [tariffeCaricate, setTariffeCaricate] = useState(false);
  const [errore, setErrore] = useState('');
  const [salvataggio, setSalvataggio] = useState(false);
  const [veicoli, setVeicoli] = useState([]);
  const [salvate, setSalvate] = useState({});
  const [campi, setCampi] = useState({});
  // Categorie che il gestore ha iniziato a modificare: i loro campi non si
  // aggiornano più da soli finché non salva o annulla.
  const [toccati, setToccati] = useState(() => new Set());
  // Prezzo salvato al momento in cui ogni campo toccato è stato modificato la
  // prima volta: se nel frattempo cambia (qualcun altro salva), è un conflitto.
  const [baseAlTocco, setBaseAlTocco] = useState({});
  const [daRimuovere, setDaRimuovere] = useState(() => new Set());
  const [confermaAperta, setConfermaAperta] = useState(false);

  useEffect(() => ascoltaVeicoli(
    (dati) => { setVeicoli(dati); setVeicoliCaricati(true); },
    (err) => {
      console.error('Errore lettura veicoli:', err);
      setErrore('Impossibile leggere i veicoli. Controlla la connessione e riprova.');
    },
  ), []);

  useEffect(() => ascoltaTariffe(
    (dati) => { setSalvate(dati); setTariffeCaricate(true); },
    (err) => {
      console.error('Errore lettura tariffe:', err);
      setErrore('Impossibile leggere le tariffe. Controlla la connessione e riprova.');
    },
  ), []);

  const righe = useMemo(() => {
    const perCategoria = new Map();
    veicoli.forEach((v) => {
      if (v.categoria) perCategoria.set(v.categoria, (perCategoria.get(v.categoria) || 0) + 1);
    });
    return [...perCategoria.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'it'))
      .map(([categoria, numero]) => ({ categoria, numero }));
  }, [veicoli]);

  const categorieAttuali = useMemo(() => new Set(righe.map((r) => r.categoria)), [righe]);
  const suggerite = useMemo(() => suggerisciTariffe(veicoli), [veicoli]);

  // Tiene aggiornati i campi non toccati quando arrivano dati nuovi (nuova
  // categoria, veicoli cambiati, o una tariffa salvata da un'altra postazione).
  useEffect(() => {
    setCampi((prima) => {
      let cambiato = false;
      const dopo = { ...prima };
      categorieAttuali.forEach((categoria) => {
        if (toccati.has(categoria)) return;
        const valore = salvate[categoria] ?? suggerite[categoria];
        const testo = valore !== undefined ? String(valore) : '';
        if (dopo[categoria] !== testo) {
          dopo[categoria] = testo;
          cambiato = true;
        }
      });
      return cambiato ? dopo : prima;
    });
  }, [categorieAttuali, salvate, suggerite, toccati]);

  const cambiaCampo = (categoria, valore) => {
    setCampi((prima) => ({ ...prima, [categoria]: valore }));
    setToccati((prima) => {
      if (prima.has(categoria)) return prima;
      const dopo = new Set(prima);
      dopo.add(categoria);
      return dopo;
    });
    setBaseAlTocco((prima) => (categoria in prima ? prima : { ...prima, [categoria]: salvate[categoria] }));
  };

  const annullaModifiche = () => {
    setToccati(new Set());
    setBaseAlTocco({});
    setDaRimuovere(new Set());
    setCampi((prima) => {
      const dopo = { ...prima };
      categorieAttuali.forEach((categoria) => {
        const valore = salvate[categoria] ?? suggerite[categoria];
        dopo[categoria] = valore !== undefined ? String(valore) : '';
      });
      return dopo;
    });
  };

  // Tariffe salvate per categorie che non hanno più veicoli (rinominate o
  // eliminate): invisibili nella tabella, ma restano su Firestore finché
  // qualcuno non le toglie esplicitamente.
  const orfane = useMemo(
    () => Object.keys(salvate).filter((categoria) => !categorieAttuali.has(categoria)).sort((a, b) => a.localeCompare(b, 'it')),
    [salvate, categorieAttuali],
  );

  const campiValidi = useMemo(
    () => Object.fromEntries(Object.entries(campi).filter(([categoria]) => categorieAttuali.has(categoria))),
    [campi, categorieAttuali],
  );
  const { prezziGiorno, errori } = useMemo(() => tariffeDaCampi(campiValidi), [campiValidi]);

  // Quello che verrebbe scritto su Firestore: i prezzi dei campi più le tariffe
  // orfane, a meno che il gestore non le abbia tolte.
  const finale = useMemo(() => {
    const risultato = { ...prezziGiorno };
    orfane.forEach((categoria) => {
      if (!daRimuovere.has(categoria)) risultato[categoria] = salvate[categoria];
    });
    return risultato;
  }, [prezziGiorno, orfane, daRimuovere, salvate]);

  const differenze = useMemo(() => differenzeTariffe(finale, salvate), [finale, salvate]);
  const conflitti = useMemo(
    () => [...toccati].filter((categoria) => baseAlTocco[categoria] !== salvate[categoria]),
    [toccati, baseAlTocco, salvate],
  );
  const modificato = differenze.length > 0;

  const apriConferma = (e) => {
    e.preventDefault();
    if (errori.length > 0) {
      toast.error(`Prezzo non valido per: ${errori.join(', ')}. Scrivi un numero maggiore di zero.`);
      return;
    }
    if (!modificato) return;
    setConfermaAperta(true);
  };

  const confermaSalva = async () => {
    setConfermaAperta(false);
    setSalvataggio(true);
    try {
      await writeTariffe(finale);
      setToccati(new Set());
      setBaseAlTocco({});
      setDaRimuovere(new Set());
      toast.success('Tariffe salvate.');
    } catch (err) {
      console.error('Errore salvataggio tariffe:', err);
      toast.error('Non sono riuscito a salvare le tariffe. Riprova.');
    } finally {
      setSalvataggio(false);
    }
  };

  const messaggioConferma = useMemo(() => {
    const righeTesto = differenze.map(({ categoria, prima, dopo }) => {
      const daPrima = formattaPrezzo(prima) ?? 'nessuna tariffa';
      const aDopo = formattaPrezzo(dopo) ?? "tariffa tolta (torna al prezzo dell'auto)";
      const avviso = conflitti.includes(categoria) ? " ⚠️ qualcun altro l'ha cambiata nel frattempo" : '';
      return `${categoria}: ${daPrima} → ${aDopo}${avviso}`;
    });
    const base = `Da subito sul sito e in gestionale:\n${righeTesto.join('\n')}`;
    return conflitti.length > 0
      ? `${base}\n\nAttenzione: qualcuno ha cambiato una di queste tariffe da un'altra postazione mentre la stavi modificando. Salvando, la tua sovrascrive la sua.`
      : base;
  }, [differenze, conflitti]);

  if (errore) return <div className="tar"><p className="tar-errore">{errore}</p></div>;
  if (!veicoliCaricati || !tariffeCaricate) return <div className="tar"><p className="tar-nota">Caricamento…</p></div>;

  return (
    <div className="tar">
      <div className="tar-toolbar">
        <div>
          <h1 className="tar-titolo">Tariffe per categoria</h1>
          <span className="tar-sottotitolo">
            {righe.length} {righe.length === 1 ? 'categoria' : 'categorie'} · {Object.keys(salvate).length} {Object.keys(salvate).length === 1 ? 'tariffa salvata' : 'tariffe salvate'}
          </span>
        </div>
      </div>
      <p className="tar-intro">
        Il prezzo al giorno di ogni categoria. È quello che il cliente vede e paga sul sito, e il listino di
        partenza quando crei una prenotazione qui (puoi sempre cambiarlo nella singola prenotazione). Le
        prenotazioni già fatte non cambiano.
      </p>

      {righe.length === 0 ? (
        <p className="tar-nota">Non ci sono veicoli con una categoria: aggiungili dalla sezione Veicoli.</p>
      ) : (
        <form onSubmit={apriConferma}>
          <div className="tar-elenco">
            <table className="tar-tabella">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Veicoli</th>
                  <th>Prezzo al giorno (€)</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {righe.map(({ categoria, numero }) => (
                  <tr key={categoria} className={conflitti.includes(categoria) ? 'tar-riga--conflitto' : ''}>
                    <td className="tar-categoria">{categoria}</td>
                    <td>{numero}</td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="tar-input"
                        aria-label={`Prezzo al giorno ${categoria}`}
                        value={campi[categoria] ?? ''}
                        onChange={(e) => cambiaCampo(categoria, e.target.value)}
                        placeholder="Es. 25"
                      />
                    </td>
                    <td>
                      {conflitti.includes(categoria) ? (
                        <span className="tar-etichetta tar-etichetta--conflitto">
                          <AlertTriangle size={13} aria-hidden="true" /> Cambiata da un altro
                        </span>
                      ) : salvate[categoria] !== undefined ? (
                        <span className="tar-etichetta tar-etichetta--ok">In uso</span>
                      ) : (
                        <span className="tar-etichetta tar-etichetta--manca">Da salvare</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="tar-azioni">
            <button type="submit" className="tar-btn tar-btn--primario" disabled={salvataggio || !modificato}>
              <Save size={16} aria-hidden="true" /> {salvataggio ? 'Salvo…' : 'Salva tariffe'}
            </button>
            {toccati.size > 0 && (
              <button type="button" className="tar-btn" onClick={annullaModifiche} disabled={salvataggio}>
                <RotateCcw size={16} aria-hidden="true" /> Annulla modifiche
              </button>
            )}
          </div>

          {Object.keys(salvate).length === 0 && (
            <p className="tar-nota">
              Non hai ancora salvato nessuna tariffa: i campi sono compilati con il prezzo più basso delle auto di
              ogni categoria. Controllali e premi Salva.
            </p>
          )}

          {orfane.length > 0 && (
            <div className="tar-orfane">
              <h2 className="tar-orfane-titolo">Tariffe salvate senza veicoli</h2>
              <p className="tar-nota">
                Queste categorie non hanno più veicoli (rinominate o eliminate), ma la tariffa è ancora salvata e
                resta com'era finché non la togli.
              </p>
              <ul className="tar-orfane-elenco">
                {orfane.map((categoria) => (
                  <li key={categoria} className={daRimuovere.has(categoria) ? 'tar-orfana--da-togliere' : ''}>
                    <span>{categoria}: {formattaPrezzo(salvate[categoria])}</span>
                    <button
                      type="button"
                      className="tar-link"
                      onClick={() => setDaRimuovere((prima) => {
                        const dopo = new Set(prima);
                        if (dopo.has(categoria)) dopo.delete(categoria); else dopo.add(categoria);
                        return dopo;
                      })}
                    >
                      {daRimuovere.has(categoria) ? <><Undo2 size={13} aria-hidden="true" /> Annulla</> : 'Rimuovi'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      )}

      <ConfirmDialog
        open={confermaAperta}
        onCancel={() => setConfermaAperta(false)}
        onConfirm={confermaSalva}
        title="Salvare le tariffe?"
        message={messaggioConferma}
        confirmLabel="Salva e pubblica"
        tone={conflitti.length > 0 ? 'danger' : 'default'}
      />
    </div>
  );
}

export default Tariffe;
