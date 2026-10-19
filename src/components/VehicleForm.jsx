// src/components/VehicleForm.jsx
import React from 'react';
import { Car, Upload, X } from 'lucide-react';
import { SCADENZE_VEICOLO } from '../utils/scadenze';
import { normalizzaTarga } from '../utils/validaVeicolo';
import DotazioneVeicolo from './DotazioneVeicolo';
import { idoneitaNeopatentati, kwPerTonnellata, LIMITI_NEOPATENTATI, TIPI_VEICOLO, tipoPer, TARA_CAMPI, taraCampoPer, massaPerRapporto, NOTA_TARA, AVVISO_CONTROLLO, AVVISO_ELETTRICHE_IBRIDE, eElettricaOIbrida } from '../utils/neopatentati';
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

// Potenza e tara dal libretto: il gestionale calcola i kW/t e dice se l'auto
// e' adatta a un neopatentato (utils/neopatentati.js).
// Mockup: formiarent-documenti/mockup/gestionale-sito-neopatentati.html
function SezioneNeopatentati({ formData, input, errori, onChange }) {
  const kwT = kwPerTonnellata(formData.potenzaKw, formData.taraKg, formData.taraCampo);
  const massa = massaPerRapporto(formData.taraKg, formData.taraCampo);
  const idoneita = idoneitaNeopatentati(formData);
  const { esito, limiti } = idoneita;
  const virgola = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });
  return (
    <section className="vf-sezione">
      <h3 className="vd-titolo-sezione">Potenza per i neopatentati</h3>
      <p className="vf-nota">Dal libretto: <b>P.2</b> è la potenza in kW (non i cavalli), <b>G</b> è la tara (massa a vuoto) e <b>G.1</b> la massa in ordine di marcia, in kg: scrivi uno dei due e scegli sotto quale. Per le elettriche e le ibride usa i valori del libretto.</p>
      {eElettricaOIbrida(formData.carburante) && <p className="vf-nota" role="note">{AVVISO_ELETTRICHE_IBRIDE}</p>}
      <div style={{ marginBottom: 14 }}>
      <Campo nome="tipoVeicolo" etichetta="Tipo di veicolo" errore={errori.tipoVeicolo} aiuto="Il limite dei 105 kW vale per le autovetture (libretto, campo J: M1). Furgoni e autocarri hanno solo il limite per tonnellata. Camper: per prudenza come le autovetture.">
        <select id="vf-tipoVeicolo" name="tipoVeicolo" value={formData.tipoVeicolo ?? 'autovettura'} onChange={onChange}>
          {TIPI_VEICOLO.map((t) => <option key={t.valore} value={t.valore}>{t.etichetta}</option>)}
        </select>
      </Campo>
      </div>
      {tipoPer(formData.tipoVeicolo).soggetto && (
      <div className="vf-griglia vf-griglia--3">
        <Campo nome="potenzaKw" etichetta="Potenza (kW)" errore={errori.potenzaKw} aiuto="Libretto, campo P.2">
          {input('potenzaKw', { tipo: 'number', min: 1, step: 1, placeholder: 'Es. 66' })}
        </Campo>
        <Campo nome="taraKg" etichetta="Tara (kg)" errore={errori.taraKg} aiuto="Libretto, campo G o G.1">
          {input('taraKg', { tipo: 'number', min: 1, step: 1, placeholder: 'Es. 1050' })}
        </Campo>
        <div className="vf-campo">
          <span className="vf-etichetta">Rapporto</span>
          <output className="vf-calcolato" aria-live="polite">{kwT === null ? '—' : `${virgola(kwT)} kW/t`}</output>
          <span className="vf-aiuto">
            {massa ? `Calcolato con ${massa.kg.toLocaleString('it-IT')} kg${massa.aggiunti ? ` (tara ${massa.tara.toLocaleString('it-IT')} + ${massa.aggiunti} del conducente)` : ' (massa già col conducente)'}` : 'Calcolato da solo'}
          </span>
        </div>
      </div>
      )}
      {tipoPer(formData.tipoVeicolo).soggetto && (
        <div style={{ marginTop: 12 }}>
          <Campo nome="taraCampo" etichetta="Su che campo del libretto hai letto il peso?" errore={errori.taraCampo} aiuto={NOTA_TARA}>
            <select id="vf-taraCampo" name="taraCampo" value={taraCampoPer(formData.taraCampo)} onChange={onChange}>
              {TARA_CAMPI.map((c) => <option key={c.valore} value={c.valore}>{c.etichetta}</option>)}
            </select>
          </Campo>
        </div>
      )}
      <div className={`vf-esito vf-esito--${esito}`} role="status">
        {esito === 'si' && idoneita.soggetto === false && <><b>Non soggetto ai limiti dei neopatentati</b><span>{idoneita.motivo}.</span></>}
        {esito === 'si' && idoneita.soggetto !== false && <><b>Nei limiti per i neopatentati (secondo i dati inseriti)</b><span>{idoneita.motivo}.</span></>}
        {esito === 'no' && <><b>Oltre i limiti per i neopatentati</b><span>{idoneita.motivo}.</span></>}
        {esito === 'nd' && <><b>Da verificare</b><span>Scrivi potenza e tara: finché mancano, questa auto non si propone a chi ha la patente da meno di {LIMITI_NEOPATENTATI.anni} anni (limiti {limiti.kwPerTonnellata} kW/t{limiti.kwMax === null ? '' : ` e ${limiti.kwMax} kW`}).</span></>}
      </div>
      <p className="vf-nota" style={{ marginTop: 12 }}>{AVVISO_CONTROLLO}</p>
    </section>
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
  dotazioneNonImpostata = false,
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

            <SezioneNeopatentati formData={formData} input={input} errori={errori} onChange={onChange} />

            <DotazioneVeicolo formData={formData} setFormData={setFormData} nonImpostata={dotazioneNonImpostata} />

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
                placeholder="Es. gancio traino, tagliando a 60.000 km…"
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
