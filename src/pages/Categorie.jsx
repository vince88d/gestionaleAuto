import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { ascoltaVeicoli } from '../lib/firestoreVeicoli';
import { ascoltaTariffe } from '../lib/firestoreTariffe';
import {
  ascoltaCategorie, writeCategorie, rinominaCategoriaOvunque, rimuoviTariffaCategoria,
} from '../lib/firestoreCategorie';
import { normalizzaElencoCategorie, puoiEliminareCategoria, contaVeicoliPerCategoria } from '../utils/categorie';
import ConfirmDialog from '../components/ConfirmDialog';
import './Categorie.css';

const formattaPrezzo = (valore) => `${Number(valore).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
const conta = (n, singolare, plurale) => `${n} ${n === 1 ? singolare : plurale}`;

// Elenco delle categorie di veicoli: da qui si aggiungono, rinominano ed
// eliminano. Il select del form veicolo (VehicleForm.jsx) usa questo stesso
// elenco, letto da Firestore invece che cablato nel codice.
// Categorie, veicoli e tariffe arrivano in tempo reale: rinominare o
// eliminare una categoria tocca veicoli, prenotazioni e la tariffa
// collegata, quindi la pagina deve vedere subito eventuali cambiamenti
// fatti da un'altra postazione.
function Categorie() {
  const prenotazioni = useSelector((state) => state.prenotazioni);
  const [veicoliCaricati, setVeicoliCaricati] = useState(false);
  const [categorieCaricate, setCategorieCaricate] = useState(false);
  const [errore, setErrore] = useState('');
  const [veicoli, setVeicoli] = useState([]);
  const [categorie, setCategorie] = useState([]);
  const [tariffe, setTariffe] = useState({});
  const [nuova, setNuova] = useState('');
  const [rinominando, setRinominando] = useState(null); // { vecchia, valore } | null
  const [richiestaRinomina, setRichiestaRinomina] = useState(null); // { vecchia, nuova } | null
  const [inCorso, setInCorso] = useState(false);
  const [daEliminare, setDaEliminare] = useState(null);

  useEffect(() => ascoltaVeicoli(
    (dati) => { setVeicoli(dati); setVeicoliCaricati(true); },
    (err) => {
      console.error('Errore lettura veicoli:', err);
      setErrore('Impossibile leggere i veicoli. Controlla la connessione e riprova.');
    },
  ), []);

  useEffect(() => ascoltaCategorie(
    (dati) => { setCategorie(dati); setCategorieCaricate(true); },
    (err) => {
      console.error('Errore lettura categorie:', err);
      setErrore('Impossibile leggere le categorie. Controlla la connessione e riprova.');
    },
  ), []);

  useEffect(() => ascoltaTariffe(
    (dati) => setTariffe(dati),
    (err) => console.error('Errore lettura tariffe:', err),
  ), []);

  const conteggio = useMemo(() => contaVeicoliPerCategoria(veicoli), [veicoli]);
  const prenotazioniPerCategoria = useMemo(() => {
    const mappa = new Map();
    (prenotazioni || []).forEach((p) => {
      if (p.categoria) mappa.set(p.categoria, (mappa.get(p.categoria) || 0) + 1);
    });
    return mappa;
  }, [prenotazioni]);

  const aggiungi = async (e) => {
    e.preventDefault();
    const pulita = nuova.trim();
    if (!pulita) return;
    if (categorie.some((c) => c.toLowerCase() === pulita.toLowerCase())) {
      toast.error(`"${pulita}" è già nell'elenco.`);
      return;
    }
    setInCorso(true);
    try {
      // Riparte sempre dall'elenco più fresco (arriva in tempo reale): così,
      // se un'altra postazione ha appena aggiunto una categoria, non la
      // sovrascriviamo salvando la nostra sopra una copia vecchia.
      const aggiornate = normalizzaElencoCategorie([...categorie, pulita]);
      await writeCategorie(aggiornate);
      setNuova('');
      toast.success('Categoria aggiunta.');
    } catch (err) {
      console.error('Errore aggiunta categoria:', err);
      toast.error('Non sono riuscito ad aggiungere la categoria. Riprova.');
    } finally {
      setInCorso(false);
    }
  };

  // Prima chiede conferma mostrando quanti veicoli, prenotazioni ed
  // eventualmente la tariffa vengono coinvolti, poi scrive davvero.
  const chiediRinomina = () => {
    if (!rinominando) return;
    const { vecchia, valore } = rinominando;
    const nuovoNome = valore.trim();
    if (!nuovoNome || nuovoNome === vecchia) {
      setRinominando(null);
      return;
    }
    if (categorie.some((c) => c.toLowerCase() === nuovoNome.toLowerCase() && c !== vecchia)) {
      toast.error(`"${nuovoNome}" è già nell'elenco.`);
      return;
    }
    setRichiestaRinomina({ vecchia, nuova: nuovoNome });
  };

  const confermaRinomina = async () => {
    if (!richiestaRinomina) return;
    const { vecchia, nuova: nuovoNome } = richiestaRinomina;
    setRichiestaRinomina(null);
    setInCorso(true);
    try {
      const aggiornate = normalizzaElencoCategorie(categorie.map((c) => (c === vecchia ? nuovoNome : c)));
      await rinominaCategoriaOvunque(vecchia, nuovoNome, aggiornate);
      setRinominando(null);
      toast.success(`Categoria rinominata in "${nuovoNome}".`);
    } catch (err) {
      console.error('Errore rinomina categoria:', err);
      toast.error('Non sono riuscito a rinominare la categoria. Riprova.');
    } finally {
      setInCorso(false);
    }
  };

  const elimina = async (categoria) => {
    setDaEliminare(null);
    // Ricontrolla con i dati più freschi: tra l'apertura della conferma e il
    // click potrebbe essere arrivato un veicolo di quella categoria.
    if (!puoiEliminareCategoria(categoria, veicoli)) {
      toast.error(`Non si può eliminare: ${conteggio.get(categoria) || 0} veicoli usano ancora "${categoria}".`);
      return;
    }
    setInCorso(true);
    try {
      const aggiornate = categorie.filter((c) => c !== categoria);
      await rimuoviTariffaCategoria(categoria);
      await writeCategorie(aggiornate);
      toast.success('Categoria eliminata.');
    } catch (err) {
      console.error('Errore eliminazione categoria:', err);
      toast.error('Non sono riuscito a eliminare la categoria. Riprova.');
    } finally {
      setInCorso(false);
    }
  };

  const messaggioRinomina = useMemo(() => {
    if (!richiestaRinomina) return '';
    const { vecchia, nuova: nuovoNome } = richiestaRinomina;
    const numVeicoli = conteggio.get(vecchia) || 0;
    const numPrenotazioni = prenotazioniPerCategoria.get(vecchia) || 0;
    const haTariffa = tariffe[vecchia] !== undefined;
    if (numVeicoli === 0 && numPrenotazioni === 0 && !haTariffa) {
      return `Nessun veicolo, prenotazione o tariffa collegati: rinomino solo "${vecchia}" in "${nuovoNome}" nell'elenco.`;
    }
    const parti = [];
    if (numVeicoli > 0) parti.push(conta(numVeicoli, 'veicolo', 'veicoli'));
    if (numPrenotazioni > 0) parti.push(conta(numPrenotazioni, 'prenotazione', 'prenotazioni'));
    const base = parti.length > 0 ? `Aggiorna ${parti.join(' e ')} che usano "${vecchia}"` : `Rinomina "${vecchia}"`;
    return `${base}${haTariffa ? ', e sposta la tariffa collegata' : ''} in "${nuovoNome}".`;
  }, [richiestaRinomina, conteggio, prenotazioniPerCategoria, tariffe]);

  const messaggioEliminazione = useMemo(() => {
    if (!daEliminare) return '';
    const haTariffa = tariffe[daEliminare] !== undefined;
    return haTariffa
      ? `Eliminare "${daEliminare}"? Nessun veicolo la usa, ma toglie anche la tariffa salvata (${formattaPrezzo(tariffe[daEliminare])} al giorno) collegata a questa categoria.`
      : `Eliminare "${daEliminare}"? Nessun veicolo la usa, quindi non ci sono altri effetti.`;
  }, [daEliminare, tariffe]);

  if (errore) return <div className="cat"><p className="cat-errore">{errore}</p></div>;
  if (!veicoliCaricati || !categorieCaricate) return <div className="cat"><p className="cat-nota">Caricamento…</p></div>;

  return (
    <div className="cat">
      <div className="cat-toolbar">
        <div>
          <h1 className="cat-titolo">Categorie</h1>
          <span className="cat-sottotitolo">{conta(categorie.length, 'categoria', 'categorie')}</span>
        </div>
      </div>
      <p className="cat-intro">
        Le categorie disponibili quando aggiungi o modifichi un veicolo. Una categoria con veicoli non si può
        eliminare; rinominarla aggiorna automaticamente i veicoli, le prenotazioni e la tariffa collegati ad essa.
      </p>

      {categorie.length === 0 ? (
        <p className="cat-nota">Nessuna categoria ancora: aggiungine una qui sotto.</p>
      ) : (
        <div className="cat-elenco">
          <table className="cat-tabella">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Veicoli</th>
                <th aria-label="Azioni" />
              </tr>
            </thead>
            <tbody>
              {categorie.map((categoria) => {
                const numero = conteggio.get(categoria) || 0;
                const inRinomina = rinominando?.vecchia === categoria;
                return (
                  <tr key={categoria}>
                    <td className="cat-nome">
                      {inRinomina ? (
                        <input
                          type="text"
                          className="cat-input"
                          aria-label={`Nuovo nome per ${categoria}`}
                          value={rinominando.valore}
                          onChange={(e) => setRinominando({ vecchia: categoria, valore: e.target.value })}
                          autoFocus
                        />
                      ) : (
                        categoria
                      )}
                    </td>
                    <td>{numero === 0 ? <span className="cat-vuoto-veicoli">Nessun veicolo</span> : conta(numero, 'veicolo', 'veicoli')}</td>
                    <td className="cat-azioni-riga">
                      {inRinomina ? (
                        <>
                          <button type="button" className="cat-icona" onClick={chiediRinomina} disabled={inCorso} title="Salva" aria-label="Salva">
                            <Check size={16} aria-hidden="true" />
                          </button>
                          <button type="button" className="cat-icona" onClick={() => setRinominando(null)} disabled={inCorso} title="Annulla" aria-label="Annulla">
                            <X size={16} aria-hidden="true" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="cat-icona"
                            onClick={() => setRinominando({ vecchia: categoria, valore: categoria })}
                            disabled={inCorso}
                            title="Rinomina"
                            aria-label="Rinomina"
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="cat-icona cat-icona--pericolo"
                            onClick={() => setDaEliminare(categoria)}
                            disabled={inCorso || !puoiEliminareCategoria(categoria, veicoli)}
                            title={numero > 0 ? `${numero} veicoli usano questa categoria` : 'Elimina'}
                            aria-label="Elimina"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <form className="cat-aggiungi" onSubmit={aggiungi}>
        <input
          type="text"
          className="cat-input"
          aria-label="Nuova categoria"
          placeholder="Es. Furgone Merci"
          value={nuova}
          onChange={(e) => setNuova(e.target.value)}
          disabled={inCorso}
        />
        <button type="submit" className="cat-btn cat-btn--primario" disabled={inCorso || !nuova.trim()}>
          <Plus size={16} aria-hidden="true" /> Aggiungi
        </button>
      </form>

      <ConfirmDialog
        open={richiestaRinomina !== null}
        title="Rinominare la categoria?"
        message={messaggioRinomina}
        confirmLabel="Rinomina"
        onCancel={() => setRichiestaRinomina(null)}
        onConfirm={confermaRinomina}
      />

      <ConfirmDialog
        open={daEliminare !== null}
        title="Eliminare la categoria?"
        message={messaggioEliminazione}
        confirmLabel="Elimina"
        tone="danger"
        onCancel={() => setDaEliminare(null)}
        onConfirm={() => elimina(daEliminare)}
      />
    </div>
  );
}

export default Categorie;
