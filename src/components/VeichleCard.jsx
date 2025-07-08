// src/components/VehicleCard.jsx
import React from 'react';
import { CheckCircle, Clock } from 'lucide-react';

const VehicleCard = ({
  veicolo,
  onClick,
  calcolaDisponibilitaConsecutiva,
  isDisponibile,
  getScadenzaColor
}) => {
  return (
    <div
      className="vehicle-card"
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {veicolo.immagine && (
        <img
          src={veicolo.immagine}
          alt="Veicolo"
          className="vehicle-image"
          style={{
            maxHeight: '140px',
            width: '100%',
            objectFit: 'cover',
            borderRadius: '8px',
          }}
        />
      )}
      <h3>{veicolo.modello}</h3>
      <h5>{veicolo.targa}</h5>

      <div className="vehicle-info-grid-card">
        <div><strong>Prezzo:</strong> {veicolo.prezzo}€</div>
        <div><strong>Km:</strong> {veicolo.km}</div>
        <div><strong>Colore:</strong> {veicolo.colore}</div>
        <div><strong>Anno:</strong> {veicolo.anno}</div>
      </div>

      <div className="scadenze-label">Scadenze</div>
      <div className="scadenze-indicatori">
        <span className={`pallino ${getScadenzaColor(veicolo.scadenze?.assicurazione)}`} title="Assicurazione"></span>
        <span className={`pallino ${getScadenzaColor(veicolo.scadenze?.bollo)}`} title="Bollo"></span>
        <span className={`pallino ${getScadenzaColor(veicolo.scadenze?.revisione)}`} title="Revisione"></span>
      </div>

      {isDisponibile(veicolo) ? (
       <div className="badge available">
    <div className="badge-content">
      <CheckCircle size={16} />
      <span>Disponibile oggi</span>
    </div>
  </div>
      ) : (
        <div className="badge unavailable">
    <div className="badge-content">
      <CheckCircle size={16} />
      <span>Occupato oggi</span>
    </div>
  </div>
      )}

      <div className="badge info">
      <div className="badge-content">
    <Clock size={16} />
    <span>Libero per {calcolaDisponibilitaConsecutiva(veicolo)} giorni</span>
  </div>
      </div>
    </div>
  );
};

export default VehicleCard;
