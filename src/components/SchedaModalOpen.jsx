import React, { useRef, useState } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { Upload, X } from 'lucide-react';
import { caricaFotoDanno } from '../lib/storageFoto';
import FotoDalTelefono from './FotoDalTelefono';
import { formattaData, giornoLocale } from '../utils/scadenze';
import { controllaPatente } from '../utils/validaCliente';
import { codiceFiscaleValido } from '../utils/nuovaPrenotazione';
import { erroriConsegna, riassuntoErrori } from '../utils/controlloConsegna';
import { controlloEtaConsegna } from '../utils/etaConducenti';
import { controlloAbbinamento, statoVelocita, testoVelocita, AVVISO_CONTROLLO, AVVISO_ELETTRICHE_IBRIDE, eElettricaOIbrida } from '../utils/neopatentati';
import { pagataSulSito } from '../utils/regolePrenotazione';
import ControlloDotazione from './ControlloDotazione';
import SchemaDanni from './SchemaDanni';
import { segniDi, senzaDescrizione, testoDanni } from '../utils/schemaDanni';
import '../components/schedaModal.css';
import '../styles/Prenotazione.css';

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
  // Il veicolo da consegnare: dotazione, chiavi, gomme invernali.
  veicolo,
  // Regole sull'eta' (lib/firestoreEtaConducenti.js): promemoria sull'eta' dichiarata.
  etaConducenti = null,
}) {
  const [uploading, setUploading] = useState(false);
  // Dopo il primo «Avanti» i campi mancanti si segnano e si aggiornano mentre si compilano.
  const [provato, setProvato] = useState(false);
  const inputFoto = useRef(null);
  // La patente si chiede solo se la prenotazione non ce l'ha (es. arrivata dal
  // sito); la scadenza se il cliente in anagrafica non ce l'ha.
  const patenteNota = prenotazione?.patente || cliente?.patente || '';
  const chiediPatente = Boolean(prenotazione) && !patenteNota;
  // Anche il codice fiscale si puo' lasciare vuoto prenotando: serve qui, per
  // il contratto e per mettere il cliente in anagrafica.
  const chiediCodiceFiscale = Boolean(prenotazione) && !codiceFiscaleValido(prenotazione.codiceFiscale);
  const scadenzaInAnagrafica = cliente?.scadenzaPatente || '';
  const chiediScadenza = Boolean(prenotazione) && !scadenzaInAnagrafica;
  const scadenzaPatente = scadenzaInAnagrafica || documenti.scadenzaPatente || '';
  // Data di rilascio: dalla prenotazione o dall'anagrafica, altrimenti si chiede (limiti neopatentati).
  const rilascioNoto = prenotazione?.rilascioPatente || cliente?.rilascioPatente || '';
  const chiediRilascio = Boolean(prenotazione) && !rilascioNoto;
  const rilascioPatente = rilascioNoto || documenti.rilascioPatente || '';
  const neopatentati = prenotazione && veicolo
    ? controlloAbbinamento({ veicolo, rilascio: rilascioPatente, ritiro: giornoLocale() > prenotazione.dataInizio ? giornoLocale() : prenotazione.dataInizio })
    : null;
  const velocita = prenotazione ? statoVelocita(rilascioPatente, giornoLocale() > prenotazione.dataInizio ? giornoLocale() : prenotazione.dataInizio) : { soggetto: null, finoAl: null };
  const esitoPatente = prenotazione
    ? controllaPatente(scadenzaPatente, {
        ritiro: giornoLocale() > prenotazione.dataInizio ? giornoLocale() : prenotazione.dataInizio,
        riconsegna: prenotazione.dataFine,
      })
    : {};
  // Danni segnati sullo schema (o il vecchio testo, per le prenotazioni di prima).
  const segniConsegna = segniDi(schedaVeicolo.segniDanni, schedaVeicolo.danni);
  const cambiaDanni = (segni) => setSchedaVeicolo((prev) => ({ ...prev, segniDanni: segni, danni: testoDanni(segni) }));
  const errori = provato ? erroriConsegna({
    chiediCodiceFiscale, codiceFiscaleValido: codiceFiscaleValido(documenti.codiceFiscale),
    chiediPatente, patente: documenti.patente,
    chiediScadenza, scadenzaPatente: documenti.scadenzaPatente,
    chiediRilascio, rilascioPatente: documenti.rilascioPatente,
    carburante: schedaVeicolo.carburante, km: schedaVeicolo.kmIniziali,
    danniSenzaDescrizione: senzaDescrizione(segniConsegna).length,
  }) : [];
  const erroreDi = (campo) => errori.find((e) => e.campo === campo)?.messaggio;
  const documentoScaduto = cliente?.scadenzaDocumento && cliente.scadenzaDocumento < giornoLocale();
  // Eta' dichiarata: con il codice fiscale si controlla da sola.
  const avvisoEta = prenotazione && etaConducenti ? controlloEtaConsegna({
    prenotazione,
    etaConducenti,
    codiceFiscale: codiceFiscaleValido(prenotazione.codiceFiscale) ? prenotazione.codiceFiscale : documenti.codiceFiscale,
    oggi: giornoLocale(),
    // Le richieste senza pagamento si pagano al ritiro: la differenza si corregge prima.
    pagataSulSito: pagataSulSito(prenotazione) && !prenotazione.richiestaSenzaPagamento,
  }) : null;
  const aggiornaDocumento = (campo, valore) => onDocumentiChange({ ...documenti, [campo]: valore });

  const aggiorna = (campo, valore) => setSchedaVeicolo((prev) => ({ ...prev, [campo]: valore }));

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

  // Porta lo sguardo sul primo campo mancante: scorre fin li' e lo seleziona.
  const vaiAlCampo = (campo) => {
    const id = { codiceFiscale: 'consegna-codice-fiscale', patente: 'consegna-patente', scadenzaPatente: 'consegna-scadenza-patente', rilascioPatente: 'consegna-rilascio-patente', km: 'consegna-km' }[campo];
    const elemento = campo === 'carburante'
      ? document.querySelector('#consegna-carburante-scelte button')
      : campo === 'danni'
        ? document.querySelector('.sd-errore')
        : document.getElementById(id);
    if (!elemento) return;
    elemento.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    elemento.focus?.({ preventScroll: true });
  };

  const invia = (e) => {
    e.preventDefault();
    setProvato(true);
    const mancanti = erroriConsegna({
      chiediCodiceFiscale, codiceFiscaleValido: codiceFiscaleValido(documenti.codiceFiscale),
      chiediPatente, patente: documenti.patente,
      chiediScadenza, scadenzaPatente: documenti.scadenzaPatente,
      chiediRilascio, rilascioPatente: documenti.rilascioPatente,
      carburante: schedaVeicolo.carburante, km: schedaVeicolo.kmIniziali,
    danniSenzaDescrizione: senzaDescrizione(segniConsegna).length,
    });
    if (mancanti.length > 0) {
      vaiAlCampo(mancanti[0].campo);
      return;
    }
    if (neopatentati && !neopatentati.ok) {
      toast.error(neopatentati.messaggio);
      return;
    }
    if (esitoPatente.blocca) {
      toast.error(esitoPatente.blocca);
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
      <form className="pz pz-form" onSubmit={invia} noValidate>
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
            {(chiediPatente || chiediScadenza || chiediCodiceFiscale || chiediRilascio) ? (
              <div className="pz-griglia pz-griglia--2">
                {chiediCodiceFiscale && (
                  <label className={`pz-campo pz-intera ${erroreDi('codiceFiscale') ? 'pz-campo--errore' : ''}`} htmlFor="consegna-codice-fiscale">
                    <span className="pz-etichetta">Codice fiscale <span className="pz-obbligatorio">*</span></span>
                    <input
                      id="consegna-codice-fiscale"
                      type="text"
                      value={documenti.codiceFiscale || ''}
                      onChange={(e) => aggiornaDocumento('codiceFiscale', e.target.value)}
                      placeholder="Es. RSSMRA80A01H501U"
                      maxLength={16}
                      style={{ textTransform: 'uppercase' }}
                      required
                      aria-invalid={Boolean(erroreDi('codiceFiscale'))}
                    />
                    {erroreDi('codiceFiscale') && <p className="pz-errore" role="alert">{erroreDi('codiceFiscale')}</p>}
                  </label>
                )}
                {chiediPatente ? (
                  <label className={`pz-campo ${erroreDi('patente') ? 'pz-campo--errore' : ''}`} htmlFor="consegna-patente">
                    <span className="pz-etichetta">Numero patente <span className="pz-obbligatorio">*</span></span>
                    <input
                      id="consegna-patente"
                      type="text"
                      value={documenti.patente || ''}
                      onChange={(e) => aggiornaDocumento('patente', e.target.value)}
                      placeholder="Es. AB1234567"
                      style={{ textTransform: 'uppercase' }}
                      required
                      aria-invalid={Boolean(erroreDi('patente'))}
                    />
                    {erroreDi('patente') && <p className="pz-errore" role="alert">{erroreDi('patente')}</p>}
                  </label>
                ) : (
                  <div className="pz-campo">
                    <span className="pz-etichetta">Numero patente</span>
                    <strong style={{ fontSize: 14, lineHeight: '40px' }}>{patenteNota}</strong>
                  </div>
                )}
                {chiediScadenza ? (
                  <label className={`pz-campo ${erroreDi('scadenzaPatente') ? 'pz-campo--errore' : ''}`} htmlFor="consegna-scadenza-patente">
                    <span className="pz-etichetta">Scadenza patente <span className="pz-obbligatorio">*</span></span>
                    <input
                      id="consegna-scadenza-patente"
                      type="date"
                      value={documenti.scadenzaPatente || ''}
                      onChange={(e) => aggiornaDocumento('scadenzaPatente', e.target.value)}
                      required
                      aria-invalid={Boolean(erroreDi('scadenzaPatente'))}
                    />
                    {erroreDi('scadenzaPatente') && <p className="pz-errore" role="alert">{erroreDi('scadenzaPatente')}</p>}
                  </label>
                ) : (
                  <div className="pz-campo">
                    <span className="pz-etichetta">Scadenza patente</span>
                    <strong style={{ fontSize: 14, lineHeight: '40px' }}>{formattaData(scadenzaPatente)}</strong>
                  </div>
                )}
                {chiediRilascio ? (
                  <label className={`pz-campo ${erroreDi('rilascioPatente') ? 'pz-campo--errore' : ''}`} htmlFor="consegna-rilascio-patente">
                    <span className="pz-etichetta">Patente rilasciata il <span className="pz-obbligatorio">*</span></span>
                    <input
                      id="consegna-rilascio-patente"
                      type="date"
                      value={documenti.rilascioPatente || ''}
                      onChange={(e) => aggiornaDocumento('rilascioPatente', e.target.value)}
                      required
                      aria-invalid={Boolean(erroreDi('rilascioPatente'))}
                    />
                    {erroreDi('rilascioPatente') && <p className="pz-errore" role="alert">{erroreDi('rilascioPatente')}</p>}
                  </label>
                ) : (
                  <div className="pz-campo">
                    <span className="pz-etichetta">Patente rilasciata il</span>
                    <strong style={{ fontSize: 14, lineHeight: '40px' }}>{formattaData(rilascioPatente)}</strong>
                  </div>
                )}
                <p className="pz-aiuto pz-intera">
                  Controlla la patente in sede. I dati vanno anche nella scheda del cliente
                  {cliente ? '' : ', che verrà aggiunto ai Clienti'}.
                </p>
              </div>
            ) : (
              <dl className="pz-dati">
                <div className="pz-intera"><dt>Codice fiscale</dt><dd>{prenotazione?.codiceFiscale}</dd></div>
                <div><dt>Numero patente</dt><dd>{patenteNota}</dd></div>
                <div><dt>Scadenza patente</dt><dd>{formattaData(scadenzaPatente)}</dd></div>
                <div><dt>Patente rilasciata il</dt><dd>{formattaData(rilascioPatente)}</dd></div>
              </dl>
            )}
            {neopatentati?.neopatentato && (
              <p className={`pz-avviso pz-avviso--${neopatentati.ok ? 'attenzione' : 'errore'}`} role={neopatentati.ok ? undefined : 'alert'} style={{ marginTop: 12 }}>
                {neopatentati.ok
                  ? `Cliente neopatentato (limiti fino al ${neopatentati.finoAl.split('-').reverse().join('/')}): questa auto risulta nei limiti secondo i dati del veicolo (${neopatentati.idoneita.motivo}). Controlla la data di rilascio sul documento.`
                  : neopatentati.messaggio}
                <br /><small>{AVVISO_CONTROLLO}{eElettricaOIbrida(veicolo?.carburante) ? ` ${AVVISO_ELETTRICHE_IBRIDE}` : ''}</small>
              </p>
            )}
            {velocita.soggetto === true && (
              <p className="pz-avviso pz-avviso--attenzione" role="status" style={{ marginTop: 12 }}>
                <b>Ricorda al cliente i limiti di velocità.</b> {testoVelocita(velocita.finoAl)}
              </p>
            )}
            {esitoPatente.blocca && <p className="pz-avviso pz-avviso--errore" role="alert" style={{ marginTop: 12 }}>{esitoPatente.blocca}</p>}
            {esitoPatente.avviso && <p className="pz-avviso pz-avviso--attenzione" style={{ marginTop: 12 }}>{esitoPatente.avviso}</p>}
            {avvisoEta && (
              <p className={`pz-avviso pz-avviso--${avvisoEta.livello}`} role={avvisoEta.livello === 'errore' ? 'alert' : undefined} style={{ marginTop: 12 }}>
                {avvisoEta.testo}
              </p>
            )}
            {documentoScaduto && (
              <p className="pz-avviso pz-avviso--attenzione" style={{ marginTop: 12 }}>
                Il documento d'identità del cliente è scaduto il {formattaData(cliente.scadenzaDocumento)}: fattene mostrare uno valido e aggiornalo nei Clienti.
              </p>
            )}
          </section>

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Stato del veicolo</h3>
            <div className="pz-griglia pz-griglia--2">
              <div className={`pz-campo ${erroreDi('carburante') ? 'pz-campo--errore' : ''}`}>
                <span className="pz-etichetta" id="consegna-carburante">
                  Carburante <span className="pz-obbligatorio">*</span>
                </span>
                <div className={`pz-scelte ${erroreDi('carburante') ? 'pz-scelte--errore' : ''}`} id="consegna-carburante-scelte" role="radiogroup" aria-labelledby="consegna-carburante">
                  {LIVELLI_CARBURANTE.map((livello) => (
                    <button
                      key={livello}
                      type="button"
                      role="radio"
                      aria-checked={schedaVeicolo.carburante === livello}
                      className={`pz-scelta ${schedaVeicolo.carburante === livello ? 'pz-scelta--attiva' : ''}`}
                      onClick={() => aggiorna('carburante', livello)}
                    >
                      {livello}
                    </button>
                  ))}
                </div>
                {erroreDi('carburante') && <p className="pz-errore" role="alert">{erroreDi('carburante')}</p>}
              </div>
              <label className={`pz-campo ${erroreDi('km') ? 'pz-campo--errore' : ''}`} htmlFor="consegna-km">
                <span className="pz-etichetta">Km alla consegna <span className="pz-obbligatorio">*</span></span>
                <input
                  id="consegna-km"
                  type="number"
                  min="0"
                  value={schedaVeicolo.kmIniziali}
                  onChange={(e) => aggiorna('kmIniziali', e.target.value)}
                  placeholder="Es. 45000"
                  required
                  aria-invalid={Boolean(erroreDi('km'))}
                />
                {erroreDi('km')
                  ? <p className="pz-errore" role="alert">{erroreDi('km')}</p>
                  : <p className="pz-aiuto">Proposti dal veicolo: correggili se il contachilometri dice altro.</p>}
              </label>
            </div>
          </section>

          <ControlloDotazione
            dotazione={schedaVeicolo.dotazione}
            onChange={(dotazione) => aggiorna('dotazione', dotazione)}
            veicolo={veicolo}
            dataRitiro={prenotazione?.dataInizio}
            extra={(Array.isArray(prenotazione?.optional) ? prenotazione.optional : []).filter((r) => r?.quantita > 0)}
          />

          {prenotazione?.id && <FotoDalTelefono prenotazioneId={prenotazione.id} fase="consegna" />}

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Danni già presenti</h3>
            <SchemaDanni
              segni={segniConsegna}
              onChange={cambiaDanni}
              provato={provato}
              aiuto="Tocca sullo schema il punto del danno: compare un numero. Scrivi cos'è. Se l'auto è in ordine non segnare nulla."
              vuoto="Nessun danno segnato: l'auto risulta in ordine."
            />
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
          {errori.length > 0 && <span className="pz-piede-nota pz-piede-nota--errore" role="alert">{riassuntoErrori(errori)}</span>}
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
