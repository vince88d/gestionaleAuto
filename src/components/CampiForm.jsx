import React from 'react';
import { Plus, Minus } from 'lucide-react';

// Pezzi dei form dello staff (optional, protezioni): stessa grafica ovunque.
// Gli stili sono in CatalogoOptional.css (prefisso opt-), importato qui.
import '../pages/CatalogoOptional.css';

// Un campo del form: titolo, riga di aiuto, casella, eventuale errore (in
// quest'ordine, come nelle linee guida GOV.UK). Una sola colonna, cosi' le
// caselle restano sempre allineate.
export function Campo({ id, titolo, aiuto, errore, children }) {
  return (
    <div className={`opt-campo ${errore ? 'opt-campo--errore' : ''}`}>
      <label htmlFor={id} className="opt-titolo-campo">{titolo}</label>
      {aiuto && <span id={`${id}-aiuto`} className="opt-aiuto">{aiuto}</span>}
      {children}
      {errore && <span className="opt-errore-campo" role="alert">{errore}</span>}
    </div>
  );
}

// Importo in euro: il simbolo sta dentro la casella, si scrive a mano (anche i centesimi).
export function CampoEuro({ id, valore, onChange, placeholder, invalido }) {
  return (
    <div className="opt-euro">
      <input id={id} className="opt-input" type="text" inputMode="decimal" value={valore} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-describedby={`${id}-aiuto`} aria-invalid={invalido || undefined} />
      <span className="opt-euro-simbolo" aria-hidden="true">€</span>
    </div>
  );
}

// Quantita': pulsanti − e + grandi, di uno in uno. Vuoto resta "senza limite"
// finche' non si preme +.
export function Contatore({ id, nome, valore, minimo, onChange, placeholder }) {
  const numero = valore === '' ? null : Number(valore);
  const meno = () => {
    if (numero === null || Number.isNaN(numero)) return;
    onChange(String(Math.max(minimo, numero - 1)));
  };
  const piu = () => onChange(String(numero === null || Number.isNaN(numero) ? Math.max(minimo, 1) : numero + 1));
  return (
    <div className="opt-contatore">
      <button type="button" className="opt-contatore-btn" onClick={meno} disabled={numero === null || numero <= minimo} aria-label={`Uno in meno, ${nome}`}>
        <Minus size={18} aria-hidden="true" />
      </button>
      <input id={id} className="opt-input" type="text" inputMode="numeric" value={valore} onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))} placeholder={placeholder} aria-describedby={`${id}-aiuto`} />
      <button type="button" className="opt-contatore-btn" onClick={piu} aria-label={`Uno in più, ${nome}`}>
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
