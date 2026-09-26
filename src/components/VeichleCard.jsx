// src/components/VehicleCard.jsx
import React from 'react';
import { Car, Clock } from 'lucide-react';
import { SCADENZE_VEICOLO, formattaData, testoScadenza } from '../utils/scadenze';

function descriviScadenza(nome, data) {
  return `${nome}: ${data ? formattaData(data) : 'data non inserita'} (${testoScadenza(data).toLowerCase()})`;
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
      className={`vcard ${veicolo.sospeso ? 'vcard--sospeso' : ''}`}
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
        {veicolo.sospeso ? (
          <span className="vcard-stato vcard-stato--sospeso">Sospeso dal noleggio</span>
        ) : (
          <span className={`vcard-stato ${disponibile ? 'vcard-stato--libero' : 'vcard-stato--occupato'}`}>
            {disponibile ? 'Disponibile oggi' : 'Occupato oggi'}
          </span>
        )}
      </div>

      <div className="vcard-corpo">
        <div className="vcard-titolo">
          <h3 className="vcard-nome">{nome}</h3>
          {/* Prezzo della tariffa di categoria (readVeicoli lo applica ai veicoli). */}
          {veicolo.prezzo ? (
            <span className="vcard-prezzo">
              € {Number(veicolo.prezzo).toLocaleString('it-IT')}<small>/giorno</small>
            </span>
          ) : null}
        </div>
        <div className="vcard-meta">
          {veicolo.targa && <span className="vcard-targa">{veicolo.targa}</span>}
          {veicolo.categoria && <span className="vcard-categoria">{veicolo.categoria}</span>}
        </div>

        <dl className="vcard-dati">
          <div><dt>Km</dt><dd>{veicolo.km ? Number(veicolo.km).toLocaleString('it-IT') : '—'}</dd></div>
          <div><dt>Anno</dt><dd>{veicolo.anno || '—'}</dd></div>
          <div><dt>Colore</dt><dd>{veicolo.colore || '—'}</dd></div>
        </dl>

        {/* "Libero per N giorni" solo se oggi e' libero: altrimenti
            contraddirebbe l'etichetta "Occupato oggi" (che conta anche gli
            hold del sito). */}
        {disponibile && (
          <span className="vcard-libero">
            <Clock size={14} aria-hidden="true" />
            Libero per {giorniLiberi >= 30 ? '30+' : giorniLiberi} giorni
          </span>
        )}

        <div className="vcard-scadenze" aria-label="Scadenze">
          {SCADENZE_VEICOLO.map(({ chiave, breve, nome: nomeScadenza }) => {
            const data = veicolo.scadenze?.[chiave];
            const colore = getScadenzaColor(data);
            return (
              <span
                key={chiave}
                className={`vcard-scadenza vcard-scadenza--${colore}`}
                title={descriviScadenza(nomeScadenza, data)}
              >
                <span className="vcard-scadenza-punto" aria-hidden="true" />
                {breve}
              </span>
            );
          })}
        </div>
      </div>
    </article>
  );
};

export default VehicleCard;
