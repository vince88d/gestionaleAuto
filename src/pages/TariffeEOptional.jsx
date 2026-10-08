import React, { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
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
  const [prezziNonSalvati, setPrezziNonSalvati] = useState(false);
  const [schedaInAttesa, setSchedaInAttesa] = useState(null);

  const vaiA = (id) => {
    if (id === scheda) return;
    if (scheda === 'tariffe' && prezziNonSalvati) { setSchedaInAttesa(id); return; }
    setScheda(id);
  };
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
            onClick={() => vaiA(s.id)}
          >
            {s.etichetta}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {scheda === 'tariffe' ? <Tariffe incorporata onModifiche={setPrezziNonSalvati} /> : <CatalogoOptional />}
      </div>
      <ConfirmDialog
        open={schedaInAttesa !== null}
        title="Prezzi non salvati"
        message="Hai cambiato dei prezzi e non li hai ancora salvati. Se cambi scheda le modifiche si perdono."
        cancelLabel="Resta qui"
        confirmLabel="Esci senza salvare"
        tone="danger"
        onCancel={() => setSchedaInAttesa(null)}
        onConfirm={() => { setPrezziNonSalvati(false); setScheda(schedaInAttesa); setSchedaInAttesa(null); }}
      />
    </div>
  );
}

export default TariffeEOptional;
