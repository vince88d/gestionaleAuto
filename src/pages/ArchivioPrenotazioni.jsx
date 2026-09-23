import React, { useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Info, Trash2, RotateCcw, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { aggiornaPrenotazione, eliminaPrenotazione, messaggioErrorePrenotazione } from '../lib/firestorePrenotazioni';
import { togliDanniPrenotazioneCliente } from '../lib/firestoreClienti';
import { updatePrenotazione, deletePrenotazione } from '../store/prenotazioniSlice';
import InfoModal from '../components/InfoModal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  eAnnullamento, dataAnnullamento, puoEliminareDaArchivio, CAMPI_RIPRISTINO, conflittoRipristino,
  cercaArchivio, ordinaPerRecenti, importiArchivio,
} from '../utils/archivio';
import { formattaData } from '../utils/scadenze';
import '../pages/Booking.css';
import '../styles/ArchivioPrenotazioni.css';

const RIGHE_PER_PAGINA = 15;
const euro = (n) => `€ ${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const periodo = (p) => `${formattaData(p.dataInizio)} → ${formattaData(p.dataFine)}`;

function ArchivioPrenotazioni() {
  const dispatch = useDispatch();
  // Le prenotazioni arrivano in tempo reale da App.js.
  const prenotazioni = useSelector((state) => state.prenotazioni);
  const clienti = useSelector((state) => state.clienti);
  const [scheda, setScheda] = useState('concluse');
  const [cerca, setCerca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [dettaglio, setDettaglio] = useState(null);
  const [daRipristinare, setDaRipristinare] = useState(null);
  const [daEliminare, setDaEliminare] = useState(null);

  const concluse = useMemo(() => prenotazioni.filter((p) => p.status === 'completata'), [prenotazioni]);
  const annullate = useMemo(() => prenotazioni.filter(eAnnullamento), [prenotazioni]);
  const elenco = ordinaPerRecenti(cercaArchivio(scheda === 'concluse' ? concluse : annullate, cerca));
  const numeroPagine = Math.ceil(elenco.length / RIGHE_PER_PAGINA);
  const paginaValida = Math.min(pagina, Math.max(numeroPagine, 1));
  const daMostrare = elenco.slice((paginaValida - 1) * RIGHE_PER_PAGINA, paginaValida * RIGHE_PER_PAGINA);

  const cambiaScheda = (nuova) => { setScheda(nuova); setPagina(1); };

  // Ripristino: prima si controlla che il veicolo sia ancora libero in quelle
  // date, poi si chiede conferma.
  const chiediRipristino = (p) => {
    const conflitto = conflittoRipristino(p, prenotazioni);
    if (conflitto) {
      toast.error(
        `Non si può ripristinare: ${p.targa} è già prenotato da ${conflitto.cliente || 'un altro cliente'} `
        + `(${periodo(conflitto)}). Sposta prima quella prenotazione o cambia veicolo.`
      );
      return;
    }
    setDaRipristinare(p);
  };

  // Rimette attivo un noleggio concluso: toglie i dati della riconsegna dalla
  // prenotazione e le voci di danno dal suo cliente. Solo quei documenti.
  const ripristina = async () => {
    const p = daRipristinare;
    setDaRipristinare(null);
    if (!p) return;
    try {
      await aggiornaPrenotazione(p.id, CAMPI_RIPRISTINO, { statoAtteso: 'completata' });
      dispatch(updatePrenotazione({ ...p, ...CAMPI_RIPRISTINO }));
      const cf = (p.codiceFiscale || '').trim().toUpperCase();
      const cliente = cf && clienti.find((c) => (c.codiceFiscale || '').toUpperCase() === cf);
      if (cliente) {
        await togliDanniPrenotazioneCliente(cliente.id, p.id).catch((error) => {
          console.error('Storico danni del cliente non aggiornato:', error);
        });
      }
      toast.success(`Noleggio di ${p.cliente || 'cliente'} di nuovo attivo: lo trovi in Prenotazioni.`);
    } catch (error) {
      console.error('Errore ripristino prenotazione:', error);
      toast.error(messaggioErrorePrenotazione(error, 'Errore durante il ripristino.'));
    }
  };

  const elimina = async () => {
    const p = daEliminare;
    setDaEliminare(null);
    if (!p || !puoEliminareDaArchivio(p)) return;
    try {
      await eliminaPrenotazione(p.id);
      dispatch(deletePrenotazione(p.id));
      toast.success('Noleggio eliminato.');
    } catch (error) {
      console.error('Errore eliminazione prenotazione:', error);
      toast.error("Errore nell'eliminazione.");
    }
  };

  return (
    <div className="bookings-container">
      <div className="bk-toolbar">
        <div>
          <h1 className="bk-titolo">Archivio</h1>
          <span className="bk-conteggio">
            {concluse.length} {concluse.length === 1 ? 'noleggio concluso' : 'noleggi conclusi'} · {annullate.length} {annullate.length === 1 ? 'annullato' : 'annullati'}
          </span>
        </div>
        <div className="bk-azioni">
          <label className="bk-cerca">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Cerca cliente, targa, veicolo…"
              aria-label="Cerca nell'archivio"
              value={cerca}
              onChange={(e) => { setCerca(e.target.value); setPagina(1); }}
            />
          </label>
        </div>
      </div>

      <div className="bk-barra">
        <div className="bookings-filtri" role="tablist" aria-label="Archivio">
          {[['concluse', 'Conclusi', concluse.length], ['annullate', 'Annullati', annullate.length]].map(([chiave, etichetta, n]) => (
            <button
              key={chiave}
              type="button"
              role="tab"
              aria-selected={scheda === chiave}
              className={`bookings-filtro ${scheda === chiave ? 'bookings-filtro--attivo' : ''}`}
              onClick={() => cambiaScheda(chiave)}
            >
              {etichetta} <span className="bookings-filtro-conto">{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bk-elenco">
        <table className="bk-tabella">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Veicolo</th>
              <th>Periodo</th>
              <th className="bk-destra">Importo</th>
              <th>{scheda === 'concluse' ? 'Rientro' : 'Annullato'}</th>
              <th aria-label="Azioni" />
            </tr>
          </thead>
          <tbody>
            {daMostrare.length === 0 ? (
              <tr>
                <td colSpan={6} className="bk-vuoto">
                  {cerca.trim()
                    ? `Nessun risultato per “${cerca.trim()}”.`
                    : scheda === 'concluse' ? 'Nessun noleggio concluso.' : 'Nessuna prenotazione annullata.'}
                </td>
              </tr>
            ) : daMostrare.map((p) => {
              const { totale, rimborsato, trattenuto } = importiArchivio(p);
              return (
                <tr key={p.id} className="bk-riga" onClick={() => setDettaglio(p)}>
                  <td>
                    <span className="bk-principale">{p.cliente || '—'}</span>
                    {p.emailCliente && <span className="bk-secondario">{p.emailCliente}</span>}
                  </td>
                  <td>
                    <span className="bk-principale">{p.veicolo || p.categoria || '—'}</span>
                    {p.targa && <span className="bk-targa">{p.targa}</span>}
                  </td>
                  <td><span className="bk-principale">{periodo(p)}</span></td>
                  <td className="bk-destra">
                    <span className="bk-principale">{totale ? euro(totale) : '—'}</span>
                    {scheda === 'annullate' && (
                      <span className="bk-secondario arc-importi">
                        {rimborsato > 0 ? `rimborsati ${euro(rimborsato)}` : 'nessun rimborso'}
                        {trattenuto > 0 && ` · penale ${euro(trattenuto)}`}
                      </span>
                    )}
                  </td>
                  <td>
                    {scheda === 'concluse' ? (
                      <>
                        <span className="bk-principale">{p.dataRientroEffettiva ? formattaData(p.dataRientroEffettiva.slice(0, 10)) : '—'}</span>
                        {p.descrizioneDanno && (
                          <span className="bk-secondario arc-danno">{p.daRiparare ? 'Danno da riparare' : 'Danno segnalato'}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="bk-principale">{dataAnnullamento(p) ? formattaData(dataAnnullamento(p).slice(0, 10)) : '—'}</span>
                        <span className="bk-secondario">{p.annullataDa === 'cliente' ? 'dal cliente' : 'dallo staff'}</span>
                      </>
                    )}
                  </td>
                  <td className="bk-azioni-riga" onClick={(e) => e.stopPropagation()}>
                    {scheda === 'concluse' && (
                      <button type="button" className="bk-btn bk-btn--piccolo" onClick={() => chiediRipristino(p)} title="Rimetti tra le prenotazioni attive">
                        <RotateCcw size={15} aria-hidden="true" /> <span className="bk-btn-testo">Ripristina</span>
                      </button>
                    )}
                    {scheda === 'concluse' && puoEliminareDaArchivio(p) && (
                      <button type="button" className="bk-btn bk-btn--piccolo bk-btn--icona arc-elimina" onClick={() => setDaEliminare(p)} title="Elimina" aria-label="Elimina">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                    <button type="button" className="bk-btn bk-btn--piccolo bk-btn--icona" onClick={() => setDettaglio(p)} title="Dettagli" aria-label="Dettagli">
                      <Info size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {numeroPagine > 1 && (
          <div className="bk-pagine">
            {[...Array(numeroPagine)].map((_, i) => (
              <button
                key={i}
                type="button"
                className={paginaValida === i + 1 ? 'bk-pagina--attiva' : ''}
                onClick={() => setPagina(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <InfoModal
        isOpen={dettaglio !== null}
        onClose={() => setDettaglio(null)}
        prenotazione={dettaglio}
        soloLettura
      />

      <ConfirmDialog
        open={daRipristinare !== null}
        onCancel={() => setDaRipristinare(null)}
        onConfirm={ripristina}
        title="Ripristinare il noleggio?"
        message={daRipristinare
          ? `Il noleggio di ${daRipristinare.cliente || 'cliente'} (${daRipristinare.targa}, ${periodo(daRipristinare)}) torna tra le prenotazioni attive. Si cancellano la data di rientro e i danni registrati alla riconsegna${daRipristinare.descrizioneDanno ? ` («${daRipristinare.descrizioneDanno}»)` : ''}: dopo andrà concluso di nuovo.`
          : ''}
        confirmLabel="Ripristina"
      />

      <ConfirmDialog
        open={daEliminare !== null}
        onCancel={() => setDaEliminare(null)}
        onConfirm={elimina}
        title="Eliminare il noleggio?"
        message={daEliminare
          ? `Elimino per sempre il noleggio di ${daEliminare.cliente || 'cliente'} (${daEliminare.targa || '—'}, ${periodo(daEliminare)}, ${euro(importiArchivio(daEliminare).totale)}). Sparisce anche dagli incassi della Dashboard e dallo storico del cliente.`
          : ''}
        confirmLabel="Elimina"
        tone="danger"
      />
    </div>
  );
}

export default ArchivioPrenotazioni;
