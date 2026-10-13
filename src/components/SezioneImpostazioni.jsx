import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import './SezioneImpostazioni.css';

// Scheda richiudibile (accordion) delle Impostazioni: titolo, riassunto di cosa
// c'e' dentro (solo da chiusa), un'etichetta di stato (es. «Attiva», «Modifiche
// non salvate») e la freccia. Il contenuto resta nella pagina anche da chiuso
// (`hidden`): quello che si sta scrivendo non si perde.
//   tono dello stato: 'ok' | 'attenzione' | 'neutro'
function SezioneImpostazioni({
  Icona, titolo, riassunto = '', descrizione = '', stato = null, aperta = true, onToggle, className = '', children,
}) {
  const id = useId();
  const pulsante = `${id}-pulsante`;
  const pannello = `${id}-pannello`;
  return (
    <section className={`imp-sezione imp-acc ${aperta ? 'imp-acc--aperta' : ''} ${className}`.trim()}>
      <h2 className="imp-acc-titolo">
        <button type="button" id={pulsante} className="imp-acc-pulsante" aria-expanded={aperta} aria-controls={pannello} onClick={onToggle}>
          {Icona && <span className="imp-sezione-icona" aria-hidden="true"><Icona size={18} /></span>}
          <span className="imp-acc-testi">
            <span className="imp-acc-nome">{titolo}</span>
            {!aperta && riassunto && <span className="imp-acc-riassunto">{riassunto}</span>}
          </span>
          {stato && <span className={`imp-acc-stato imp-acc-stato--${stato.tono || 'neutro'}`}>{stato.icona}{stato.testo}</span>}
          <ChevronDown className="imp-acc-freccia" size={20} aria-hidden="true" />
        </button>
      </h2>
      <div id={pannello} role="region" aria-labelledby={pulsante} className="imp-acc-corpo" hidden={!aperta}>
        {descrizione && <p className="imp-acc-descrizione">{descrizione}</p>}
        {children}
      </div>
    </section>
  );
}

export default SezioneImpostazioni;
