import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { readVeicoli } from '../lib/firestoreVeicoli';
import {
  readCategorie, writeCategorie, rinominaCategoriaOvunque, rimuoviTariffaCategoria,
} from '../lib/firestoreCategorie';
import { normalizzaElencoCategorie, puoiEliminareCategoria, contaVeicoliPerCategoria } from '../utils/categorie';
import ConfirmDialog from '../components/ConfirmDialog';
import './Categorie.css';

// Elenco delle categorie di veicoli: da qui si aggiungono, rinominano ed
// eliminano. Il select del form veicolo (VehicleForm.jsx) usa questo stesso
// elenco, letto da Firestore invece che cablato nel codice.
function Categorie() {
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');
  const [veicoli, setVeicoli] = useState([]);
  const [categorie, setCategorie] = useState([]);
  const [nuova, setNuova] = useState('');
  const [rinominando, setRinominando] = useState(null); // { vecchia, valore } | null
  const [inCorso, setInCorso] = useState(false);
  const [daEliminare, setDaEliminare] = useState(null);

  const carica = async () => {
    setCaricamento(true);
    setErrore('');
    try {
      const datiVeicoli = await readVeicoli();
      const elenco = await readCategorie(datiVeicoli);
      setVeicoli(datiVeicoli);
      setCategorie(elenco);
    } catch (err) {
      console.error('Errore caricamento categorie:', err);
      setErrore('Impossibile caricare le categorie. Controlla la connessione e riprova.');
    } finally {
      setCaricamento(false);
    }
  };

  useEffect(() => {
    carica();
  }, []);

  const conteggio = useMemo(() => contaVeicoliPerCategoria(veicoli), [veicoli]);

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
      const aggiornate = normalizzaElencoCategorie([...categorie, pulita]);
      await writeCategorie(aggiornate);
      setCategorie(aggiornate);
      setNuova('');
      toast.success('Categoria aggiunta.');
    } catch (err) {
      console.error('Errore aggiunta categoria:', err);
      toast.error('Non sono riuscito ad aggiungere la categoria. Riprova.');
    } finally {
      setInCorso(false);
    }
  };

  const confermaRinomina = async () => {
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
    setInCorso(true);
    try {
      await rinominaCategoriaOvunque(vecchia, nuovoNome);
      const aggiornate = normalizzaElencoCategorie(categorie.map((c) => (c === vecchia ? nuovoNome : c)));
      await writeCategorie(aggiornate);
      setCategorie(aggiornate);
      setVeicoli((prima) => prima.map((v) => (v.categoria === vecchia ? { ...v, categoria: nuovoNome } : v)));
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
    setInCorso(true);
    try {
      const aggiornate = categorie.filter((c) => c !== categoria);
      await rimuoviTariffaCategoria(categoria);
      await writeCategorie(aggiornate);
      setCategorie(aggiornate);
      toast.success('Categoria eliminata.');
    } catch (err) {
      console.error('Errore eliminazione categoria:', err);
      toast.error('Non sono riuscito a eliminare la categoria. Riprova.');
    } finally {
      setInCorso(false);
      setDaEliminare(null);
    }
  };

  if (caricamento) return <div className="categorie-page"><p>Caricamento…</p></div>;
  if (errore) return <div className="categorie-page"><p className="categorie-errore">{errore}</p></div>;

  return (
    <div className="categorie-page">
      <h1>Categorie</h1>
      <p className="categorie-intro">
        Le categorie disponibili quando aggiungi o modifichi un veicolo. Una categoria con veicoli non si può
        eliminare; rinominarla aggiorna automaticamente i veicoli, le prenotazioni non ancora assegnate e la
        tariffa collegati ad essa.
      </p>

      {categorie.length === 0 ? (
        <p>Nessuna categoria ancora: aggiungine una qui sotto.</p>
      ) : (
        <table className="categorie-tabella">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Veicoli</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {categorie.map((categoria) => {
              const numero = conteggio.get(categoria) || 0;
              const inRinomina = rinominando?.vecchia === categoria;
              return (
                <tr key={categoria}>
                  <td>
                    {inRinomina ? (
                      <input
                        type="text"
                        aria-label={`Nuovo nome per ${categoria}`}
                        value={rinominando.valore}
                        onChange={(e) => setRinominando({ vecchia: categoria, valore: e.target.value })}
                        autoFocus
                      />
                    ) : (
                      categoria
                    )}
                  </td>
                  <td>{numero}</td>
                  <td className="categorie-azioni">
                    {inRinomina ? (
                      <>
                        <button type="button" onClick={confermaRinomina} disabled={inCorso}>Salva</button>
                        <button type="button" onClick={() => setRinominando(null)} disabled={inCorso}>Annulla</button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setRinominando({ vecchia: categoria, valore: categoria })}
                          disabled={inCorso}
                        >
                          Rinomina
                        </button>
                        <button
                          type="button"
                          className="categorie-elimina"
                          onClick={() => setDaEliminare(categoria)}
                          disabled={inCorso || !puoiEliminareCategoria(categoria, veicoli)}
                          title={numero > 0 ? `${numero} veicoli usano questa categoria` : undefined}
                        >
                          Elimina
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <form className="categorie-aggiungi" onSubmit={aggiungi}>
        <input
          type="text"
          aria-label="Nuova categoria"
          placeholder="Es. Furgone Merci"
          value={nuova}
          onChange={(e) => setNuova(e.target.value)}
          disabled={inCorso}
        />
        <button type="submit" disabled={inCorso || !nuova.trim()}>Aggiungi</button>
      </form>

      <ConfirmDialog
        open={daEliminare !== null}
        title="Eliminare la categoria?"
        message={daEliminare ? `Eliminare "${daEliminare}"? Nessun veicolo la usa, quindi non ci sono altri effetti.` : ''}
        confirmLabel="Elimina"
        tone="danger"
        onCancel={() => setDaEliminare(null)}
        onConfirm={() => elimina(daEliminare)}
      />
    </div>
  );
}

export default Categorie;
