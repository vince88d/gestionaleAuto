import React from 'react';
import { STATI_FIRMA } from '../utils/firmaVerbale';

// «Firma del cliente» per consegna e rientro: di solito si firma sul foglio
// stampato; se il cliente rifiuta o non c'e', lo si segna qui e il PDF lo
// scrive al posto della firma. Le osservazioni finiscono nel riquadro del PDF.
function FirmaVerbale({ valore, onChange }) {
  const firma = valore || { stato: 'foglio', osservazioni: '' };
  const cambia = (campi) => onChange({ ...firma, ...campi });
  return (
    <section className="pz-sezione">
      <h3 className="pz-titolo-sezione">Firma del cliente</h3>
      {STATI_FIRMA.map((s) => (
        <label key={s.id} className="pz-opzione">
          <input type="radio" name="firma-verbale" checked={firma.stato === s.id} onChange={() => cambia({ stato: s.id })} />
          {s.etichetta}
        </label>
      ))}
      {firma.stato !== 'foglio' && (
        <p className="pz-aiuto" style={{ margin: '4px 0 8px' }}>
          Nel PDF, al posto della firma, comparirà «Firma non apposta» con la data e l&apos;ora di oggi. Scatta le foto dell&apos;auto e consegna comunque la copia del verbale.
        </p>
      )}
      <label className="pz-etichetta" htmlFor="firma-osservazioni" style={{ display: 'block', marginTop: 8 }}>
        Osservazioni del cliente <span className="pz-aiuto">(facoltative: se vuole, anche «firmo con riserva»)</span>
      </label>
      <textarea
        id="firma-osservazioni"
        className="pz-campo"
        rows={2}
        maxLength={500}
        value={firma.osservazioni}
        onChange={(e) => cambia({ osservazioni: e.target.value })}
        placeholder="Se resta vuoto, nel PDF c'è uno spazio da scrivere a mano."
      />
    </section>
  );
}

export default FirmaVerbale;
