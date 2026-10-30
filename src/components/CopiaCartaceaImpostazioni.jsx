import React, { useEffect, useState } from 'react';
import { FileText, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import SezioneImpostazioni from './SezioneImpostazioni';
import { ascoltaCopiaCartacea, salvaCopiaCartacea } from '../lib/firestoreCopiaCartacea';
import { TESTO_PRESA_VISIONE, COPIA_CARTACEA_SPENTA } from '../utils/copiaCartacea';
import { formattaData } from '../utils/scadenze';

// Scheda delle Impostazioni: attiva la spunta «copia cartacea» della consegna.
// Per attivarla bisogna leggere il testo e confermare la presa visione.
function CopiaCartaceaImpostazioni({ aperta, onToggle }) {
  const [dati, setDati] = useState(COPIA_CARTACEA_SPENTA);
  const [letto, setLetto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => ascoltaCopiaCartacea(setDati, (e) => console.error('Errore lettura copia cartacea:', e)), []);

  const cambia = async (attiva) => {
    setSalvando(true);
    try {
      await salvaCopiaCartacea(attiva);
      setLetto(false);
    } catch (e) {
      console.error('Copia cartacea non salvata:', e);
      toast.error('Impostazione non salvata, riprova.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <SezioneImpostazioni
      Icona={FileText}
      titolo="Copia cartacea dei documenti"
      riassunto={dati.attiva ? 'Attiva: alla consegna si può spuntare la copia cartacea' : 'Spenta'}
      descrizione="Per chi tiene una copia cartacea dei documenti del cliente invece di compilare tutti i campi alla consegna."
      stato={{
        testo: dati.attiva ? 'Attiva' : 'Spenta',
        tono: dati.attiva ? 'ok' : 'neutro',
        icona: dati.attiva ? <CheckCircle size={14} aria-hidden="true" /> : null,
      }}
      aperta={aperta}
      onToggle={onToggle}
    >
      <p className="imp-aiuto">{TESTO_PRESA_VISIONE}</p>
      {dati.attiva ? (
        <>
          <p className="imp-aiuto">
            Attivata da {dati.presaVisioneDa || 'staff'} il {formattaData(dati.presaVisioneIl.slice(0, 10))}.
          </p>
          <div className="imp-piede imp-piede--sinistra">
            <button type="button" className="imp-btn" onClick={() => cambia(false)} disabled={salvando}>Spegni</button>
          </div>
        </>
      ) : (
        <>
          <label className="imp-riga" style={{ alignItems: 'flex-start', gap: 8 }}>
            <input type="checkbox" checked={letto} onChange={(e) => setLetto(e.target.checked)} />
            <span>Ho letto e capito il testo qui sopra.</span>
          </label>
          <div className="imp-piede imp-piede--sinistra">
            <button type="button" className="imp-btn imp-btn--primario" onClick={() => cambia(true)} disabled={!letto || salvando}>
              Attiva
            </button>
          </div>
        </>
      )}
    </SezioneImpostazioni>
  );
}

export default CopiaCartaceaImpostazioni;
