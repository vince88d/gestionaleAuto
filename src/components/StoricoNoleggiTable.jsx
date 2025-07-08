// components/StoricoNoleggiTable.jsx
import React, { useState } from 'react';
import '../styles/StoricoNoleggiTable.css';
import Modal from 'react-modal';

function StoricoNoleggiTable({ noleggi,contratti }) {
  const [noleggioSelezionato, setNoleggioSelezionato] = useState(null);

  return (
    <div className="storico-table-container">
      <table className="storico-table">
        <thead>
          <tr>
            <th>Veicolo</th>
            <th>Targa</th>
            <th>Periodo</th>
            <th>Prezzo</th>            
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
  {noleggi.map((n, idx) => (
    <tr key={idx}>
      <td>{n.veicolo}</td>
      <td>{n.targa}</td>
      <td>{n.dataInizio} - {n.dataFine}</td>
      <td>{n.prezzoTotale} €</td>
      <td>
        <button onClick={() => setNoleggioSelezionato(n)}>
          Dettagli
        </button>
      </td>
    </tr>
  ))}
</tbody>
      </table>

      <Modal
        isOpen={!!noleggioSelezionato}
        onRequestClose={() => setNoleggioSelezionato(null)}
        contentLabel="Dettagli Noleggio"
        className={{ base: 'Modal', afterOpen: 'Modal--after-open', beforeClose: 'Modal--before-close' }}
        overlayClassName="modal-overlay"
        ariaHideApp={false}
      >
        {noleggioSelezionato && (
          <div>
            <h3>Dettagli Noleggio</h3>
            <p><strong>Veicolo:</strong> {noleggioSelezionato.veicolo}</p>
            <p><strong>Targa:</strong> {noleggioSelezionato.targa}</p>
            <p><strong>Periodo:</strong> {noleggioSelezionato.dataInizio} - {noleggioSelezionato.dataFine}</p>
            <p><strong>Prezzo Totale:</strong> {noleggioSelezionato.prezzoTotale} €</p>
          
<div style={{ marginTop: '1.5rem' }}>
  <h4>Danni Riscontrati</h4>

  {noleggioSelezionato.danni?.trim() ? (
    <p style={{ background: '#fef2f2', padding: '0.75rem', borderRadius: '6px', color: '#991b1b' }}>
      {noleggioSelezionato.danni}
    </p>
  ) : (
    <p style={{ fontStyle: 'italic', color: '#6b7280' }}>Nessun danno segnalato.</p>
  )}

  {noleggioSelezionato.schedaVeicolo?.fotoDanni?.trim() ? (
    <img
      src={noleggioSelezionato.schedaVeicolo.fotoDanni}
      alt="Foto danni"
      style={{
        width: '100%',
        marginTop: '1rem',
        border: '1px solid #ddd',
        borderRadius: '8px'
      }}
    />
  ) : (
    <p style={{ fontStyle: 'italic', color: '#6b7280' }}>Nessuna immagine disponibile.</p>
  )}
</div>




{contratti && contratti.length > 0 && (() => {
  // Trova il contratto più vicino per targa e data
  const contrattoMatch = contratti
    .filter(c => c.targa === noleggioSelezionato.targa)
    .sort((a, b) =>
      Math.abs(new Date(a.data) - new Date(noleggioSelezionato.dataInizio)) -
      Math.abs(new Date(b.data) - new Date(noleggioSelezionato.dataInizio))
    )[0];

  return contrattoMatch ? (
    <div style={{ marginTop: '1rem' }}>
      <h4>Contratto Firmato</h4>
      <p><strong>Data:</strong> {new Date(contrattoMatch.data).toLocaleDateString()}</p>
      <a href={contrattoMatch.contratto} target="_blank" rel="noreferrer">
        📄 Visualizza Contratto
      </a>
    </div>
  ) : null;
})()}


            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setNoleggioSelezionato(null)}>Chiudi</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default StoricoNoleggiTable;
