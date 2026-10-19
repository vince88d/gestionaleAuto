import React, { useState } from 'react';
import Modal from 'react-modal';
import { X } from 'lucide-react';
import { dataEOra, formattaData } from '../utils/scadenze';
import { controlloAbbinamento, AVVISO_CONTROLLO } from '../utils/neopatentati';
import '../styles/Prenotazione.css';

const descrizione = (v) => [
  v.carburante,
  v.cambio,
  Number(v.km) > 0 ? `${Number(v.km).toLocaleString('it-IT')} km` : '',
].filter(Boolean).join(' · ');

// Finestra per scegliere quale auto dare a una prenotazione del sito, che ha
// pagato solo la categoria. `consegnaSubito`: il ritiro e' oggi o gia'
// passato, quindi il pulsante principale sceglie e apre subito la consegna.
// `cambio`: l'auto c'e' gia' ma non va bene (es. neopatentato): si sceglie
// un'altra auto della stessa categoria e, se non ce n'e' di adatte, si manda a
// `onModifica` (cambiare categoria cambia il prezzo).
export default function SceltaAutoModal({ prenotazione, veicoliLiberi, consegnaSubito, onClose, onConferma, cambio = false, categoria: categoriaCambio, onModifica }) {
  // Neopatentato (data di rilascio dal sito o dal cliente): le auto non adatte
  // restano in elenco, grigie e con il motivo, ma non si scelgono.
  const controllo = (v) => controlloAbbinamento({ veicolo: v, rilascio: prenotazione?.rilascioPatente, ritiro: prenotazione?.dataInizio });
  const adatte = veicoliLiberi.filter((v) => controllo(v).ok);
  // Come in Nuova prenotazione: le auto non adatte restano nascoste (con il
  // numero e un pulsante per vederle, grigie e col motivo). Se non ce n'e'
  // nessuna di adatta nella scelta normale, si mostrano tutte per spiegare.
  const [mostraTutte, setMostraTutte] = useState(false);
  const [targa, setTarga] = useState(adatte.length === 1 ? adatte[0].targa : '');
  const [salvataggio, setSalvataggio] = useState(false);

  if (!prenotazione) return null;

  const conferma = async (consegna) => {
    const veicolo = adatte.find((v) => v.targa === targa);
    if (!veicolo) return;
    setSalvataggio(true);
    try {
      await onConferma({ veicolo, consegna });
    } finally {
      setSalvataggio(false);
    }
  };

  const categoria = (cambio ? categoriaCambio : prenotazione.categoria) || 'categoria non indicata';
  const nascoste = veicoliLiberi.length - adatte.length;
  const mostrale = mostraTutte || (adatte.length === 0 && !cambio);
  const visibili = mostrale ? veicoliLiberi : adatte;

  return (
    <Modal
      isOpen
      onRequestClose={onClose}
      contentLabel="Scegli l'auto"
      className={{ base: 'Modal pz-modal sa-modal', afterOpen: 'Modal--after-open', beforeClose: 'Modal--before-close' }}
      overlayClassName={{ base: 'Overlay', afterOpen: 'Overlay--after-open', beforeClose: 'Overlay--before-close' }}
      ariaHideApp={false}
    >
      <div className="pz">
        <header className="pz-testa">
          <div>
            <h2 className="pz-titolo">{cambio ? "Scegli un'altra auto per" : "Scegli l'auto per"} {prenotazione.cliente || 'il cliente'}</h2>
            <span className="pz-sottotitolo">
              {cambio ? 'Categoria' : 'Categoria pagata:'} {categoria}
              {' · '}{dataEOra(prenotazione.dataInizio, prenotazione.oraInizio)} → {dataEOra(prenotazione.dataFine, prenotazione.oraFine)}
            </span>
          </div>
          <button type="button" className="pz-chiudi" onClick={onClose} aria-label="Chiudi">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pz-corpo">
          {veicoliLiberi.length === 0 ? (
            <div className="sa-vuoto" role="alert">
              <strong>{cambio ? "Nessun'altra auto" : 'Nessuna auto'} «{categoria}» è libera dal {formattaData(prenotazione.dataInizio)} al {formattaData(prenotazione.dataFine)}.</strong>
              <br />
              {cambio
                ? "Puoi cambiare categoria (o date) modificando la prenotazione: il prezzo verrà ricalcolato e lo vedrai prima di salvare."
                : "Libera un'auto spostando un altro noleggio, oppure riattiva un'auto sospesa nella pagina Veicoli. Se non si può, annulla e rimborsa il cliente dalla finestra dei dettagli."}
              {cambio && onModifica && (
                <div style={{ marginTop: 12 }}>
                  <button type="button" className="vd-btn vd-btn--primario" onClick={onModifica}>Modifica la prenotazione</button>
                </div>
              )}
            </div>
          ) : (
            <section className="pz-sezione">
              {controllo(veicoliLiberi[0]).neopatentato && (
                <div className="sa-neopat" role="status">
                  <b>Cliente neopatentato</b> (patente del {formattaData(prenotazione.rilascioPatente)}): per legge guida solo auto fino a 75 kW per tonnellata (e 105 kW per le autovetture). Le auto oltre i limiti non si possono scegliere. <small>{AVVISO_CONTROLLO}</small>
                </div>
              )}
              <h3 className="pz-titolo-sezione">
                Auto «{categoria}» libere in queste date ({visibili.length})
              </h3>
              <div className="sa-lista" role="radiogroup" aria-label="Auto libere">
                {visibili.map((v) => {
                  const c = controllo(v);
                  return (
                  <label key={v.targa} className={`sa-voce ${targa === v.targa ? 'sa-voce--scelta' : ''} ${c.ok ? '' : 'sa-voce--no'}`}>
                    <input
                      type="radio" name="sa-auto" value={v.targa} disabled={!c.ok}
                      checked={targa === v.targa} onChange={() => setTarga(v.targa)}
                    />
                    <span className="sa-testi">
                      <span className="sa-nome">{[v.marca, v.modello].filter(Boolean).join(' ') || v.targa}</span>
                      {descrizione(v) && <span className="sa-det">{descrizione(v)}</span>}
                      {!c.ok && <span className="sa-motivo">{c.messaggio}</span>}
                    </span>
                    <span className="sa-targa">{v.targa}</span>
                  </label>
                  );
                })}
              </div>
              {nascoste > 0 && !mostrale && (
                <button type="button" className="vd-link" style={{ marginTop: 10 }} onClick={() => setMostraTutte(true)}>
                  {nascoste === 1 ? '1 auto non adatta nascosta' : `${nascoste} auto non adatte nascoste`} · mostra
                </button>
              )}
              {cambio && adatte.length === 0 && (
                <div className="sa-vuoto" role="status" style={{ marginTop: 12 }}>
                  <strong>Nessuna auto «{categoria}» adatta a questo cliente è libera in queste date.</strong>
                  <br />
                  Puoi cambiare categoria (o date) modificando la prenotazione: il prezzo verrà ricalcolato e lo vedrai prima di salvare.
                  {onModifica && (
                    <div style={{ marginTop: 12 }}>
                      <button type="button" className="vd-btn vd-btn--primario" onClick={onModifica}>Modifica la prenotazione</button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="pz-piede">
          <button type="button" className="vd-btn" onClick={onClose}>Annulla</button>
          <span className="pz-piede-nota" />
          {veicoliLiberi.length > 0 && (consegnaSubito ? (
            <>
              <button type="button" className="vd-btn" disabled={!targa || salvataggio} onClick={() => conferma(false)}>
                Solo scegli
              </button>
              <button type="button" className="vd-btn vd-btn--primario" disabled={!targa || salvataggio} onClick={() => conferma(true)}>
                {salvataggio ? 'Salvataggio…' : 'Scegli e consegna ora'}
              </button>
            </>
          ) : (
            <button type="button" className="vd-btn vd-btn--primario" disabled={!targa || salvataggio} onClick={() => conferma(false)}>
              {salvataggio ? 'Salvataggio…' : 'Scegli questa auto'}
            </button>
          ))}
        </footer>
      </div>
    </Modal>
  );
}
