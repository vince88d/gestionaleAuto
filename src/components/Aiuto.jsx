import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import './Aiuto.css';

// Pulsante «?» accanto alle parole difficili (franchigia, cauzione...): al clic
// apre un fumetto con una spiegazione corta e un esempio. Si apre col clic, non
// passandoci sopra (va anche sul tablet) e resta aperto finche' non lo chiudi
// (X, Esc o clic fuori). E' sempre uguale in tutto il gestionale.
// Regola: quello che serve per non sbagliare va scritto sotto l'etichetta,
// sempre visibile; qui solo l'approfondimento.
// Mockup: formiarent-documenti/mockup/gestionale-aiuti-e-richieste.html
export default function Aiuto({ titolo, children, esempio, etichetta }) {
  const [aperto, setAperto] = useState(false);
  const radice = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!aperto) return undefined;
    const fuori = (e) => { if (radice.current && !radice.current.contains(e.target)) setAperto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAperto(false); };
    document.addEventListener('mousedown', fuori);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('keydown', esc);
    };
  }, [aperto]);

  return (
    <span className="aiuto" ref={radice}>
      <button
        type="button"
        className="aiuto-btn"
        aria-expanded={aperto}
        aria-controls={id}
        aria-label={etichetta || `Cosa vuol dire: ${titolo}`}
        onClick={(e) => { e.stopPropagation(); setAperto((v) => !v); }}
      >
        ?
      </button>
      {aperto && (
        <span className="aiuto-fumetto" id={id} role="dialog" aria-label={titolo}>
          <button type="button" className="aiuto-chiudi" aria-label="Chiudi" onClick={() => setAperto(false)}>
            <X size={16} aria-hidden="true" />
          </button>
          <b className="aiuto-titolo">{titolo}</b>
          <span className="aiuto-testo">{children}</span>
          {esempio && <span className="aiuto-esempio">{esempio}</span>}
        </span>
      )}
    </span>
  );
}
