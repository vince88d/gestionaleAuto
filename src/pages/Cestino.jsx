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
function Sezione({ titolo, Icona, elementi, etichetta, onRipristina, onElimina }) {
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
      <h2 className="cst-sezione-titolo"><Icona size={18} aria-hidden="true" /> {titolo} <span className="cst-conteggio">({elementi.length})</span></h2>
      <ul className="cst-elenco">
        {elementi.map((elemento) => {
          const giorni = giorniRimasti(elemento.eliminatoIl);
          return (
            <li key={elemento.id} className="cst-riga">
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
        titolo="Veicoli"
        Icona={Car}
        elementi={veicoli}
        etichetta={(v) => `${v.modello || v.nome || 'Veicolo'}${v.targa ? ` (${v.targa})` : ''}`}
        onRipristina={(v) => ripristina('veicolo', v, 'Veicolo ripristinato.')}
        onElimina={(v) => setDaEliminare({ tipo: 'veicolo', elemento: v })}
      />

      <Sezione
        titolo="Clienti"
        Icona={Users}
        elementi={clienti}
        etichetta={(c) => `${c.nome || ''} ${c.cognome || ''}`.trim() || c.codiceFiscale || 'Cliente'}
        onRipristina={(c) => ripristina('cliente', c, 'Cliente ripristinato.')}
        onElimina={(c) => setDaEliminare({ tipo: 'cliente', elemento: c })}
      />

      <Sezione
        titolo="Prenotazioni"
        Icona={CalendarDays}
        elementi={prenotazioni}
        etichetta={(p) => `${p.cliente || 'Cliente'} — ${p.targa || p.categoria || ''}`}
        onRipristina={(p) => ripristina('prenotazione', p, 'Prenotazione ripristinata.')}
        onElimina={(p) => setDaEliminare({ tipo: 'prenotazione', elemento: p })}
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
