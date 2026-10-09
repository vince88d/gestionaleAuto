import React from 'react';
import { riassuntoDotazione } from '../utils/dotazione';
import './DotazioneVeicolo.css';

// Cosa c'era a bordo alla consegna: solo le voci presenti, a parte quelle che
// mancavano, chiavi consegnate e note. Legge anche le consegne di prima con
// i vecchi "accessori" (utils/dotazione.js, riassuntoDotazione).
function DotazioneConsegnata({ scheda }) {
  const { presenti, mancanti, chiaviConsegnate, note } = riassuntoDotazione(scheda);
  if (presenti.length === 0 && mancanti.length === 0 && !chiaviConsegnate && !note) {
    return <span>Non segnata</span>;
  }
  return (
    <>
      <ul className="pz-chip-lista">
        {presenti.map((v) => <li key={v} className="pz-chip">✓ {v}</li>)}
        {mancanti.map((v) => <li key={v} className="dv-manca">Mancava: {v}</li>)}
      </ul>
      {(chiaviConsegnate || note) && (
        <p className="pz-aiuto" style={{ margin: '8px 0 0' }}>
          {chiaviConsegnate && <>Chiavi consegnate: <b>{chiaviConsegnate}</b></>}
          {chiaviConsegnate && note && ' · '}
          {note && <>Nota: {note}</>}
        </p>
      )}
    </>
  );
}

export default DotazioneConsegnata;
