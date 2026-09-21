import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { readVeicoli } from '../lib/firestoreVeicoli';
import { readTariffe, writeTariffe } from '../lib/firestoreTariffe';
import { suggerisciTariffe, tariffeDaCampi } from '../utils/tariffe';
import './Tariffe.css';

// Prezzo al giorno di ogni categoria. Vale per le prenotazioni online (è il prezzo
// che il cliente vede e paga sul sito) e come listino quando si prenota dal gestionale.
function Tariffe() {
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');
  const [salvataggio, setSalvataggio] = useState(false);
  const [veicoli, setVeicoli] = useState([]);
  const [salvate, setSalvate] = useState({});
  const [campi, setCampi] = useState({});

  useEffect(() => {
    let annullato = false;
    (async () => {
      try {
        const [datiVeicoli, tariffe] = await Promise.all([readVeicoli(), readTariffe()]);
        if (annullato) return;
        const suggerite = suggerisciTariffe(datiVeicoli);
        const categorie = [...new Set(datiVeicoli.map((v) => v.categoria).filter(Boolean))];
        // Dove non c'è ancora una tariffa il campo parte dal prezzo più basso delle auto.
        const iniziali = {};
        categorie.forEach((categoria) => {
          const valore = tariffe[categoria] ?? suggerite[categoria];
          iniziali[categoria] = valore !== undefined ? String(valore) : '';
        });
        setVeicoli(datiVeicoli);
        setSalvate(tariffe);
        setCampi(iniziali);
      } catch (err) {
        console.error('Errore caricamento tariffe:', err);
        if (!annullato) setErrore('Impossibile caricare le tariffe. Controlla la connessione e riprova.');
      } finally {
        if (!annullato) setCaricamento(false);
      }
    })();
    return () => {
      annullato = true;
    };
  }, []);

  const righe = useMemo(() => {
    const perCategoria = new Map();
    veicoli.forEach((v) => {
      if (v.categoria) perCategoria.set(v.categoria, (perCategoria.get(v.categoria) || 0) + 1);
    });
    return [...perCategoria.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'it'))
      .map(([categoria, numero]) => ({ categoria, numero }));
  }, [veicoli]);

  const modificato = useMemo(() => {
    const { prezziGiorno } = tariffeDaCampi(campi);
    const chiavi = new Set([...Object.keys(prezziGiorno), ...Object.keys(salvate)]);
    return [...chiavi].some((k) => prezziGiorno[k] !== salvate[k]);
  }, [campi, salvate]);

  const salva = async (e) => {
    e.preventDefault();
    const { prezziGiorno, errori } = tariffeDaCampi(campi);
    if (errori.length > 0) {
      toast.error(`Prezzo non valido per: ${errori.join(', ')}. Scrivi un numero maggiore di zero.`);
      return;
    }
    setSalvataggio(true);
    try {
      await writeTariffe(prezziGiorno);
      setSalvate(prezziGiorno);
      setCampi((prima) => {
        const dopo = { ...prima };
        Object.keys(dopo).forEach((k) => {
          dopo[k] = prezziGiorno[k] !== undefined ? String(prezziGiorno[k]) : '';
        });
        return dopo;
      });
      toast.success('Tariffe salvate.');
    } catch (err) {
      console.error('Errore salvataggio tariffe:', err);
      toast.error('Non sono riuscito a salvare le tariffe. Riprova.');
    } finally {
      setSalvataggio(false);
    }
  };

  if (caricamento) return <div className="tariffe-page"><p>Caricamento…</p></div>;
  if (errore) return <div className="tariffe-page"><p className="tariffe-errore">{errore}</p></div>;

  return (
    <div className="tariffe-page">
      <h1>Tariffe per categoria</h1>
      <p className="tariffe-intro">
        Il prezzo al giorno di ogni categoria. È quello che il cliente vede e paga sul sito, e il listino di
        partenza quando crei una prenotazione qui (puoi sempre cambiarlo nella singola prenotazione). Le
        prenotazioni già fatte non cambiano.
      </p>

      {righe.length === 0 ? (
        <p>Non ci sono veicoli con una categoria: aggiungili dalla sezione Veicoli.</p>
      ) : (
        <form onSubmit={salva}>
          <table className="tariffe-tabella">
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
                <tr key={categoria}>
                  <td>{categoria}</td>
                  <td>{numero}</td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Prezzo al giorno ${categoria}`}
                      value={campi[categoria] ?? ''}
                      onChange={(e) => setCampi((prima) => ({ ...prima, [categoria]: e.target.value }))}
                      placeholder="Es. 25"
                    />
                  </td>
                  <td>
                    {salvate[categoria] !== undefined ? (
                      <span className="tariffe-ok">In uso</span>
                    ) : (
                      <span className="tariffe-manca">Da salvare</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="submit" className="tariffe-salva" disabled={salvataggio || !modificato}>
            {salvataggio ? 'Salvo…' : 'Salva tariffe'}
          </button>
          {Object.keys(salvate).length === 0 && (
            <p className="tariffe-nota">
              Non hai ancora salvato nessuna tariffa: i campi sono compilati con il prezzo più basso delle auto di
              ogni categoria. Controllali e premi Salva.
            </p>
          )}
        </form>
      )}
    </div>
  );
}

export default Tariffe;
