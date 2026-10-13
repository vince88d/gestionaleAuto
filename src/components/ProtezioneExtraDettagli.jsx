import React from 'react';
import { COPERTURE, euro as euroTondo } from '../utils/protezioni';
import { testoSupplemento } from '../utils/etaConducenti';
import CorniceDettagli from './CorniceDettagli';

const euro = (valore) => `${Number(valore || 0).toFixed(2).replace('.', ',')} €`;
const importo = (n) => (typeof n === 'number' ? euroTondo(n) : '—');

// Protezione, franchigie, cauzione ed extra salvati sulla prenotazione (dal
// sito o dal gestionale, stessi campi: vedi utils/sceltaExtra.js). Riquadro
// dei dettagli e del riepilogo della consegna. Le prenotazioni di prima non
// li hanno: non mostra niente.
function ProtezioneExtraDettagli({ prenotazione, senzaCornice = false }) {
  const p = prenotazione?.protezione;
  const extra = (Array.isArray(prenotazione?.optional) ? prenotazione.optional : []).filter((r) => r?.quantita > 0);
  const giovane = prenotazione?.giovaneConducente;
  const eta = typeof prenotazione?.etaConducente === 'number' ? prenotazione.etaConducente : null;
  if (!p && extra.length === 0 && !giovane && eta === null) return null;
  const coperture = p?.copre ? COPERTURE.filter(([k]) => p.copre[k]).map(([, nome]) => nome) : [];

  return (
    <CorniceDettagli senza={senzaCornice} titolo="Protezione ed extra">
      {p && (
        <dl className="pz-dati">
          <div>
            <dt>Protezione</dt>
            <dd>{p.tipo === 'totale' ? `Totale · ${euro(p.prezzo)}` : 'Base (inclusa)'}</dd>
          </div>
          <div><dt>Franchigia danni (paga al massimo)</dt><dd>{importo(p.danni)}</dd></div>
          <div><dt>Franchigia furto (paga al massimo)</dt><dd>{importo(p.furto)}</dd></div>
          <div><dt>Cauzione da bloccare (garanzia)</dt><dd className="pz-prezzo">{importo(p.cauzione)}</dd></div>
          {coperture.length > 0 && (
            <div className="pz-intera"><dt>Copre anche</dt><dd>{coperture.map((n, i) => (i === 0 ? n : n.toLowerCase())).join(', ')}</dd></div>
          )}
        </dl>
      )}
      {extra.length > 0 && (
        <dl className="pz-dati" style={p ? { marginTop: 12 } : undefined}>
          <div className="pz-intera">
            <dt>Extra da consegnare</dt>
            <dd>
              <ul className="pz-chip-lista">
                {extra.map((r) => (
                  <li key={r.id} className="pz-chip">{r.nome} × {r.quantita} · {euro(r.totale)}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      )}
      {(giovane || eta !== null) && (
        <dl className="pz-dati" style={p || extra.length > 0 ? { marginTop: 12 } : undefined}>
          <div className="pz-intera">
            <dt>{giovane ? 'Giovane conducente' : 'Età del conducente'}</dt>
            <dd>
              {giovane
                ? <>{testoSupplemento(giovane).replace('Giovane conducente · ', '')} · <b>{euro(giovane.importo)}</b></>
                : `${eta} anni (nessun supplemento)`}
              {' '}<span className="pz-aiuto-riga">Dichiarata dal cliente: controlla la patente alla consegna.</span>
            </dd>
          </div>
        </dl>
      )}
    </CorniceDettagli>
  );
}

export default ProtezioneExtraDettagli;
