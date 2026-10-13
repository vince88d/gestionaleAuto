import React from 'react';

// Riquadro con titolo dei dettagli della prenotazione. Con `senza` mostra solo il
// contenuto: lo usa la scheda richiudibile, che ha gia' il suo titolo.
function CorniceDettagli({ senza = false, titolo, children }) {
  if (senza) return <>{children}</>;
  return (
    <section className="pz-sezione">
      <h3 className="pz-titolo-sezione">{titolo}</h3>
      {children}
    </section>
  );
}

export default CorniceDettagli;
