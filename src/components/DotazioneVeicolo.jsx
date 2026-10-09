import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CAVO, VOCI_BASE, elettricaOIbrida, normalizzaVoci, vociDaScegliere } from '../utils/dotazione';
import './DotazioneVeicolo.css';

// Sezione "Dotazione a bordo" del modulo veicolo: cosa deve esserci sempre in
// questa auto, il numero di chiavi e se monta gomme invernali. Alla consegna
// la dotazione si trova gia' spuntata da controllare.
// `nonImpostata`: veicolo esistente a cui non e' mai stata impostata (si
// propone quella minima, da controllare).
function DotazioneVeicolo({ formData, setFormData, nonImpostata = false }) {
  const [nuova, setNuova] = useState('');
  const dotazione = normalizzaVoci(formData.dotazione);
  const voci = vociDaScegliere(dotazione);
  const presente = (v) => dotazione.some((d) => d.toLowerCase() === v.toLowerCase());
  const aggiornaDotazione = (elenco) => setFormData((prev) => ({ ...prev, dotazione: normalizzaVoci(elenco) }));

  const cambia = (voce, si) => aggiornaDotazione(si ? [...dotazione, voce] : dotazione.filter((d) => d.toLowerCase() !== voce.toLowerCase()));
  const aggiungi = () => {
    const testo = nuova.trim();
    if (!testo) return;
    aggiornaDotazione([...dotazione, testo]);
    setNuova('');
  };
  const voceBase = (v) => VOCI_BASE.some((b) => b.toLowerCase() === v.toLowerCase());

  return (
    <section className="vf-sezione">
      <h3 className="vd-titolo-sezione">Dotazione a bordo</h3>
      <p className="dv-aiuto">
        Cosa deve esserci sempre in questa auto: alla consegna lo trovi già spuntato da controllare.
        Gli extra a pagamento (seggiolino, GPS…) si gestiscono in Tariffe e optional.
      </p>
      {nonImpostata && (
        <p className="dv-avviso">Dotazione non ancora impostata: ti proponiamo quella minima, controllala e salva.</p>
      )}
      <div className="dv-voci">
        {voci.map((v) => (
          <label key={v} className={`dv-voce ${presente(v) ? 'dv-voce--si' : ''}`}>
            <input type="checkbox" checked={presente(v)} onChange={(e) => cambia(v, e.target.checked)} />
            <span className="dv-nome">{v}</span>
            {!voceBase(v) && (
              <button type="button" className="dv-togli" onClick={() => cambia(v, false)} aria-label={`Togli ${v}`}>
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </label>
        ))}
      </div>
      <div className="dv-aggiungi">
        <input
          type="text"
          value={nuova}
          onChange={(e) => setNuova(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aggiungi(); } }}
          placeholder="Altra voce, es. tappetini in gomma"
          aria-label="Altra voce della dotazione"
        />
        <button type="button" className="vd-btn" onClick={aggiungi} disabled={!nuova.trim()}>+ Aggiungi</button>
      </div>
      <div className="dv-opzioni">
        <span className="dv-chiavi" role="group" aria-label="Chiavi dell'auto">
          Chiavi dell'auto
          <span className="dv-scelte">
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                className={formData.chiavi === n ? 'dv-si' : ''}
                aria-pressed={formData.chiavi === n}
                onClick={() => setFormData((prev) => ({ ...prev, chiavi: n }))}
              >
                {n}
              </button>
            ))}
          </span>
        </span>
        <label className="dv-gomme">
          <input
            type="checkbox"
            checked={formData.gommeInvernali === true}
            onChange={(e) => setFormData((prev) => ({ ...prev, gommeInvernali: e.target.checked }))}
          />
          Monta gomme invernali o 4 stagioni
        </label>
      </div>
      {elettricaOIbrida(formData) && !presente(CAVO) && (
        <p className="dv-avviso">Auto {String(formData.carburante).toLowerCase()}: controlla che ci sia il <b>cavo di ricarica</b>.</p>
      )}
    </section>
  );
}

export default DotazioneVeicolo;
