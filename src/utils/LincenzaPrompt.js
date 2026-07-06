import React, { useState } from 'react';

function LicenzaPrompt({ onSuccess }) {
  const [codice, setCodice] = useState('');
  const [errore, setErrore] = useState('');

  const inviaLicenza = async () => {
    const res = await window.electronAPI.activateLicense(codice, '');

    if (!res.success) {
      setErrore('Codice non valido.');
      return;
    }

    const status = await window.electronAPI.getLicenseStatus();
    if (status.status === 'licensed') {
      onSuccess();
      return;
    }

    setErrore('Codice non valido.');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Attiva Licenza</h2>
      <input
        value={codice}
        onChange={(e) => setCodice(e.target.value)}
        placeholder="Inserisci codice licenza"
        style={{ padding: '0.5rem', marginRight: '1rem' }}
      />
      <button onClick={inviaLicenza}>Attiva</button>
      {errore && <p style={{ color: 'red' }}>{errore}</p>}
    </div>
  );
}

export default LicenzaPrompt;
