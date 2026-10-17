import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Aiuto.css';

// Pulsante «?» accanto alle parole difficili (franchigia, cauzione...): al clic
// apre un fumetto con una spiegazione corta e un esempio. Si apre col clic, non
// passandoci sopra (va anche sul tablet) e resta aperto finche' non lo chiudi
// (X, Esc o clic fuori). E' sempre uguale in tutto il gestionale.
// Regola: quello che serve per non sbagliare va scritto sotto l'etichetta,
// sempre visibile; qui solo l'approfondimento.
// Il fumetto sta sopra tutta la pagina (portal), cosi' un pannello stretto o
// con lo scorrimento non lo taglia; si chiude se la pagina scorre.
// Mockup: formiarent-documenti/mockup/gestionale-aiuti-e-richieste.html
const LARGHEZZA = 310;

export default function Aiuto({ titolo, children, esempio, etichetta }) {
  const [aperto, setAperto] = useState(false);
  const [posizione, setPosizione] = useState(null);
  const radice = useRef(null);
  const fumetto = useRef(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!aperto || !radice.current) return;
    const r = radice.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left - 14, window.innerWidth - LARGHEZZA - 8));
    setPosizione({ top: r.bottom + 8, left, freccia: Math.max(10, r.left + r.width / 2 - left - 7) });
  }, [aperto]);

  useEffect(() => {
    if (!aperto) return undefined;
    const dentro = (el) => radice.current?.contains(el) || fumetto.current?.contains(el);
    const fuori = (e) => { if (!dentro(e.target)) setAperto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAperto(false); };
    const chiudi = (e) => { if (!fumetto.current?.contains(e.target)) setAperto(false); };
    document.addEventListener('mousedown', fuori);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', chiudi, true);
    window.addEventListener('resize', chiudi);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', chiudi, true);
      window.removeEventListener('resize', chiudi);
    };
  }, [aperto]);

  return (
    <span className="aiuto" ref={radice}>
      <button
        type="button"
        className="aiuto-btn"
        aria-expanded={aperto}
        aria-controls={id}
        aria-label={etichetta || titolo}
        onClick={(e) => { e.stopPropagation(); setAperto((v) => !v); }}
      >
        ?
      </button>
      {aperto && createPortal(
        <span
          className="aiuto-fumetto"
          id={id}
          role="dialog"
          aria-label={titolo}
          ref={fumetto}
          style={posizione ? { top: posizione.top, left: posizione.left, '--freccia': `${posizione.freccia}px` } : { visibility: 'hidden' }}
        >
          <button type="button" className="aiuto-chiudi" aria-label="Chiudi" onClick={() => setAperto(false)}>
            <X size={16} aria-hidden="true" />
          </button>
          <b className="aiuto-titolo">{titolo}</b>
          <span className="aiuto-testo">{children}</span>
          {esempio && <span className="aiuto-esempio">{esempio}</span>}
        </span>,
        document.body,
      )}
    </span>
  );
}
