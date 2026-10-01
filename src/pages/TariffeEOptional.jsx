import React, { useState } from 'react';
import Tariffe from './Tariffe';
import CatalogoOptional from './CatalogoOptional';
import './TariffeEOptional.css';

const SCHEDE = [
  { id: 'tariffe', etichetta: 'Prezzo per categoria' },
  { id: 'optional', etichetta: 'Optional' },
];

// Pagina "Tariffe e optional": tutto quello che il cliente paga, deciso dallo
// staff. Il sito legge da qui prezzi delle categorie e optional.
function TariffeEOptional() {
  const [scheda, setScheda] = useState('tariffe');
  return (
    <div className="teo">
      <h1 className="teo-titolo">Tariffe e optional</h1>
      <p className="teo-intro">
        Quello che scrivi qui è ciò che il cliente vede e paga sul sito, e il listino di partenza quando prenoti dal gestionale.
      </p>
      <div className="teo-schede" role="tablist" aria-label="Sezioni">
        {SCHEDE.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={scheda === s.id}
            className={`teo-scheda ${scheda === s.id ? 'teo-scheda--attiva' : ''}`}
            onClick={() => setScheda(s.id)}
          >
            {s.etichetta}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {scheda === 'tariffe' ? <Tariffe incorporata /> : <CatalogoOptional />}
      </div>
    </div>
  );
}

export default TariffeEOptional;
