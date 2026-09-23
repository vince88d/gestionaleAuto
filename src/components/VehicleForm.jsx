// src/components/VehicleForm.jsx
import React from 'react';
import { Car, Upload, X } from 'lucide-react';
import { SCADENZE_VEICOLO } from '../utils/scadenze';
import { normalizzaTarga } from '../utils/validaVeicolo';
// vd-btn, vd-link, vd-titolo-sezione: stessi pulsanti e titoli della scheda veicolo.
import '../styles/VehicleDetailModal.css';
import '../styles/VehicleForm.css';

const CARBURANTI = ['Benzina', 'Diesel', 'GPL', 'Metano', 'Elettrico', 'Ibrido'];
const CAMBI = ['Manuale', 'Automatico', 'Semi-automatico'];

// Etichetta + campo + eventuale errore sotto.
function Campo({ nome, etichetta, obbligatorio, errore, aiuto, children }) {
  return (
    <label className={`vf-campo ${errore ? 'vf-campo--errore' : ''}`} htmlFor={`vf-${nome}`}>
      <span className="vf-etichetta">
        {etichetta}
        {obbligatorio && <span className="vf-obbligatorio" aria-hidden="true"> *</span>}
      </span>
      {children}
      {errore ? (
        <span className="vf-messaggio-errore" role="alert">{errore}</span>
      ) : (
        aiuto && <span className="vf-aiuto">{aiuto}</span>
      )}
    </label>
  );
}

const VehicleForm = ({
  formData,
  onChange,
  onClose,
  onSubmit,
  onImageSelect,
  isEditing,
  setFormData,
  categorie = [],
  errori = {},
  salvando = false,
}) => {
  const input = (nome, { tipo = 'text', ...altri } = {}) => (
    <input
      id={`vf-${nome}`}
      type={tipo}
      name={nome}
      value={formData[nome] ?? ''}
      onChange={onChange}
      aria-invalid={Boolean(errori[nome])}
      {...altri}
    />
  );

  const titoloVeicolo = [formData.marca, formData.modello].filter(Boolean).join(' ');

  return (
    <div className="vf">
      <header className="vf-testa">
        <div>
          <h2 className="vf-titolo">{isEditing ? 'Modifica veicolo' : 'Nuovo veicolo'}</h2>
          {isEditing && titoloVeicolo && (
            <span className="vf-sottotitolo">
              {titoloVeicolo}
              {formData.targa ? ` · ${formData.targa}` : ''}
            </span>
          )}
        </div>
        <button type="button" className="vf-chiudi" onClick={onClose} aria-label="Chiudi">
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <form className="vf-form" onSubmit={onSubmit} noValidate>
        <div className="vf-corpo">
          <aside className="vf-colonna-foto">
            <div className="vf-foto">
              {formData.immagine ? (
                <img src={formData.immagine} alt="Foto del veicolo" />
              ) : (
                <span className="vf-foto-vuota">
                  <Car size={40} aria-hidden="true" />
                  Nessuna foto
                </span>
              )}
            </div>
            <button type="button" className="vd-btn" onClick={onImageSelect}>
              <Upload size={16} aria-hidden="true" /> {formData.immagine ? 'Cambia foto' : 'Carica foto'}
            </button>
            {formData.immagine && (
              <button
                type="button"
                className="vd-link vd-link--pericolo"
                onClick={() => setFormData((prev) => ({ ...prev, immagine: '' }))}
              >
                Togli foto
              </button>
            )}
            <small className="vf-aiuto">JPG, PNG o WebP. La foto si vede anche sul sito.</small>
          </aside>

          <div className="vf-sezioni">
            <section className="vf-sezione">
              <h3 className="vd-titolo-sezione">Identità</h3>
              <div className="vf-griglia vf-griglia--2">
                <Campo nome="marca" etichetta="Marca" obbligatorio errore={errori.marca}>
                  {input('marca', { placeholder: 'Es. Fiat', autoFocus: !isEditing })}
                </Campo>
                <Campo nome="modello" etichetta="Modello" obbligatorio errore={errori.modello}>
                  {input('modello', { placeholder: 'Es. Ducato' })}
                </Campo>
                <Campo
                  nome="targa"
                  etichetta="Targa"
                  obbligatorio
                  errore={errori.targa}
                  aiuto={isEditing ? 'Se la cambi, si aggiornano anche le sue prenotazioni.' : undefined}
                >
                  <input
                    id="vf-targa"
                    type="text"
                    name="targa"
                    className="vf-targa"
                    placeholder="AB123CD"
                    value={formData.targa ?? ''}
                    aria-invalid={Boolean(errori.targa)}
                    // Maiuscolo e senza spazi mentre si scrive: e' la chiave che
                    // lega il veicolo alle sue prenotazioni.
                    onChange={(e) =>
                      onChange({ target: { name: 'targa', value: normalizzaTarga(e.target.value) } })
                    }
                  />
                </Campo>
                <Campo
                  nome="categoria"
                  etichetta="Categoria"
                  obbligatorio
                  errore={errori.categoria}
                  aiuto={
                    categorie.length === 0
                      ? 'Nessuna categoria: aggiungine una nella sezione Categorie.'
                      : 'Il prezzo al giorno si imposta per categoria, in Tariffe.'
                  }
                >
                  <select
                    id="vf-categoria"
                    name="categoria"
                    value={formData.categoria ?? ''}
                    onChange={onChange}
                    aria-invalid={Boolean(errori.categoria)}
                  >
                    <option value="">Scegli…</option>
                    {categorie.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </Campo>
              </div>
            </section>

            <section className="vf-sezione">
              <h3 className="vd-titolo-sezione">Caratteristiche</h3>
              <div className="vf-griglia vf-griglia--3">
                <Campo nome="anno" etichetta="Anno" errore={errori.anno}>
                  {input('anno', { tipo: 'number', min: 1950, step: 1, placeholder: 'Es. 2022' })}
                </Campo>
                <Campo nome="km" etichetta="Km" errore={errori.km}>
                  {input('km', { tipo: 'number', min: 0, step: 1, placeholder: 'Es. 45000' })}
                </Campo>
                <Campo nome="porte" etichetta="Porte" errore={errori.porte}>
                  {input('porte', { tipo: 'number', min: 1, max: 9, step: 1, placeholder: 'Es. 5' })}
                </Campo>
                <Campo nome="colore" etichetta="Colore">
                  {input('colore', { placeholder: 'Es. Bianco' })}
                </Campo>
                <Campo nome="carburante" etichetta="Carburante">
                  <select id="vf-carburante" name="carburante" value={formData.carburante ?? ''} onChange={onChange}>
                    <option value="">Scegli…</option>
                    {CARBURANTI.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Campo>
                <Campo nome="cambio" etichetta="Cambio">
                  <select id="vf-cambio" name="cambio" value={formData.cambio ?? ''} onChange={onChange}>
                    <option value="">Scegli…</option>
                    {CAMBI.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Campo>
              </div>
            </section>

            <section className="vf-sezione">
              <h3 className="vd-titolo-sezione">Scadenze</h3>
              <div className="vf-griglia vf-griglia--3">
                {SCADENZE_VEICOLO.map(({ chiave, nome }) => (
                  <Campo key={chiave} nome={chiave} etichetta={nome}>
                    <input
                      id={`vf-${chiave}`}
                      type="date"
                      name={chiave}
                      value={formData.scadenze?.[chiave] ?? ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          scadenze: { ...prev.scadenze, [chiave]: e.target.value },
                        }))
                      }
                    />
                  </Campo>
                ))}
              </div>
            </section>

            <section className="vf-sezione">
              <h3 className="vd-titolo-sezione">Note</h3>
              <textarea
                id="vf-note"
                name="note"
                className="vf-note"
                value={formData.note ?? ''}
                onChange={onChange}
                rows={3}
                placeholder="Es. gancio traino, seggiolino incluso…"
                aria-label="Note"
              />
            </section>
          </div>
        </div>

        {/* Barra in fondo sempre visibile: non serve scorrere per salvare. */}
        <footer className="vf-piede">
          {Object.keys(errori).length > 0 && (
            <span className="vf-riepilogo-errori">Controlla i campi segnati in rosso.</span>
          )}
          <button type="button" className="vd-btn" onClick={onClose} disabled={salvando}>
            Annulla
          </button>
          <button type="submit" className="vd-btn vd-btn--primario" disabled={salvando}>
            {salvando ? 'Salvataggio…' : isEditing ? 'Salva modifiche' : 'Aggiungi veicolo'}
          </button>
        </footer>
      </form>
    </div>
  );
};

export default VehicleForm;
