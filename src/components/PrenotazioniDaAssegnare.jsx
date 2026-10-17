import React, { useMemo } from 'react';
import { Car } from 'lucide-react';
import { daAssegnare } from '../utils/assegnazioneVeicolo';
import { dataEOra } from '../utils/scadenze';
import { promemoria } from '../utils/regolePrenotazione';

// Avviso in cima a Prenotazioni: prenotazioni del sito gia' pagate che
// aspettano l'auto (il cliente ha pagato una categoria, la targa si sceglie in
// sede). "Scegli l'auto" apre la finestra di scelta (SceltaAutoModal).
// Non mostra nulla se non ce ne sono.
export default function PrenotazioniDaAssegnare({ prenotazioni, oggi, onScegli }) {
  const daFare = useMemo(() => prenotazioni.filter(daAssegnare), [prenotazioni]);

  if (daFare.length === 0) return null;

  return (
    <section className="ads" aria-label="Prenotazioni del sito senza auto">
      <div className="ads-testa">
        <span className="ads-icona" aria-hidden="true"><Car size={22} /></span>
        <div>
          <h2 className="ads-titolo">
            {daFare.length === 1
              ? "1 prenotazione dal sito aspetta l'auto"
              : `${daFare.length} prenotazioni dal sito aspettano l'auto`}
          </h2>
          <p className="ads-spiega">
            Il cliente ha scelto una categoria dal sito (es. «Furgone»): scegli quale auto dargli. Dopo potrai consegnarla.
          </p>
        </div>
      </div>
      {daFare.map((p) => {
        const nota = promemoria(p, oggi);
        return (
          <div key={p.id} className="ads-riga">
            <div className="ads-riga-testi">
              <span className="ads-nome">{p.cliente || 'Cliente non indicato'}</span>
              <span className="ads-det">
                {p.categoria || '—'} · {dataEOra(p.dataInizio, p.oraInizio)} → {dataEOra(p.dataFine, p.oraFine)}
                {nota.livello === 'urgente' && <> · <span className="ads-urgente">{nota.testo.toLowerCase()}</span></>}
              </span>
            </div>
            <button type="button" className="bk-btn bk-btn--scegli" onClick={() => onScegli(p)}>
              <Car size={16} aria-hidden="true" /> Scegli l&apos;auto
            </button>
          </div>
        );
      })}
    </section>
  );
}
