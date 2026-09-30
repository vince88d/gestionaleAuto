import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { alternaCategoria } from '../utils/filtroCategorie';

// Menu a tendina a selezione multipla per filtrare i veicoli per categoria.
// Chiuso mostra solo "Categoria" (con il numero di categorie scelte); si
// chiude cliccando fuori o con Esc.
function FiltroCategorie({ opzioni, scelte, onChange }) {
  const [aperto, setAperto] = useState(false);
  const contenitore = useRef(null);

  useEffect(() => {
    if (!aperto) return undefined;
    const fuori = (e) => {
      if (contenitore.current && !contenitore.current.contains(e.target)) setAperto(false);
    };
    const esc = (e) => { if (e.key === 'Escape') setAperto(false); };
    document.addEventListener('mousedown', fuori);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('keydown', esc);
    };
  }, [aperto]);

  return (
    <div className="filtro-cat" ref={contenitore}>
      <button
        type="button"
        className={`filtro-cat-bottone${scelte.length ? ' attivo' : ''}`}
        aria-haspopup="true"
        aria-expanded={aperto}
        onClick={() => setAperto((v) => !v)}
      >
        Categoria
        {scelte.length > 0 && <span className="filtro-cat-num">{scelte.length}</span>}
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {aperto && (
        <div className="filtro-cat-menu" role="group" aria-label="Filtra per categoria">
          {opzioni.map(({ nome, conteggio }) => (
            <label key={nome} className="filtro-cat-voce">
              <input
                type="checkbox"
                checked={scelte.includes(nome)}
                onChange={() => onChange(alternaCategoria(scelte, nome))}
              />
              <span className="filtro-cat-nome">{nome}</span>
              <span className="filtro-cat-conteggio">{conteggio}</span>
            </label>
          ))}
          {scelte.length > 0 && (
            <button type="button" className="filtro-cat-azzera" onClick={() => onChange([])}>
              Azzera filtro
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default FiltroCategorie;
