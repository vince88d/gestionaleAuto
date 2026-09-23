// ModalDettaglioCliente.jsx
import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import { X, Pencil, Trash2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import StoricoNoleggiTable from './StoricoNoleggiTable';
import { isPrenotazioneVisibile } from '../lib/firestorePrenotazioni';
import { prenotazioniDelCliente } from '../utils/validaCliente';
import { formattaData, coloreScadenza, testoScadenza } from '../utils/scadenze';
import '../styles/Prenotazione.css';

const NOMI_DOCUMENTO = { CI: "Carta d'identità" };

// Data con lo stato della scadenza accanto (scaduta / scade tra N giorni).
function DataScadenza({ data }) {
  if (!data) return '—';
  const colore = coloreScadenza(data);
  return (
    <>
      {formattaData(data)}
      {(colore === 'rosso' || colore === 'giallo') && (
        <span className={`pz-scadenza pz-scadenza--${colore}`}>{testoScadenza(data)}</span>
      )}
    </>
  );
}

const Dato = ({ etichetta, children, intero }) => (
  <div className={intero ? 'pz-intera' : ''}><dt>{etichetta}</dt><dd>{children || '—'}</dd></div>
);

// Scheda del cliente: dati, noleggi e danni causati, con Modifica ed Elimina.
function ModalDettaglioCliente({ show, onClose, cliente, onModifica, onElimina }) {
  const prenotazioni = useSelector((state) => state.prenotazioni || []);
  const [scheda, setScheda] = useState('dati');

  useEffect(() => { if (show) setScheda('dati'); }, [show, cliente?.id]);

  if (!cliente) return null;

  // Dal piu' recente; senza annullate e pagamenti del sito non conclusi.
  const noleggi = prenotazioniDelCliente(cliente.codiceFiscale, prenotazioni)
    .filter(isPrenotazioneVisibile)
    .sort((a, b) => String(b.dataInizio).localeCompare(String(a.dataInizio)));
  const danni = (cliente.storicoDanni || [])
    .slice()
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const nome = `${cliente.nome || ''} ${cliente.cognome || ''}`.trim() || 'Cliente';

  const schede = [
    ['dati', 'Dati'],
    ['noleggi', `Noleggi (${noleggi.length})`],
    ['danni', `Danni (${danni.length})`],
  ];

  return (
    <Modal
      isOpen={show}
      onRequestClose={onClose}
      contentLabel="Scheda cliente"
      className={{ base: 'Modal pz-modal pz-modal--largo', afterOpen: 'Modal--after-open', beforeClose: 'Modal--before-close' }}
      overlayClassName={{ base: 'Overlay', afterOpen: 'Overlay--after-open', beforeClose: 'Overlay--before-close' }}
      ariaHideApp={false}
    >
      <div className="pz">
        <header className="pz-testa pz-testa--schede">
          <div>
            <h2 className="pz-titolo">{nome}</h2>
            <span className="pz-sottotitolo">
              {[cliente.codiceFiscale, cliente.ragioneSociale, cliente.origine === 'sito' ? 'arrivato dal sito' : null].filter(Boolean).join(' · ')}
            </span>
            <nav className="pz-schede" role="tablist" aria-label="Sezioni">
              {schede.map(([chiave, etichetta]) => (
                <button
                  key={chiave}
                  type="button"
                  role="tab"
                  aria-selected={scheda === chiave}
                  className={`pz-scheda ${scheda === chiave ? 'pz-scheda--attiva' : ''}`}
                  onClick={() => setScheda(chiave)}
                >
                  {etichetta}
                </button>
              ))}
            </nav>
          </div>
          <button type="button" className="pz-chiudi" onClick={onClose} aria-label="Chiudi">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pz-corpo">
          {scheda === 'dati' && (
            <>
              <section className="pz-sezione">
                <h3 className="pz-titolo-sezione">Anagrafica e contatti</h3>
                <dl className="pz-dati">
                  <Dato etichetta="Codice fiscale">{cliente.codiceFiscale}</Dato>
                  <Dato etichetta="Nato il">{cliente.dataNascita ? formattaData(cliente.dataNascita) : ''}{cliente.luogoNascita ? ` a ${cliente.luogoNascita}` : ''}</Dato>
                  <Dato etichetta="Indirizzo">{cliente.indirizzo}</Dato>
                  <Dato etichetta="Email">{cliente.email}</Dato>
                  <Dato etichetta="Cellulare">{cliente.cellulare}</Dato>
                  <Dato etichetta="Telefono">{cliente.telefono}</Dato>
                </dl>
              </section>

              <section className="pz-sezione">
                <h3 className="pz-titolo-sezione">Patente e documento</h3>
                <dl className="pz-dati">
                  <Dato etichetta="Patente">{cliente.patente}</Dato>
                  <Dato etichetta="Scadenza patente"><DataScadenza data={cliente.scadenzaPatente} /></Dato>
                  <Dato etichetta="Rilasciata da">
                    {[cliente.rilasciataDaPatente, cliente.rilascioPatente && `il ${formattaData(cliente.rilascioPatente)}`].filter(Boolean).join(' ')}
                  </Dato>
                  <Dato etichetta="Documento">
                    {[NOMI_DOCUMENTO[cliente.tipoDocumento] || cliente.tipoDocumento, cliente.documento].filter(Boolean).join(' n. ')}
                  </Dato>
                  <Dato etichetta="Scadenza documento"><DataScadenza data={cliente.scadenzaDocumento} /></Dato>
                  <Dato etichetta="Rilasciato da">
                    {[cliente.rilasciatoDaDocumento, cliente.rilascioDocumento && `il ${formattaData(cliente.rilascioDocumento)}`].filter(Boolean).join(' ')}
                  </Dato>
                </dl>
              </section>

              {(cliente.ragioneSociale || cliente.piva) && (
                <section className="pz-sezione">
                  <h3 className="pz-titolo-sezione">Azienda</h3>
                  <dl className="pz-dati">
                    <Dato etichetta="Ragione sociale">{cliente.ragioneSociale}</Dato>
                    <Dato etichetta="Partita IVA">{cliente.piva}</Dato>
                    <Dato etichetta="Codice SDI">{cliente.codiceUnivoco}</Dato>
                    <Dato etichetta="PEC" intero>{cliente.pec}</Dato>
                  </dl>
                </section>
              )}
            </>
          )}

          {scheda === 'noleggi' && (
            noleggi.length > 0
              ? <StoricoNoleggiTable noleggi={noleggi} />
              : <p className="pz-vuoto">Nessun noleggio registrato.</p>
          )}

          {scheda === 'danni' && (
            danni.length > 0 ? (
              <div className="pz-lista">
                {danni.map((d, i) => (
                  <div key={`${d.riferimentoPrenotazione || ''}-${i}`} className="pz-voce">
                    <div className="pz-voce-testo">
                      <span className="pz-voce-nome">{d.descrizioneDanno}</span>
                      <span className="pz-voce-dettaglio">
                        {formattaData(String(d.data || '').slice(0, 10))} · {d.veicolo}{d.targa ? ` (${d.targa})` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="pz-vuoto">Nessun danno registrato alle riconsegne.</p>
          )}
        </div>

        <footer className="pz-piede">
          {onElimina && (
            <button type="button" className="vd-btn vd-btn--pericolo" onClick={() => onElimina(cliente)}>
              <Trash2 size={16} aria-hidden="true" /> Elimina
            </button>
          )}
          <span className="pz-piede-nota" />
          <button type="button" className="vd-btn" onClick={onClose}>Chiudi</button>
          {onModifica && (
            <button type="button" className="vd-btn vd-btn--primario" onClick={() => onModifica(cliente)}>
              <Pencil size={16} aria-hidden="true" /> Modifica
            </button>
          )}
        </footer>
      </div>
    </Modal>
  );
}

export default ModalDettaglioCliente;
