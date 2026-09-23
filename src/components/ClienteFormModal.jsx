import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import { X } from 'lucide-react';
import { preparaCliente, clientePerForm, validaCliente } from '../utils/validaCliente';
import '../styles/Prenotazione.css';

const TIPI_DOCUMENTO = [
  ['CI', "Carta d'identità"],
  ['Patente', 'Patente'],
  ['Passaporto', 'Passaporto'],
  ['Permesso di soggiorno', 'Permesso di soggiorno'],
  ['Tessera sanitaria', 'Tessera sanitaria'],
  ['Altro', 'Altro'],
];

export const CLIENTE_VUOTO = {
  nome: '', cognome: '', codiceFiscale: '', dataNascita: '', luogoNascita: '', indirizzo: '',
  email: '', telefono: '', cellulare: '',
  tipoDocumento: '', tipoDocumentoAltro: '', documento: '', rilasciatoDaDocumento: '', rilascioDocumento: '', scadenzaDocumento: '',
  patente: '', rilasciataDaPatente: '', rilascioPatente: '', scadenzaPatente: '',
  ragioneSociale: '', piva: '', pec: '', codiceUnivoco: '',
};

const haDatiAzienda = (c) => Boolean(c.ragioneSociale || c.piva || c.pec || c.codiceUnivoco);

// Un solo form per il cliente: nuovo e modifica nella pagina Clienti, e
// "Nuovo cliente" dentro la prenotazione. Controlla i campi (errori sotto
// ciascuno) e passa a `onSalva` i dati gia' puliti; il salvataggio lo fa chi
// lo apre. `sopra`: da usare sopra un'altra finestra (form di prenotazione).
function ClienteFormModal({ isOpen, cliente = null, clienti = [], onClose, onSalva, sopra = false }) {
  const modifica = Boolean(cliente?.id);
  const [dati, setDati] = useState(CLIENTE_VUOTO);
  const [errori, setErrori] = useState({});
  const [azienda, setAzienda] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const iniziali = { ...CLIENTE_VUOTO, ...(cliente ? clientePerForm(cliente) : {}) };
    setDati(iniziali);
    setErrori({});
    setAzienda(haDatiAzienda(iniziali));
  }, [isOpen, cliente]);

  const cambia = (e) => {
    const { name, value } = e.target;
    setDati((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'tipoDocumento' && value !== 'Altro' ? { tipoDocumentoAltro: '' } : {}),
    }));
    if (errori[name]) setErrori((prev) => ({ ...prev, [name]: undefined }));
  };

  const invia = async (e) => {
    e.preventDefault();
    // Dentro il form di prenotazione il submit risalirebbe fino a quello.
    e.stopPropagation();
    if (salvando) return;
    const pronto = preparaCliente(azienda ? dati : { ...dati, ragioneSociale: '', piva: '', pec: '', codiceUnivoco: '' });
    const trovati = validaCliente(pronto, clienti, cliente?.id || null);
    setErrori(trovati);
    if (Object.keys(trovati).length > 0) return;
    setSalvando(true);
    try {
      await onSalva(pronto);
    } finally {
      setSalvando(false);
    }
  };

  const campo = (nome, etichetta, { tipo = 'text', obbligatorio = false, intero = false, ...altri } = {}) => (
    <label className={`pz-campo ${errori[nome] ? 'pz-campo--errore' : ''} ${intero ? 'pz-intera' : ''}`}>
      <span className="pz-etichetta">
        {etichetta}{obbligatorio && <span className="pz-obbligatorio"> *</span>}
      </span>
      <input type={tipo} name={nome} value={dati[nome] || ''} onChange={cambia} aria-invalid={Boolean(errori[nome])} {...altri} />
      {errori[nome] && <p className="pz-errore" role="alert">{errori[nome]}</p>}
    </label>
  );

  const numeroErrori = Object.values(errori).filter(Boolean).length;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => !salvando && onClose()}
      contentLabel={modifica ? 'Modifica cliente' : 'Nuovo cliente'}
      className={{ base: `Modal pz-modal ${sopra ? 'pz-sopra' : ''}`, afterOpen: 'Modal--after-open', beforeClose: 'Modal--before-close' }}
      overlayClassName={{ base: `Overlay ${sopra ? 'pz-sopra' : ''}`, afterOpen: 'Overlay--after-open', beforeClose: 'Overlay--before-close' }}
      ariaHideApp={false}
    >
      <form className="pz pz-form" onSubmit={invia} noValidate>
        <header className="pz-testa">
          <div>
            <h2 className="pz-titolo">{modifica ? 'Modifica cliente' : 'Nuovo cliente'}</h2>
            <span className="pz-sottotitolo">
              {modifica ? `${cliente.nome || ''} ${cliente.cognome || ''}`.trim() : 'I campi con * sono obbligatori.'}
            </span>
          </div>
          <button type="button" className="pz-chiudi" onClick={onClose} aria-label="Chiudi" disabled={salvando}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pz-corpo">
          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Anagrafica</h3>
            <div className="pz-griglia pz-griglia--2">
              {campo('nome', 'Nome', { obbligatorio: true, autoFocus: !modifica })}
              {campo('cognome', 'Cognome', { obbligatorio: true })}
              {campo('codiceFiscale', 'Codice fiscale', {
                obbligatorio: true, placeholder: 'Es. RSSMRA80A01H501U', style: { textTransform: 'uppercase' }, maxLength: 16,
              })}
              {campo('dataNascita', 'Data di nascita', { tipo: 'date' })}
              {campo('luogoNascita', 'Luogo di nascita')}
              {campo('indirizzo', 'Indirizzo', { placeholder: 'Via, numero, città' })}
            </div>
          </section>

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Contatti</h3>
            <div className="pz-griglia pz-griglia--3">
              {campo('email', 'Email', { tipo: 'email', placeholder: 'nome@esempio.it' })}
              {campo('cellulare', 'Cellulare', { tipo: 'tel' })}
              {campo('telefono', 'Telefono', { tipo: 'tel' })}
            </div>
          </section>

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Patente di guida</h3>
            <div className="pz-griglia pz-griglia--2">
              {campo('patente', 'Numero patente', { obbligatorio: true, style: { textTransform: 'uppercase' } })}
              {campo('scadenzaPatente', 'Scadenza', { tipo: 'date' })}
              {campo('rilasciataDaPatente', 'Rilasciata da', { placeholder: 'Es. MIT-UCO' })}
              {campo('rilascioPatente', 'Data di rilascio', { tipo: 'date' })}
            </div>
          </section>

          <section className="pz-sezione">
            <h3 className="pz-titolo-sezione">Documento d'identità</h3>
            <div className="pz-griglia pz-griglia--2">
              <label className="pz-campo">
                <span className="pz-etichetta">Tipo</span>
                <select name="tipoDocumento" value={dati.tipoDocumento || ''} onChange={cambia}>
                  <option value="">Scegli…</option>
                  {TIPI_DOCUMENTO.map(([valore, nome]) => <option key={valore} value={valore}>{nome}</option>)}
                </select>
              </label>
              {dati.tipoDocumento === 'Altro'
                ? campo('tipoDocumentoAltro', 'Quale documento', { placeholder: 'Es. Carta professionale' })
                : campo('documento', 'Numero')}
              {dati.tipoDocumento === 'Altro' && campo('documento', 'Numero')}
              {campo('scadenzaDocumento', 'Scadenza', { tipo: 'date' })}
              {campo('rilasciatoDaDocumento', 'Rilasciato da', { placeholder: 'Es. Comune di Roma' })}
              {campo('rilascioDocumento', 'Data di rilascio', { tipo: 'date' })}
            </div>
          </section>

          <section className="pz-sezione">
            <label className="pz-opzione">
              <input type="checkbox" checked={azienda} onChange={(e) => setAzienda(e.target.checked)} />
              <span>
                Noleggio intestato a un'azienda
                <span className="pz-aiuto" style={{ display: 'block' }}>Ragione sociale, Partita IVA e dati per la fattura elettronica.</span>
              </span>
            </label>
            {azienda && (
              <div className="pz-griglia pz-griglia--2" style={{ marginTop: 12 }}>
                {campo('ragioneSociale', 'Ragione sociale', { intero: true })}
                {campo('piva', 'Partita IVA')}
                {campo('codiceUnivoco', 'Codice SDI', { maxLength: 7, style: { textTransform: 'uppercase' } })}
                {campo('pec', 'PEC', { tipo: 'email', intero: true })}
              </div>
            )}
          </section>
        </div>

        <footer className="pz-piede">
          {numeroErrori > 0 && <span className="pz-piede-nota pz-piede-nota--errore">Controlla i campi segnati in rosso.</span>}
          <button type="button" className="vd-btn" onClick={onClose} disabled={salvando}>Annulla</button>
          <button type="submit" className="vd-btn vd-btn--primario" disabled={salvando}>
            {salvando ? 'Salvataggio…' : modifica ? 'Salva modifiche' : 'Aggiungi cliente'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export default ClienteFormModal;
