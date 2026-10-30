import React, { useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Blocco richiudibile per le scelte «fuori dal solito» di un modulo (es. cliente
// straniero senza codice fiscale, copia cartacea): chiuso finche' non serve, si
// apre da solo se una scelta e' gia' attiva. `attive` sono i nomi delle scelte
// attive: compaiono accanto al titolo anche da chiuso.
function CasiParticolari({ titolo, attive = [], children }) {
  const [aperto, setAperto] = useState(attive.length > 0);
  const id = useId();
  // I dati possono arrivare dopo l'apertura della finestra: se una scelta risulta attiva, si apre.
  useEffect(() => { if (attive.length > 0) setAperto(true); }, [attive.length]);
  return (
    <div className="pz-intera pz-casi">
      <button
        type="button"
        className="pz-casi-testa"
        aria-expanded={aperto}
        aria-controls={`${id}-corpo`}
        onClick={() => setAperto((prima) => !prima)}
      >
        <span className="pz-casi-titolo">{titolo}</span>
        {attive.map((nome) => <span key={nome} className="pz-casi-attiva">{nome}</span>)}
        <ChevronDown className={`pz-casi-freccia ${aperto ? 'pz-casi-freccia--su' : ''}`} size={18} aria-hidden="true" />
      </button>
      <div id={`${id}-corpo`} className="pz-casi-corpo" hidden={!aperto}>
        {children}
      </div>
    </div>
  );
}

export default CasiParticolari;
