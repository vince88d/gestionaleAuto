import React, { useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Info, Trash2, RotateCcw, Search, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { aggiornaPrenotazione, eliminaPrenotazione, messaggioErrorePrenotazione } from '../lib/firestorePrenotazioni';
import { togliDanniPrenotazioneCliente } from '../lib/firestoreClienti';
import { updatePrenotazione, deletePrenotazione } from '../store/prenotazioniSlice';
import InfoModal from '../components/InfoModal';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  eAnnullamento, dataAnnullamento, puoEliminareDaArchivio, CAMPI_RIPRISTINO, conflittoRipristino,
  cercaArchivio, ordinaPerRecenti, importiArchivio, anniDisponibili, filtraPeriodo, riepilogoConclusi,
  riepilogoAnnullati, righeCsv, testoCsv,
} from '../utils/archivio';
import { formattaData } from '../utils/scadenze';
import '../pages/Booking.css';
import '../styles/ArchivioPrenotazioni.css';

const RIGHE_PER_PAGINA = 15;
const euro = (n) => `€ ${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const SPIEGAZIONE = {
  concluse: 'Noleggi finiti, con il veicolo riconsegnato: sia quelli prenotati sul sito sia quelli fatti in ufficio. Nel periodo contano per il giorno di fine noleggio.',
  annullate: 'Prenotazioni annullate prima del noleggio: dal cliente con il link dell\'email o da voi con «Annulla e rimborsa». Sono quelle pagate sul sito (in ufficio si eliminano). Nel periodo contano per il giorno dell\'annullamento.',
};

// Scarica il CSV (con BOM, cosi' Excel apre bene le lettere accentate).
function scaricaCsv(nomeFile, testo) {
  const blob = new Blob(['\uFEFF', testo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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
  // Periodo: anno '' = tutto, mese '' = tutto l'anno. Parte dall'anno in corso.
  const [anno, setAnno] = useState(() => String(new Date().getFullYear()));
  const [mese, setMese] = useState('');
  const [daRipristinare, setDaRipristinare] = useState(null);
  const [daEliminare, setDaEliminare] = useState(null);

  const concluse = useMemo(() => prenotazioni.filter((p) => p.status === 'completata'), [prenotazioni]);
  const annullate = useMemo(() => prenotazioni.filter(eAnnullamento), [prenotazioni]);
  const anni = useMemo(() => {
    const presenti = anniDisponibili([...concluse, ...annullate]);
    const corrente = String(new Date().getFullYear());
    return presenti.includes(corrente) ? presenti : [corrente, ...presenti];
  }, [concluse, annullate]);
  const periodoScelto = { anno, mese: anno ? mese : '' };
  const conclusePeriodo = filtraPeriodo(concluse, periodoScelto);
  const annullatePeriodo = filtraPeriodo(annullate, periodoScelto);
  const elenco = ordinaPerRecenti(cercaArchivio(scheda === 'concluse' ? conclusePeriodo : annullatePeriodo, cerca));
  const totConclusi = riepilogoConclusi(elenco);
  const totAnnullati = riepilogoAnnullati(elenco);
  const nomePeriodo = !anno ? 'tutto l\'archivio' : mese ? `${MESI[Number(mese) - 1]} ${anno}` : `tutto il ${anno}`;

  const esporta = () => {
    const tipo = scheda === 'concluse' ? 'conclusi' : 'annullati';
    const parte = !anno ? 'tutto' : mese ? `${anno}-${mese}` : anno;
    scaricaCsv(`archivio-${tipo}-${parte}.csv`, testoCsv(righeCsv(elenco, tipo)));
  };
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
            {concluse.length} {concluse.length === 1 ? 'noleggio concluso' : 'noleggi conclusi'} · {annullate.length} {annullate.length === 1 ? 'prenotazione annullata' : 'prenotazioni annullate'}
          </span>
        </div>
        <div className="bk-azioni">
          <div className="arc-periodo" role="group" aria-label="Periodo">
            <select value={anno} onChange={(e) => { setAnno(e.target.value); setPagina(1); }} aria-label="Anno">
              <option value="">Tutti gli anni</option>
              {anni.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={mese} onChange={(e) => { setMese(e.target.value); setPagina(1); }} aria-label="Mese" disabled={!anno}>
              <option value="">Tutto l'anno</option>
              {MESI.map((nome, i) => (
                <option key={nome} value={String(i + 1).padStart(2, '0')}>{nome.charAt(0).toUpperCase() + nome.slice(1)}</option>
              ))}
            </select>
          </div>
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
          <button type="button" className="bk-btn" onClick={esporta} disabled={elenco.length === 0} title="Scarica l'elenco mostrato, per Excel o il commercialista">
            <Download size={16} aria-hidden="true" /> Esporta CSV
          </button>
        </div>
      </div>

      <div className="bk-barra">
        <div className="bookings-filtri" role="tablist" aria-label="Archivio">
          {[['concluse', 'Noleggi conclusi', conclusePeriodo.length], ['annullate', 'Prenotazioni annullate', annullatePeriodo.length]].map(([chiave, etichetta, n]) => (
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
      <p className="arc-spiegazione">{SPIEGAZIONE[scheda]}</p>

      <div className="arc-totali" aria-live="polite">
        <span className="arc-totali-periodo">{nomePeriodo.charAt(0).toUpperCase() + nomePeriodo.slice(1)}{cerca.trim() ? ' · con la ricerca' : ''}</span>
        {scheda === 'concluse' ? (
          <>
            <span><strong>{totConclusi.numero}</strong> {totConclusi.numero === 1 ? 'noleggio' : 'noleggi'}</span>
            <span>Incassato <strong>{euro(totConclusi.incassato)}</strong></span>
          </>
        ) : (
          <>
            <span><strong>{totAnnullati.numero}</strong> {totAnnullati.numero === 1 ? 'annullata' : 'annullate'}</span>
            <span>Pagato <strong>{euro(totAnnullati.pagato)}</strong></span>
            <span>Rimborsato <strong>{euro(totAnnullati.rimborsato)}</strong></span>
            <span>Penali trattenute <strong>{euro(totAnnullati.trattenuto)}</strong></span>
          </>
        )}
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
                    : scheda === 'concluse' ? `Nessun noleggio concluso in ${nomePeriodo}.` : `Nessuna prenotazione annullata in ${nomePeriodo}.`}
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
                        <span className="bk-secondario">{p.annullataDa === 'cliente' ? 'dal cliente, con il link' : 'da voi, con rimborso'}</span>
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
