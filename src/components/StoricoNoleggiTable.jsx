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
          
          
            {noleggioSelezionato.danni && (
              <>
                <h4>Danni riportati</h4>
                <p>{noleggioSelezionato.danni}</p>
              </>
            )}
            {noleggioSelezionato.schedaVeicolo?.fotoDanni && (
              <img
                src={noleggioSelezionato.schedaVeicolo.fotoDanni}
                alt="Foto danni"
                style={{ width: '100%', marginTop: '1rem' }}
              />
            )}


            {contratti && contratti.length > 0 && (
  <div style={{ marginTop: '1rem' }}>
    <h4>Contratti disponibili</h4>
    {contratti
      .filter(c => c.targa === noleggioSelezionato.targa)
      .map((c, i) => (
        <div key={i}>
          <a href={c.contratto} target="_blank" rel="noreferrer">
            Contratto del {new Date(c.data).toLocaleDateString()}
          </a>
        </div>
      ))}
  </div>
)}

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
