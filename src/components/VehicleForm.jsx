// src/components/VehicleForm.jsx
import React from 'react';
import { CheckCircle, UploadCloud, XCircle } from 'lucide-react';

const VehicleForm = ({
  formData,
  onChange,
  onClose,
  onSubmit,
  onImageSelect,
  isEditing,
  setFormData,
}) => {
  return (
    <>
    <button onClick={onClose} className="close-modal-btn">
  <XCircle size={30} />
</button>

<h2 style={{ marginTop: 0 }}>{isEditing ? 'Modifica Veicolo' : 'Aggiungi Veicolo'}</h2>


      <form onSubmit={onSubmit} className="vehicle-form two-columns">
        {/* Immagine */}
        <div className="form-group full-width">
          <label>Immagine Veicolo</label>
          <button type="button" onClick={onImageSelect} className="upload-btn">
            <UploadCloud size={20} />
          </button>
          {formData.immagine && (
            <img
              src={formData.immagine}
              alt="Anteprima"
              className="vehicle-preview"
            />
          )}
        </div>

        {/* Campi standard */}
        {[
          { name: 'modello', label: 'Modello' },
          { name: 'marca', label: 'Marca' },
          { name: 'targa', label: 'Targa' },
          { name: 'anno', label: 'Anno', type: 'number' },
          { name: 'colore', label: 'Colore' },
          { name: 'km', label: 'KM', type: 'number' },
          { name: 'porte', label: 'Porte', type: 'number' },
        ].map(({ name, label, type = 'text' }) => (
          <div className="form-group" key={name}>
            <label>{label}</label>
            <input
              type={type}
              name={name}
              value={formData[name]}
              onChange={onChange}
            />
          </div>
        ))}

        {/* Select carburante */}
        <div className="form-group">
          <label>Carburante</label>
          <select name="carburante" value={formData.carburante} onChange={onChange}>
            <option value="">Seleziona...</option>
            {['Benzina', 'Diesel', 'GPL', 'Elettrico', 'Ibrido'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Select cambio */}
        <div className="form-group">
          <label>Cambio</label>
          <select name="cambio" value={formData.cambio} onChange={onChange}>
            <option value="">Seleziona...</option>
            {['Manuale', 'Automatico', 'Semi-automatico'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Select categoria */}
        <div className="form-group">
          <label>Categoria</label>
          <select name="categoria" value={formData.categoria} onChange={onChange}>
            <option value="">Seleziona...</option>
            {[
              'City Car', 'SUV', 'Furgone', 'Lusso', 'Sportiva', 'Motociclo',
              'Imbarcazione', 'Acquascooter', 'Mini Van', 'Utilitaria', 'Berlina',
              'Elettrica', 'Ibrida'
            ].map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <small className="hint-tariffe">Il prezzo al giorno si imposta per categoria, nella sezione Tariffe.</small>
        </div>

        {/* Note */}
        <div className="form-group full-width">
          <label>Note</label>
          <textarea
            name="note"
            value={formData.note}
            onChange={onChange}
            rows="3"
          />
        </div>

        {/* Scadenze */}
        {['assicurazione', 'bollo', 'revisione'].map((sc) => (
          <div className="form-group full-width" key={sc}>
            <label>Scadenza {sc.charAt(0).toUpperCase() + sc.slice(1)}</label>
            <input
              type="date"
              name={sc}
              value={formData.scadenze[sc]}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  scadenze: { ...prev.scadenze, [sc]: e.target.value },
                }))
              }
            />
          </div>
        ))}

        <button type="submit" className="save-btn">
          <CheckCircle size={18} /> {isEditing ? 'Salva Modifiche' : 'Aggiungi Veicolo'}
        </button>
      </form>
    </>
  );
};

export default VehicleForm;
