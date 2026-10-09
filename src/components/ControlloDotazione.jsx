import React from 'react';
import { avvisoCatene } from '../utils/dotazione';
import './DotazioneVeicolo.css';

// Consegna, passo 1: "Dotazione a bordo" da controllare. Le voci dell'auto
// partono spuntate: si toglie la spunta a quello che manca. Se l'auto non ha
// la dotazione impostata si parte dalla lista base vuota, con "Salva come
// dotazione di questa auto". `dotazione`: schedaVeicolo.dotazione (vedi
// utils/dotazione.js, dotazioneIniziale).
function ControlloDotazione({ dotazione, onChange, veicolo, dataRitiro, extra = [] }) {
  if (!dotazione) return null;
  const { voci, presenti, impostata, chiaviConsegnate, note, salvaComeDotazione } = dotazione;
  const presente = (v) => presenti.includes(v);
  const aggiorna = (campi) => onChange({ ...dotazione, ...campi });
  const cambia = (v, si) => aggiorna({ presenti: si ? [...presenti, v] : presenti.filter((p) => p !== v) });
  const chiaviAuto = veicolo?.chiavi === 1 || veicolo?.chiavi === 2 ? veicolo.chiavi : null;

  return (
    <section className="pz-sezione">
      <div className="dv-testa">
        <h3 className="pz-titolo-sezione" style={{ margin: 0 }}>Dotazione a bordo</h3>
        <p>{impostata ? 'Togli la spunta a quello che manca' : 'Spunta quello che c\'è a bordo'}</p>
      </div>

      {avvisoCatene(veicolo, dataRitiro) && (
        <p className="dv-inverno">
          <b>Dal 15 novembre al 15 aprile</b> su molte strade servono catene a bordo o gomme invernali: questa auto non
          ha né l'una né l'altra. Valuta di proporre le catene (extra).
        </p>
      )}

      {!impostata && (
        <p className="pz-aiuto" style={{ margin: '0 0 10px' }}>
          <b>Dotazione di questa auto non impostata.</b> Spunta quello che c'è a bordo: con «Salva come dotazione» la
          prossima volta la trovi già pronta (si cambia anche nella scheda del veicolo).
        </p>
      )}

      {impostata ? (
        <div className="dv-controllo">
          {voci.map((v) => (
            <label key={v} className={`dv-check ${presente(v) ? '' : 'dv-check--manca'}`}>
              <input type="checkbox" checked={presente(v)} onChange={(e) => cambia(v, e.target.checked)} />
              {v}
              <span className="dv-stato">{presente(v) ? 'C\'è' : 'MANCA'}</span>
            </label>
          ))}
          {voci.length === 0 && <p className="pz-aiuto" style={{ margin: 0 }}>Nessuna voce nella dotazione di questa auto.</p>}
        </div>
      ) : (
        <div className="pz-spunte">
          {voci.map((v) => (
            <label key={v} className="pz-spunta">
              <input type="checkbox" checked={presente(v)} onChange={(e) => cambia(v, e.target.checked)} />
              {v}
            </label>
          ))}
        </div>
      )}

      <div className="dv-opzioni">
        <span className="dv-chiavi" role="group" aria-label="Chiavi consegnate">
          <b>Chiavi consegnate</b>
          <span className="dv-scelte">
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                className={chiaviConsegnate === n ? 'dv-si' : ''}
                aria-pressed={chiaviConsegnate === n}
                onClick={() => aggiorna({ chiaviConsegnate: n })}
              >
                {n}
              </button>
            ))}
          </span>
        </span>
        {chiaviAuto && <span className="pz-aiuto">L'auto ne ha {chiaviAuto}</span>}
        {!impostata && (
          <label className="dv-gomme">
            <input type="checkbox" checked={salvaComeDotazione} onChange={(e) => aggiorna({ salvaComeDotazione: e.target.checked })} />
            <span><b>Salva come dotazione di questa auto</b></span>
          </label>
        )}
      </div>

      <label className="pz-campo" style={{ marginTop: 12 }}>
        <span className="pz-etichetta">Note sulla dotazione <span style={{ fontWeight: 400, color: '#6b7886' }}>(facoltative)</span></span>
        <input
          type="text"
          value={note}
          onChange={(e) => aggiorna({ note: e.target.value })}
          placeholder="Es. cavo in officina, si consegna domani"
        />
      </label>

      {extra.length > 0 && (
        <p className="dv-extra">
          <b>Extra noleggiati</b> (si danno a parte, li ritrovi nel passo 2): {extra.map((r) => `${r.nome} × ${r.quantita}`).join(', ')}
        </p>
      )}
    </section>
  );
}

export default ControlloDotazione;
