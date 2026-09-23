// components/StoricoNoleggiTable.jsx
import React, { useState } from 'react';
import InfoModal from './InfoModal';
import { prezzoPrenotazione } from '../utils/dashboard';
import { formattaData } from '../utils/scadenze';

const STATI = {
  attiva: 'In corso / prenotata',
  completata: 'Concluso',
};

// Noleggi di un cliente. "Dettagli" apre la stessa scheda della pagina
// Prenotazioni (in sola lettura): dati della consegna, danni alla riconsegna
// e PDF della consegna. Prima c'era una finestra a parte che leggeva campi
// inesistenti (danni sempre "nessuno", prezzo vuoto per il sito, link al
// contratto vuoto).
function StoricoNoleggiTable({ noleggi }) {
  const [noleggioSelezionato, setNoleggioSelezionato] = useState(null);

  return (
    <div className="pz-tabella-contenitore">
      <table className="pz-tabella">
        <thead>
          <tr>
            <th>Periodo</th>
            <th>Veicolo</th>
            <th>Prezzo</th>
            <th>Stato</th>
            <th>Danni</th>
            <th aria-label="Azioni" />
          </tr>
        </thead>
        <tbody>
          {noleggi.map((n) => {
            const danni = [n.schedaVeicolo?.danni && 'alla consegna', n.descrizioneDanno && 'alla riconsegna'].filter(Boolean);
            return (
              <tr key={n.id}>
                <td>{formattaData(n.dataInizio)} → {formattaData(n.dataFine)}</td>
                <td>{n.veicolo || n.categoria || '—'}{n.targa ? ` (${n.targa})` : ''}</td>
                <td>{prezzoPrenotazione(n) ? `€ ${prezzoPrenotazione(n)}` : '—'}</td>
                <td>{STATI[n.status] || n.status}</td>
                <td className={danni.length ? 'pz-testo-pericolo' : ''}>{danni.length ? `Sì, ${danni.join(' e ')}` : 'No'}</td>
                <td className="pz-destra">
                  <button type="button" className="vd-btn vd-btn--piccolo" onClick={() => setNoleggioSelezionato(n)}>Dettagli</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <InfoModal
        isOpen={Boolean(noleggioSelezionato)}
        onClose={() => setNoleggioSelezionato(null)}
        prenotazione={noleggioSelezionato}
        soloLettura
      />
    </div>
  );
}

export default StoricoNoleggiTable;
