import React, { useEffect, useRef } from 'react';
import './SelezioneMultipla.css';

// Casella di selezione accessibile. `stato`: 'nessuno' | 'alcuni' | 'tutti'
// ('alcuni' = casella a meta', per «Seleziona tutto» di un gruppo).
export function Casella({ stato, onChange, etichetta }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = stato === 'alcuni'; }, [stato]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="sel-casella"
      checked={stato === 'tutti'}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={etichetta}
    />
  );
}

// Barra in basso con quanti elementi sono scelti e le azioni (figli).
export function BarraSelezione({ conteggio, onDeseleziona, children }) {
  if (conteggio === 0) return null;
  return (
    <div className="sel-barra" role="region" aria-label="Elementi selezionati" aria-live="polite">
      <span className="sel-barra-n">{conteggio} {conteggio === 1 ? 'selezionato' : 'selezionati'}</span>
      <button type="button" className="sel-barra-link" onClick={onDeseleziona}>Deseleziona</button>
      {children}
    </div>
  );
}
