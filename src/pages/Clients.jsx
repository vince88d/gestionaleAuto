// src/pages/Clients.jsx
import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { Pencil, Trash2, Info, Plus, Search, Building2 } from 'lucide-react';
import './Clients.css';
import ClienteFormModal from '../components/ClienteFormModal';
import ModalDettaglioCliente from '../components/ModalDettaglioCliente';
import ConfirmDialog from '../components/ConfirmDialog';
import { addCliente, updateCliente, deleteCliente } from '../store/clientiSlice';
import { creaCliente, aggiornaCliente, eliminaCliente, messaggioErroreCliente } from '../lib/firestoreClienti';
import { isPrenotazioneVisibile } from '../lib/firestorePrenotazioni';
import { prenotazioniDelCliente, cercaClienti } from '../utils/validaCliente';
import { coloreScadenza, testoScadenza, formattaData } from '../utils/scadenze';

const RIGHE_PER_PAGINA = 15;

// Patente o documento scaduti o in scadenza (30 giorni): una riga colorata
// sotto il numero. Niente se in regola o senza data.
export function AvvisoScadenza({ etichetta, data }) {
  const colore = coloreScadenza(data);
  if (colore !== 'rosso' && colore !== 'giallo') return null;
  return (
    <span className={`cli-scadenza cli-scadenza--${colore}`} title={`${etichetta}: ${formattaData(data)}`}>
      {etichetta}: {testoScadenza(data).toLowerCase()}
    </span>
  );
}

function Clients() {
  const clienti = useSelector((state) => state.clienti);
  const prenotazioni = useSelector((state) => state.prenotazioni);
  const dispatch = useDispatch();

  const [cerca, setCerca] = useState('');
  const [pagina, setPagina] = useState(1);
  // Form cliente: null = chiuso, { cliente: null } = nuovo, { cliente } = modifica.
  const [form, setForm] = useState(null);
  const [dettaglioId, setDettaglioId] = useState(null);
  const [daEliminare, setDaEliminare] = useState(null);
  // Modifica con codice fiscale cambiato: si chiede conferma prima di
  // aggiornare anche le prenotazioni del cliente.
  const [cambioCodiceFiscale, setCambioCodiceFiscale] = useState(null);

  // Noleggi per cliente (per codice fiscale), senza annullate e pagamenti del
  // sito non conclusi.
  const noleggiPerCliente = useMemo(() => {
    const mappa = new Map();
    prenotazioni.filter(isPrenotazioneVisibile).forEach((p) => {
      const cf = (p.codiceFiscale || '').trim().toUpperCase();
      if (!cf) return;
      const elenco = mappa.get(cf) || [];
      elenco.push(p);
      mappa.set(cf, elenco);
    });
    return mappa;
  }, [prenotazioni]);
  const noleggiDi = (cliente) => noleggiPerCliente.get((cliente.codiceFiscale || '').toUpperCase()) || [];

  // Ricerca mentre si scrive, su piu' parole: nome, contatti, codice fiscale,
  // patente, azienda e targhe noleggiate. In ordine alfabetico per cognome.
  const filtrati = useMemo(
    () => cercaClienti(clienti, cerca, prenotazioni)
      .slice()
      .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it')),
    [clienti, cerca, prenotazioni]
  );
  const numeroPagine = Math.ceil(filtrati.length / RIGHE_PER_PAGINA);
  const paginaValida = Math.min(pagina, Math.max(numeroPagine, 1));
  const daMostrare = filtrati.slice((paginaValida - 1) * RIGHE_PER_PAGINA, paginaValida * RIGHE_PER_PAGINA);
  const dettaglio = clienti.find((c) => c.id === dettaglioId) || null;

  const salvaModifica = async (aggiornato, originale, prenotazioniDaAggiornare = []) => {
    try {
      const campi = await aggiornaCliente(originale.id, aggiornato, {
        prenotazioniDaAggiornare: prenotazioniDaAggiornare.map((p) => p.id),
      });
      dispatch(updateCliente({ id: originale.id, ...campi }));
      toast.success(
        prenotazioniDaAggiornare.length > 0
          ? `Cliente salvato; aggiornate anche ${prenotazioniDaAggiornare.length} prenotazioni.`
          : 'Cliente salvato.'
      );
      setForm(null);
    } catch (err) {
      console.error('Errore modifica cliente:', err);
      toast.error(messaggioErroreCliente(err, 'Modifiche non salvate, riprova.'));
    }
  };

  // Dal form (dati gia' controllati): nuovo cliente o modifica di tutti i campi.
  const salva = async (pronto) => {
    const originale = form?.cliente?.id ? clienti.find((c) => c.id === form.cliente.id) : null;
    if (form?.cliente?.id && !originale) {
      toast.error('Il cliente non esiste più: forse è stato eliminato da un\'altra postazione.');
      return;
    }
    if (!originale) {
      try {
        const salvato = await creaCliente(pronto);
        dispatch(addCliente(salvato));
        toast.success(`Cliente ${salvato.nome} ${salvato.cognome} aggiunto.`);
        setForm(null);
      } catch (err) {
        console.error('Errore salvataggio cliente:', err);
        toast.error(messaggioErroreCliente(err, 'Errore durante il salvataggio del cliente'));
      }
      return;
    }
    const collegate = pronto.codiceFiscale !== (originale.codiceFiscale || '').toUpperCase()
      ? prenotazioniDelCliente(originale.codiceFiscale, prenotazioni)
      : [];
    if (collegate.length > 0) {
      setCambioCodiceFiscale({ aggiornato: pronto, originale, collegate });
      return;
    }
    await salvaModifica(pronto, originale);
  };

  const elimina = async () => {
    const cliente = daEliminare;
    setDaEliminare(null);
    if (!cliente?.id) return;
    try {
      await eliminaCliente(cliente.id);
      dispatch(deleteCliente(cliente.id));
      if (dettaglioId === cliente.id) setDettaglioId(null);
      toast.success('Cliente eliminato.');
    } catch (err) {
      console.error('Errore eliminazione cliente:', err);
      toast.error("Errore durante l'eliminazione");
    }
  };

  const apriModifica = (cliente) => {
    setDettaglioId(null);
    setForm({ cliente });
  };

  return (
    <div className="cli">
      <div className="cli-toolbar">
        <div>
          <h1 className="cli-titolo">Clienti</h1>
          <span className="cli-conteggio">
            {cerca.trim()
              ? `${filtrati.length} su ${clienti.length} clienti`
              : `${clienti.length} ${clienti.length === 1 ? 'cliente' : 'clienti'}`}
          </span>
        </div>
        <div className="cli-azioni">
          <label className="cli-cerca">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Cerca nome, codice fiscale, telefono, targa…"
              aria-label="Cerca clienti"
              value={cerca}
              onChange={(e) => { setCerca(e.target.value); setPagina(1); }}
            />
          </label>
          <button type="button" className="cli-btn cli-btn--primario" onClick={() => setForm({ cliente: null })}>
            <Plus size={16} aria-hidden="true" /> Nuovo cliente
          </button>
        </div>
      </div>

      <div className="cli-elenco">
        <table className="cli-tabella">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contatti</th>
              <th>Codice fiscale</th>
              <th>Patente</th>
              <th>Noleggi</th>
              <th aria-label="Azioni" />
            </tr>
          </thead>
          <tbody>
            {daMostrare.length === 0 ? (
              <tr>
                <td colSpan={6} className="cli-vuoto">
                  {cerca.trim()
                    ? `Nessun cliente trovato per “${cerca.trim()}”.`
                    : 'Nessun cliente. Aggiungine uno con «Nuovo cliente»: i clienti del sito entrano da soli alla consegna.'}
                </td>
              </tr>
            ) : daMostrare.map((cliente) => {
              const noleggi = noleggiDi(cliente);
              const ultimo = noleggi.map((p) => p.dataInizio).filter(Boolean).sort().pop();
              return (
                <tr key={cliente.id} className="cli-riga" onClick={() => setDettaglioId(cliente.id)}>
                  <td>
                    <span className="cli-principale">{`${cliente.nome || ''} ${cliente.cognome || ''}`.trim() || '—'}</span>
                    {cliente.ragioneSociale && (
                      <span className="cli-secondario"><Building2 size={12} aria-hidden="true" /> {cliente.ragioneSociale}</span>
                    )}
                    {cliente.origine === 'sito' && <span className="cli-etichetta">dal sito</span>}
                  </td>
                  <td>
                    <span className="cli-principale cli-normale">{cliente.email || '—'}</span>
                    {(cliente.cellulare || cliente.telefono) && (
                      <span className="cli-secondario">{cliente.cellulare || cliente.telefono}</span>
                    )}
                  </td>
                  <td><span className="cli-cf">{cliente.codiceFiscale || '—'}</span></td>
                  <td>
                    <span className="cli-principale cli-normale">{cliente.patente || '—'}</span>
                    <AvvisoScadenza etichetta="Patente" data={cliente.scadenzaPatente} />
                    <AvvisoScadenza etichetta="Documento" data={cliente.scadenzaDocumento} />
                  </td>
                  <td>
                    <span className="cli-principale">{noleggi.length}</span>
                    {ultimo && <span className="cli-secondario">ultimo {formattaData(ultimo)}</span>}
                  </td>
                  <td className="cli-azioni-riga" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="cli-icona" onClick={() => setDettaglioId(cliente.id)} title="Scheda cliente" aria-label="Scheda cliente">
                      <Info size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="cli-icona" onClick={() => apriModifica(cliente)} title="Modifica" aria-label="Modifica">
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="cli-icona cli-icona--pericolo" onClick={() => setDaEliminare(cliente)} title="Elimina" aria-label="Elimina">
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {numeroPagine > 1 && (
          <div className="cli-pagine">
            {[...Array(numeroPagine)].map((_, i) => (
              <button
                key={i}
                type="button"
                className={paginaValida === i + 1 ? 'cli-pagina--attiva' : ''}
                onClick={() => setPagina(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <ClienteFormModal
        isOpen={form !== null}
        cliente={form?.cliente || null}
        clienti={clienti}
        onClose={() => setForm(null)}
        onSalva={salva}
      />

      <ModalDettaglioCliente
        show={dettaglio !== null}
        onClose={() => setDettaglioId(null)}
        cliente={dettaglio}
        onModifica={apriModifica}
        onElimina={(c) => setDaEliminare(c)}
      />

      <ConfirmDialog
        open={daEliminare !== null}
        onCancel={() => setDaEliminare(null)}
        onConfirm={elimina}
        title="Eliminare il cliente?"
        message={daEliminare ? (() => {
          const n = prenotazioniDelCliente(daEliminare.codiceFiscale, prenotazioni).length;
          return `Eliminare "${daEliminare.nome} ${daEliminare.cognome}" dai Clienti? ${n > 0 ? `Le sue ${n} prenotazioni restano, ma non saranno più collegate a una scheda cliente.` : 'Non ha prenotazioni.'}`;
        })() : ''}
        confirmLabel="Elimina"
        tone="danger"
      />

      <ConfirmDialog
        open={cambioCodiceFiscale !== null}
        onCancel={() => setCambioCodiceFiscale(null)}
        onConfirm={() => {
          const { aggiornato, originale, collegate } = cambioCodiceFiscale;
          setCambioCodiceFiscale(null);
          salvaModifica(aggiornato, originale, collegate);
        }}
        title="Cambiare il codice fiscale?"
        message={cambioCodiceFiscale
          ? `${cambioCodiceFiscale.collegate.length === 1 ? 'C\'è 1 prenotazione' : `Ci sono ${cambioCodiceFiscale.collegate.length} prenotazioni`} con il vecchio codice fiscale (${cambioCodiceFiscale.originale.codiceFiscale}). Le aggiorno con quello nuovo (${cambioCodiceFiscale.aggiornato.codiceFiscale}), così lo storico noleggi resta del cliente.`
          : ''}
        confirmLabel="Aggiorna tutto"
      />
    </div>
  );
}

export default Clients;
