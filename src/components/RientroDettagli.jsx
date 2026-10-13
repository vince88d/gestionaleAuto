import React from 'react';
import { sezioniRientro } from '../utils/pdfRientro';
import CorniceDettagli from './CorniceDettagli';

// Rientro di un noleggio concluso, nei dettagli della prenotazione: gli stessi
// dati del verbale (utils/pdfRientro.js). Niente per i noleggi conclusi prima
// del rientro completo.
function RientroDettagli({ prenotazione, senzaCornice = false }) {
  const sezioni = sezioniRientro(prenotazione);
  if (sezioni.length === 0) return null;
  return (
    <CorniceDettagli senza={senzaCornice} titolo="Rientro">
      {sezioni.map(({ titolo, righe }, i) => {
        // Cliente, veicolo e periodo sono gia' negli altri riquadri.
        const mostrate = i === 0 ? righe.slice(3) : righe;
        return (
          <div key={titolo}>
            {i > 0 && <h4 className="pz-titolo-sezione" style={{ margin: '14px 0 8px' }}>{titolo}</h4>}
            <dl className="pz-dati">
              {mostrate.map(([etichetta, valore]) => (
                <div key={etichetta} className={etichetta === 'Danni nuovi' || etichetta === 'Non tornato' ? 'pz-intera' : undefined}>
                  <dt>{etichetta}</dt><dd>{valore}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </CorniceDettagli>
  );
}

export default RientroDettagli;
