import React, { useRef, useState } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { Upload, X } from 'lucide-react';
import { caricaFotoDanno } from '../lib/storageFoto';
import { formattaData, giornoLocale } from '../utils/scadenze';
import { controllaPatente } from '../utils/validaCliente';
import '../components/schedaModal.css';
import '../styles/Prenotazione.css';

const ACCESSORI = [
  ['cric', 'Cric'],
  ['triangolo', 'Triangolo'],
  ['giubbotto', 'Giubbotto'],
  ['ruotaScorta', 'Ruota di scorta'],
  ['cavoRicarica', 'Cavo ricarica'],
  ['cateneNeve', 'Catene da neve'],
];

const LIVELLI_CARBURANTE = ['1/4', '1/2', '3/4', 'Pieno'];

// Passi della consegna, mostrati in testa alla scheda e al riepilogo.
export function PassiConsegna({ attivo }) {
  const passo = (numero, testo) => {
    const stato = numero < attivo ? 'fatto' : numero === attivo ? 'attivo' : '';
    return (
      <span className={`pz-passo ${stato ? `pz-passo--${stato}` : ''}`}>
        <span className="pz-passo-numero">{numero < attivo ? '✓' : numero}</span>
        {testo}
      </span>
    );
  };
  return (
    <div className="pz-passi" aria-label={`Passo ${attivo} di 2`}>
      {passo(1, 'Stato del veicolo')}
      <span className="pz-passi-linea" aria-hidden="true" />
      {passo(2, 'Riepilogo e contratto')}
    </div>
  );
}

// Primo passo della consegna: stato del veicolo quando lo si da' al cliente.
// Il secondo passo e' il riepilogo con contratto e PDF.
function SchedaVeicoloModal({
  isOpen,
  onRequestClose,
  prenotazione,
  schedaVeicolo,
  setSchedaVeicolo,
  cliente,
  documenti = {},
  onDocumentiChange,
  onSave,
}) {
  const [uploading, setUploading] = useState(false);
  const [mancaCarburante, setMancaCarburante] = useState(false);
  const inputFoto = useRef(null);
  // La patente si chiede solo se la prenotazione non ce l'ha (es. arrivata dal
  // sito); la scadenza se il cliente in anagrafica non ce l'ha.
  const chiediPatente = Boolean(prenotazione) && !prenotazione.patente;
  const scadenzaInAnagrafica = cliente?.scadenzaPatente || '';
  const chiediScadenza = Boolean(prenotazione) && !scadenzaInAnagrafica;
  const scadenzaPatente = scadenzaInAnagrafica || documenti.scadenzaPatente || '';
  const esitoPatente = prenotazione
    ? controllaPatente(scadenzaPatente, {
        ritiro: giornoLocale() > prenotazione.dataInizio ? giornoLocale() : prenotazione.dataInizio,
        riconsegna: prenotazione.dataFine,
      })
    : {};
  const documentoScaduto = cliente?.scadenzaDocumento && cliente.scadenzaDocumento < giornoLocale();
  const aggiornaDocumento = (campo, valore) => onDocumentiChange({ ...documenti, [campo]: valore });

  const aggiorna = (campo, valore) => setSchedaVeicolo((prev) => ({ ...prev, [campo]: valore }));
  const aggiornaAccessorio = (chiave, valore) =>
    setSchedaVeicolo((prev) => ({ ...prev, accessori: { ...prev.accessori, [chiave]: valore } }));

  // Prima la foto finiva in una cartella del PC e nella prenotazione restava un
  // percorso che dagli altri computer non si apriva: ora va su Storage (danni/).
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const indirizzo = await caricaFotoDanno(file);
      aggiorna('fotoDanni', indirizzo);
    } catch (err) {
      console.error('Errore caricamento foto danni:', err);
      toast.error(err.message || 'Foto non caricata, riprova.');
    } finally {
      setUploading(false);
    }
  };

  const invia = (e) => {
    e.preventDefault();
    // Il carburante e' a pulsanti: il browser non lo controlla da solo.
    if (esitoPatente.blocca) {
      toast.error(esitoPatente.blocca);
      return;
    }
    if (!schedaVeicolo.carburante) {
      setMancaCarburante(true);
      return;
    }
    onSave();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      closeTimeoutMS={300}
      contentLabel="Consegna del veicolo"
      className={{ base: 'Modal pz-modal', afterOpen: 'Modal--after-open', beforeClose: 'Modal--before-close' }}
      overlayClassName={{ base: 'Overlay', afterOpen: 'Overlay--after-open', beforeClose: 'Overlay--before-close' }}
    >
      <form className="pz pz-form" onSubmit={invia}>
        <header className="pz-testa">
          <div>
            <h2 className="pz-titolo">Consegna del veicolo</h2>
            {prenotazione && (
              <span className="pz-sottotitolo">
                {prenotazione.cliente} · {prenotazione.veicolo} ({prenotazione.targa}) ·
                {' '}{formattaData(prenotazione.dataInizio)} → {formattaData(prenotazione.dataFine)}
              </span>
            )}
            <PassiConsegna attivo={1} />
          </div>
          <button type="button" className="pz-chiudi" onClick={onRequestClose} aria-label="Chiudi">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pz-corpo">
          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Documenti del cliente</h3>
            {(chiediPatente || chiediScadenza) ? (
              <div className="pz-griglia pz-griglia--2">
                {chiediPatente ? (
                  <label className="pz-campo" htmlFor="consegna-patente">
                    <span className="pz-etichetta">Numero patente <span className="pz-obbligatorio">*</span></span>
                    <input
                      id="consegna-patente"
                      type="text"
                      value={documenti.patente || ''}
                      onChange={(e) => aggiornaDocumento('patente', e.target.value)}
                      placeholder="Es. AB1234567"
                      style={{ textTransform: 'uppercase' }}
                      required
                    />
                  </label>
                ) : (
                  <div className="pz-campo">
                    <span className="pz-etichetta">Numero patente</span>
                    <strong style={{ fontSize: 14, lineHeight: '40px' }}>{prenotazione.patente}</strong>
                  </div>
                )}
                {chiediScadenza ? (
                  <label className="pz-campo" htmlFor="consegna-scadenza-patente">
                    <span className="pz-etichetta">Scadenza patente <span className="pz-obbligatorio">*</span></span>
                    <input
                      id="consegna-scadenza-patente"
                      type="date"
                      value={documenti.scadenzaPatente || ''}
                      onChange={(e) => aggiornaDocumento('scadenzaPatente', e.target.value)}
                      required
                    />
                  </label>
                ) : (
                  <div className="pz-campo">
                    <span className="pz-etichetta">Scadenza patente</span>
                    <strong style={{ fontSize: 14, lineHeight: '40px' }}>{formattaData(scadenzaPatente)}</strong>
                  </div>
                )}
                <p className="pz-aiuto pz-intera">
                  Controlla la patente in sede. I dati vanno anche nella scheda del cliente
                  {cliente ? '' : ', che verrà aggiunto ai Clienti'}.
                </p>
              </div>
            ) : (
              <dl className="pz-dati">
                <div><dt>Numero patente</dt><dd>{prenotazione?.patente}</dd></div>
                <div><dt>Scadenza patente</dt><dd>{formattaData(scadenzaPatente)}</dd></div>
              </dl>
            )}
            {esitoPatente.blocca && <p className="pz-avviso pz-avviso--errore" role="alert" style={{ marginTop: 12 }}>{esitoPatente.blocca}</p>}
            {esitoPatente.avviso && <p className="pz-avviso pz-avviso--attenzione" style={{ marginTop: 12 }}>{esitoPatente.avviso}</p>}
            {documentoScaduto && (
              <p className="pz-avviso pz-avviso--attenzione" style={{ marginTop: 12 }}>
                Il documento d'identità del cliente è scaduto il {formattaData(cliente.scadenzaDocumento)}: fattene mostrare uno valido e aggiornalo nei Clienti.
              </p>
            )}
          </section>

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Stato del veicolo</h3>
            <div className="pz-griglia pz-griglia--2">
              <div className={`pz-campo ${mancaCarburante ? 'pz-campo--errore' : ''}`}>
                <span className="pz-etichetta" id="consegna-carburante">
                  Carburante <span className="pz-obbligatorio">*</span>
                </span>
                <div className="pz-scelte" role="radiogroup" aria-labelledby="consegna-carburante">
                  {LIVELLI_CARBURANTE.map((livello) => (
                    <button
                      key={livello}
                      type="button"
                      role="radio"
                      aria-checked={schedaVeicolo.carburante === livello}
                      className={`pz-scelta ${schedaVeicolo.carburante === livello ? 'pz-scelta--attiva' : ''}`}
                      onClick={() => { aggiorna('carburante', livello); setMancaCarburante(false); }}
                    >
                      {livello}
                    </button>
                  ))}
                </div>
                {mancaCarburante && <p className="pz-errore" role="alert">Scegli il livello del carburante.</p>}
              </div>
              <label className="pz-campo" htmlFor="consegna-km">
                <span className="pz-etichetta">Km alla consegna <span className="pz-obbligatorio">*</span></span>
                <input
                  id="consegna-km"
                  type="number"
                  min="0"
                  value={schedaVeicolo.kmIniziali}
                  onChange={(e) => aggiorna('kmIniziali', e.target.value)}
                  placeholder="Es. 45000"
                  required
                />
                <p className="pz-aiuto">Proposti dal veicolo: correggili se il contachilometri dice altro.</p>
              </label>
            </div>
          </section>

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Accessori a bordo</h3>
            <div className="pz-spunte">
              {ACCESSORI.map(([chiave, nome]) => (
                <label key={chiave} className="pz-spunta">
                  <input
                    type="checkbox"
                    checked={Boolean(schedaVeicolo.accessori?.[chiave])}
                    onChange={(e) => aggiornaAccessorio(chiave, e.target.checked)}
                  />
                  {nome}
                </label>
              ))}
            </div>
            <label className="pz-campo" style={{ marginTop: 12 }}>
              <span className="pz-etichetta">Altro</span>
              <input
                type="text"
                value={schedaVeicolo.accessori?.altro || ''}
                onChange={(e) => aggiornaAccessorio('altro', e.target.value)}
                placeholder="Es. seggiolino bimbi"
              />
            </label>
          </section>

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Danni già presenti</h3>
            <label className="pz-campo">
              <span className="pz-etichetta">Descrizione</span>
              <textarea
                value={schedaVeicolo.danni}
                onChange={(e) => aggiorna('danni', e.target.value)}
                rows={3}
                placeholder="Es. graffio sul paraurti posteriore. Lascia vuoto se non ce ne sono."
              />
            </label>
            <div className="pz-foto">
              {schedaVeicolo.fotoDanni && <img src={schedaVeicolo.fotoDanni} alt="Danni alla consegna" />}
              <input ref={inputFoto} type="file" accept="image/*" hidden onChange={handleImageUpload} />
              <button type="button" className="vd-btn" onClick={() => inputFoto.current?.click()} disabled={uploading}>
                <Upload size={16} aria-hidden="true" />
                {uploading ? 'Caricamento…' : schedaVeicolo.fotoDanni ? 'Cambia foto' : 'Aggiungi foto'}
              </button>
            </div>
          </section>
        </div>

        <footer className="pz-piede">
          <button type="button" className="vd-btn" onClick={onRequestClose}>Annulla</button>
          <button type="submit" className="vd-btn vd-btn--primario" disabled={uploading || Boolean(esitoPatente.blocca)}>
            {uploading ? 'Attendi…' : 'Avanti: riepilogo e contratto'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export default SchedaVeicoloModal;
