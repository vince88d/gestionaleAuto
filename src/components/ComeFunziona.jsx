import React from 'react';
import { Info } from 'lucide-react';
import './Aiuto.css';

// Riquadro azzurro «Come funziona» in cima a una pagina: in 2-3 passi
// numerati dice a cosa serve. Quello che serve a pochi va in `dettagli`,
// dietro «Leggi di più».
// Mockup: formiarent-documenti/mockup/gestionale-aiuti-e-richieste.html
export default function ComeFunziona({ passi, dettagli }) {
  return (
    <aside className="come" aria-label="Come funziona">
      <Info size={22} className="come-icona" aria-hidden="true" />
      <div>
        <b className="come-titolo">Come funziona</b>
        <ol>{passi.map((p, i) => <li key={i}>{p}</li>)}</ol>
        {dettagli && (
          <details>
            <summary>Leggi di più</summary>
            <p>{dettagli}</p>
          </details>
        )}
      </div>
    </aside>
  );
}
