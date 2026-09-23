// src/components/VehicleCard.jsx
import React from 'react';
import { Car, Clock } from 'lucide-react';

const SCADENZE = [
  { chiave: 'assicurazione', sigla: 'A', nome: 'Assicurazione' },
  { chiave: 'bollo', sigla: 'B', nome: 'Bollo' },
  { chiave: 'revisione', sigla: 'R', nome: 'Revisione' },
];

function descriviScadenza(nome, data, colore) {
  if (!data) return `${nome}: data non inserita`;
  const quando = new Date(data).toLocaleDateString('it-IT');
  if (colore === 'rosso') return `${nome}: scaduta il ${quando}`;
  return `${nome}: scade il ${quando}`;
}

const VehicleCard = ({
  veicolo,
  onClick,
  calcolaDisponibilitaConsecutiva,
  isDisponibile,
  getScadenzaColor
}) => {
  const disponibile = isDisponibile(veicolo);
  const giorniLiberi = disponibile ? calcolaDisponibilitaConsecutiva(veicolo) : 0;
  const nome = [veicolo.marca, veicolo.modello].filter(Boolean).join(' ') || 'Veicolo senza nome';

  return (
    <article
      className="vcard"
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      tabIndex={0}
      role="button"
      aria-label={`Apri ${nome}`}
    >
      <div className="vcard-foto">
        {veicolo.immagine ? (
          <img src={veicolo.immagine} alt={nome} />
        ) : (
          <Car size={48} className="vcard-foto-vuota" aria-hidden="true" />
        )}
        <span className={`vcard-stato ${disponibile ? 'vcard-stato--libero' : 'vcard-stato--occupato'}`}>
          {disponibile ? 'Disponibile oggi' : 'Occupato oggi'}
        </span>
      </div>

      <div className="vcard-corpo">
        <h3 className="vcard-nome">{nome}</h3>
        <div className="vcard-meta">
          {veicolo.targa && <span className="vcard-targa">{veicolo.targa}</span>}
          {veicolo.categoria && <span className="vcard-categoria">{veicolo.categoria}</span>}
        </div>

        <dl className="vcard-dati">
          <div><dt>Km</dt><dd>{veicolo.km ? Number(veicolo.km).toLocaleString('it-IT') : '—'}</dd></div>
          <div><dt>Anno</dt><dd>{veicolo.anno || '—'}</dd></div>
          <div><dt>Colore</dt><dd>{veicolo.colore || '—'}</dd></div>
        </dl>

        <div className="vcard-piede">
          {/* "Libero per N giorni" solo se oggi e' libero: altrimenti
              contraddirebbe il badge (che conta anche gli hold del sito). */}
          <span className="vcard-libero">
            {disponibile && (
              <>
                <Clock size={14} aria-hidden="true" />
                Libero per {giorniLiberi >= 30 ? '30+' : giorniLiberi} giorni
              </>
            )}
          </span>
          <span className="vcard-scadenze">
            {SCADENZE.map(({ chiave, sigla, nome: nomeScadenza }) => {
              const data = veicolo.scadenze?.[chiave];
              const colore = getScadenzaColor(data);
              return (
                <span
                  key={chiave}
                  className={`vcard-scadenza vcard-scadenza--${colore}`}
                  title={descriviScadenza(nomeScadenza, data, colore)}
                >
                  {sigla}
                </span>
              );
            })}
          </span>
        </div>
      </div>
    </article>
  );
};

export default VehicleCard;
