import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Car, Users, CalendarDays, RotateCcw, Trash2 } from 'lucide-react';
import {
  ascoltaVeicoliEliminati, ripristinaVeicolo, eliminaVeicoloDefinitivo,
} from '../lib/firestoreVeicoli';
import {
  ascoltaClientiEliminati, ripristinaCliente, eliminaClienteDefinitivo,
} from '../lib/firestoreClienti';
import {
  ascoltaPrenotazioniEliminate, ripristinaPrenotazione, eliminaPrenotazioneDefinitivo,
} from '../lib/firestorePrenotazioni';
import ConfirmDialog from '../components/ConfirmDialog';
import { Casella, BarraSelezione } from '../components/SelezioneMultipla';
import { alterna, alternaTutti, soloPresenti, statoSelezione } from '../utils/selezione';
import { formattaData } from '../utils/scadenze';
import './Cestino.css';

// Un elemento eliminato (veicolo/cliente/prenotazione) resta 6 mesi nel
// Cestino prima che la pulizia automatica lo cancelli per sempre (Cloud
// Function pulisciEliminatiScaduti, formiarent/functions). Qui lo staff puo'
// anticipare quella scelta (Elimina definitivamente) o tornare indietro
// (Ripristina) prima che scada.
const MESI_CONSERVAZIONE = 6;

// Firestore restituisce un Timestamp per i campi serverTimestamp(): serve
// .toDate() prima di formattarlo, altrimenti formattaData vede un oggetto e
// non una data (stesso caso gia' gestito per annullataIl in utils/archivio).
function dataEliminazione(valore) {
  if (!valore) return null;
  return typeof valore.toDate === 'function' ? valore.toDate() : valore;
}

function giorniRimasti(eliminatoIl) {
  const data = dataEliminazione(eliminatoIl);
  if (!data) return null;
  const scade = new Date(data);
  scade.setMonth(scade.getMonth() + MESI_CONSERVAZIONE);
  const giorni = Math.ceil((scade - new Date()) / (1000 * 60 * 60 * 24));
  return giorni;
}

// Una sezione del Cestino (Veicoli, Clienti o Prenotazioni): stessa struttura
// per tutte e tre, cambia solo come si presenta ogni elemento.
function Sezione({ tipo, titolo, Icona, elementi, etichetta, onRipristina, onElimina, selezionati, onAlterna, onAlternaTutti }) {
  const chiavi = elementi.map((e) => `${tipo}:${e.id}`);
  if (elementi.length === 0) {
    return (
      <section className="cst-sezione">
        <h2 className="cst-sezione-titolo"><Icona size={18} aria-hidden="true" /> {titolo}</h2>
        <p className="cst-vuoto">Nessun elemento nel Cestino.</p>
      </section>
    );
  }
  return (
    <section className="cst-sezione">
      <h2 className="cst-sezione-titolo">
        <Icona size={18} aria-hidden="true" /> {titolo} <span className="cst-conteggio">({elementi.length})</span>
        <label className="sel-tutto">
          <Casella stato={statoSelezione(selezionati, chiavi)} onChange={() => onAlternaTutti(chiavi)} etichetta={`Seleziona tutto: ${titolo}`} />
          Seleziona tutto
        </label>
      </h2>
      <ul className="cst-elenco">
        {elementi.map((elemento) => {
          const giorni = giorniRimasti(elemento.eliminatoIl);
          const chiave = `${tipo}:${elemento.id}`;
          return (
            <li key={elemento.id} className={`cst-riga ${selezionati.has(chiave) ? 'cst-riga--scelta' : ''}`}>
              <Casella stato={selezionati.has(chiave) ? 'tutti' : 'nessuno'} onChange={() => onAlterna(chiave)} etichetta={`Seleziona ${etichetta(elemento)}`} />
              <div className="cst-info">
                <div className="cst-nome">{etichetta(elemento)}</div>
                <div className="cst-meta">
                  Eliminato da {elemento.eliminatoDa || 'sconosciuto'} il {formattaData(dataEliminazione(elemento.eliminatoIl))}
                  {giorni !== null && (
                    <span className={giorni <= 14 ? 'cst-scadenza cst-scadenza--vicina' : 'cst-scadenza'}>
                      {giorni > 0 ? ` · cancellato per sempre tra ${giorni} giorni` : ' · in attesa di cancellazione automatica'}
                    </span>
                  )}
                </div>
              </div>
              <div className="cst-azioni">
                <button type="button" className="cst-btn" onClick={() => onRipristina(elemento)}>
                  <RotateCcw size={15} aria-hidden="true" /> Ripristina
                </button>
                <button type="button" className="cst-btn cst-btn--pericolo" onClick={() => onElimina(elemento)}>
                  <Trash2 size={15} aria-hidden="true" /> Elimina definitivamente
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Cestino() {
  const [veicoli, setVeicoli] = useState([]);
  const [clienti, setClienti] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [errore, setErrore] = useState('');
  // { tipo: 'veicolo'|'cliente'|'prenotazione', elemento, etichetta } | null
  const [daEliminare, setDaEliminare] = useState(null);
  // Selezione multipla: chiavi 'tipo:id' di tutte le sezioni.
  const [selezionati, setSelezionati] = useState(() => new Set());
  const [inCorso, setInCorso] = useState(false);
  const [eliminaSelezione, setEliminaSelezione] = useState(false);

  useEffect(() => ascoltaVeicoliEliminati(setVeicoli, (err) => {
    console.error('Errore lettura veicoli eliminati:', err);
    setErrore('Impossibile leggere il Cestino. Controlla la connessione e riprova.');
  }), []);

  useEffect(() => ascoltaClientiEliminati(setClienti, (err) => {
    console.error('Errore lettura clienti eliminati:', err);
    setErrore('Impossibile leggere il Cestino. Controlla la connessione e riprova.');
  }), []);

  useEffect(() => ascoltaPrenotazioniEliminate(setPrenotazioni, (err) => {
    console.error('Errore lettura prenotazioni eliminate:', err);
    setErrore('Impossibile leggere il Cestino. Controlla la connessione e riprova.');
  }), []);

  const ripristina = async (tipo, elemento, messaggioOk) => {
    try {
      if (tipo === 'veicolo') await ripristinaVeicolo(elemento.id);
      if (tipo === 'cliente') await ripristinaCliente(elemento.id);
      if (tipo === 'prenotazione') await ripristinaPrenotazione(elemento.id);
      toast.success(messaggioOk);
    } catch (err) {
      console.error('Errore ripristino:', err);
      toast.error('Errore durante il ripristino, riprova.');
    }
  };

  const confermaEliminazione = async () => {
    const richiesta = daEliminare;
    setDaEliminare(null);
    if (!richiesta) return;
    const { tipo, elemento } = richiesta;
    try {
      if (tipo === 'veicolo') await eliminaVeicoloDefinitivo(elemento.id);
      if (tipo === 'cliente') await eliminaClienteDefinitivo(elemento.id);
      if (tipo === 'prenotazione') await eliminaPrenotazioneDefinitivo(elemento.id);
      toast.success('Eliminato per sempre.');
    } catch (err) {
      console.error('Errore eliminazione definitiva:', err);
      toast.error("Errore durante l'eliminazione, riprova.");
    }
  };

  // Si tengono solo gli elementi ancora nel Cestino (dopo un ripristino o un'eliminazione).
  const presenti = [
    ...veicoli.map((e) => `veicolo:${e.id}`),
    ...clienti.map((e) => `cliente:${e.id}`),
    ...prenotazioni.map((e) => `prenotazione:${e.id}`),
  ];
  const scelti = soloPresenti(selezionati, presenti);

  // Applica un'azione a tutti i selezionati, uno per uno: un errore non ferma gli altri.
  const perOgniScelto = async (azione) => {
    setInCorso(true);
    const lavori = [...scelti].map((chiave) => {
      const [tipo, ...resto] = chiave.split(':');
      return azione(tipo, resto.join(':'));
    });
    const esiti = await Promise.allSettled(lavori);
    setInCorso(false);
    const fallite = esiti.filter((e) => e.status === 'rejected');
    fallite.forEach((e) => console.error('Errore azione multipla:', e.reason));
    setSelezionati(new Set());
    return { ok: esiti.length - fallite.length, fallite: fallite.length };
  };
  const esito = (ok, fallite, verbo) => {
    if (ok > 0) toast.success(`${ok} ${ok === 1 ? 'elemento' : 'elementi'} ${verbo}.`);
    if (fallite > 0) toast.error(`${fallite} non ${fallite === 1 ? 'è riuscito' : 'sono riusciti'}: riprova.`);
  };
  const ripristinaScelti = async () => {
    const { ok, fallite } = await perOgniScelto((tipo, id) => {
      if (tipo === 'veicolo') return ripristinaVeicolo(id);
      if (tipo === 'cliente') return ripristinaCliente(id);
      return ripristinaPrenotazione(id);
    });
    esito(ok, fallite, ok === 1 ? 'ripristinato' : 'ripristinati');
  };
  const eliminaScelti = async () => {
    setEliminaSelezione(false);
    const { ok, fallite } = await perOgniScelto((tipo, id) => {
      if (tipo === 'veicolo') return eliminaVeicoloDefinitivo(id);
      if (tipo === 'cliente') return eliminaClienteDefinitivo(id);
      return eliminaPrenotazioneDefinitivo(id);
    });
    esito(ok, fallite, 'eliminati per sempre');
  };
  const proprieta = { selezionati: scelti, onAlterna: (k) => setSelezionati(alterna(scelti, k)), onAlternaTutti: (ks) => setSelezionati(alternaTutti(scelti, ks)) };

  return (
    <div className="cst">
      <div className="cst-toolbar">
        <div>
          <h1 className="cst-titolo">Cestino</h1>
          <p className="cst-sottotitolo">
            Veicoli, clienti e prenotazioni eliminati. Restano qui {MESI_CONSERVAZIONE} mesi, recuperabili in ogni momento; poi vengono cancellati per sempre in automatico.
          </p>
        </div>
      </div>

      {errore && <p className="cst-errore">{errore}</p>}

      <Sezione
        tipo="veicolo"
        {...proprieta}
        titolo="Veicoli"
        Icona={Car}
        elementi={veicoli}
        etichetta={(v) => `${v.modello || v.nome || 'Veicolo'}${v.targa ? ` (${v.targa})` : ''}`}
        onRipristina={(v) => ripristina('veicolo', v, 'Veicolo ripristinato.')}
        onElimina={(v) => setDaEliminare({ tipo: 'veicolo', elemento: v })}
      />

      <Sezione
        tipo="cliente"
        {...proprieta}
        titolo="Clienti"
        Icona={Users}
        elementi={clienti}
        etichetta={(c) => `${c.nome || ''} ${c.cognome || ''}`.trim() || c.codiceFiscale || 'Cliente'}
        onRipristina={(c) => ripristina('cliente', c, 'Cliente ripristinato.')}
        onElimina={(c) => setDaEliminare({ tipo: 'cliente', elemento: c })}
      />

      <Sezione
        tipo="prenotazione"
        {...proprieta}
        titolo="Prenotazioni"
        Icona={CalendarDays}
        elementi={prenotazioni}
        etichetta={(p) => `${p.cliente || 'Cliente'} — ${p.targa || p.categoria || ''}`}
        onRipristina={(p) => ripristina('prenotazione', p, 'Prenotazione ripristinata.')}
        onElimina={(p) => setDaEliminare({ tipo: 'prenotazione', elemento: p })}
      />

      <BarraSelezione conteggio={scelti.size} onDeseleziona={() => setSelezionati(new Set())}>
        <button type="button" className="sel-barra-btn" onClick={ripristinaScelti} disabled={inCorso}>
          <RotateCcw size={15} aria-hidden="true" /> Ripristina ({scelti.size})
        </button>
        <button type="button" className="sel-barra-btn sel-barra-btn--pericolo" onClick={() => setEliminaSelezione(true)} disabled={inCorso}>
          <Trash2 size={15} aria-hidden="true" /> Elimina definitivamente ({scelti.size})
        </button>
      </BarraSelezione>

      <ConfirmDialog
        open={eliminaSelezione}
        onCancel={() => setEliminaSelezione(false)}
        onConfirm={eliminaScelti}
        title={`Eliminare per sempre ${scelti.size} ${scelti.size === 1 ? 'elemento' : 'elementi'}?`}
        message="Questa volta non è recuperabile: i dati vengono cancellati definitivamente, non solo nascosti."
        confirmLabel={`Elimina ${scelti.size} per sempre`}
        tone="danger"
      />

      <ConfirmDialog
        open={daEliminare !== null}
        onCancel={() => setDaEliminare(null)}
        onConfirm={confermaEliminazione}
        title="Eliminare per sempre?"
        message="Questa volta non è recuperabile: il dato viene cancellato definitivamente, non solo nascosto."
        confirmLabel="Elimina per sempre"
        tone="danger"
      />
    </div>
  );
}

export default Cestino;
