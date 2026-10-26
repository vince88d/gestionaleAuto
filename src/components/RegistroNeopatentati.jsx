import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Gauge } from 'lucide-react';
import { vistaRegistro } from '../utils/registroNeopatentati';

const ICONE = { check: CheckCircle2, x: XCircle, alert: AlertTriangle, shield: ShieldCheck };

// Registro del controllo neopatentati fatto alla consegna, nei dettagli della
// prenotazione (scheda Consegna). Sola lettura. Niente per le consegne fatte
// prima di questa funzione.
function RegistroNeopatentati({ registro }) {
  const vista = vistaRegistro(registro);
  if (!vista) return null;
  const Icona = ICONE[vista.esito.icona] || ShieldCheck;
  return (
    <div className="pz-registro">
      <h4 className="pz-titolo-sezione" style={{ margin: '14px 0 8px' }}>Controllo neopatentati</h4>
      <div className={`pz-esito pz-esito--${vista.esito.tono}`}>
        <Icona size={20} aria-hidden="true" />
        <div>
          <b>{vista.esito.titolo}</b>
          {vista.esito.testo}
          {vista.firma && <small>{vista.firma}</small>}
        </div>
      </div>
      {vista.dati.length > 0 && (
        <dl className="pz-dati pz-dati--due" style={{ marginTop: 12 }}>
          {vista.dati.map(([etichetta, valore, intera]) => (
            <div key={etichetta} className={intera ? 'pz-intera' : undefined}>
              <dt>{etichetta}</dt><dd>{valore}</dd>
            </div>
          ))}
        </dl>
      )}
      {vista.velocita && (
        <div className="pz-esito pz-esito--info" style={{ marginTop: 10 }}>
          <Gauge size={20} aria-hidden="true" />
          <div>{vista.velocita}</div>
        </div>
      )}
      {vista.regola && <p className="pz-regola">{vista.regola}</p>}
    </div>
  );
}

export default RegistroNeopatentati;
