// components/LicenzaPrompt.jsx
import React, { useState } from 'react';

function LicenzaPrompt({ onSuccess }) {
  const [codice, setCodice] = useState('');
  const [errore, setErrore] = useState('');

  const inviaLicenza = async () => {
    const nuovaLicenza = { codice, unlocked: codice === 'XYZ123ABC2024' };
    await window.electronAPI.salvaLicenza(nuovaLicenza);

    const res = await window.electronAPI.getLicenseStatus();
    if (res.status === 'licensed') {
      onSuccess();
    } else {
      setErrore('Codice non valido.');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Attiva Licenza</h2>
      <input
        value={codice}
        onChange={e => setCodice(e.target.value)}
        placeholder="Inserisci codice licenza"
        style={{ padding: '0.5rem', marginRight: '1rem' }}
      />
      <button onClick={inviaLicenza}>Attiva</button>
      {errore && <p style={{ color: 'red' }}>{errore}</p>}
    </div>
  );
}

export default LicenzaPrompt;
