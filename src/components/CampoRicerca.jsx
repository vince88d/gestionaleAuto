import React from 'react';
import { Search } from 'lucide-react';
import './CampoRicerca.css';

// Ricerca per parole: ogni parola scritta deve comparire nel testo dell'elemento.
export function filtraPerTesto(elementi, ricerca, daTesto) {
  const parole = ricerca.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parole.length === 0) return elementi;
  return elementi.filter((el) => {
    const testo = daTesto(el).toLowerCase();
    return parole.every((p) => testo.includes(p));
  });
}

function CampoRicerca({ valore, onChange, placeholder, etichetta }) {
  return (
    <label className="campo-ricerca">
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        value={valore}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={etichetta}
      />
    </label>
  );
}

export default CampoRicerca;
