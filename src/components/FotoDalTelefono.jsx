import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, X } from 'lucide-react';
import './FotoDalTelefono.css';
import {
  creaSessioneFoto, chiudiSessioneFoto, useFotoVerbale, aggiornaEtichettaFoto, eliminaFoto, messaggioErroreFoto,
} from '../lib/fotoVerbale';
import {
  CONSIGLIATE, ETICHETTE, consigliateMancanti, pocheFoto, testoOrari, nomeFoto,
} from '../utils/fotoVerbale';

const minutiRimasti = (scadeIlMs) => Math.max(0, Math.ceil((scadeIlMs - Date.now()) / 60000));

// «Foto dell'auto» della consegna o del rientro: un pulsante apre un QR; col
// telefono si scelgono le foto dalla galleria e arrivano qui da sole.
// Mockup approvato: formiarent-documenti/mockup/gestionale-foto-telefono.html
function FotoDalTelefono({ prenotazioneId, fase }) {
  const { foto, caricato, errore: erroreLettura } = useFotoVerbale(prenotazioneId, fase);
  const [sessione, setSessione] = useState(null); // { token, url, scadeIlMs, immagine }
  const [apertura, setApertura] = useState(false);
  const [errore, setErrore] = useState('');
  const [, setAdesso] = useState(0);

  // Aggiorna i minuti rimasti e chiude il QR da solo alla scadenza.
  useEffect(() => {
    if (!sessione) return undefined;
    const timer = setInterval(() => {
      if (Date.now() >= sessione.scadeIlMs) setSessione(null);
      else setAdesso((n) => n + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, [sessione]);

  const apri = async () => {
    setApertura(true);
    setErrore('');
    try {
      const nuova = await creaSessioneFoto(prenotazioneId, fase);
      const immagine = await QRCode.toDataURL(nuova.url, { width: 224, margin: 1, errorCorrectionLevel: 'M' });
      setSessione({ ...nuova, immagine });
    } catch (e) {
      console.error('Collegamento foto non aperto:', e);
      setErrore(messaggioErroreFoto(e));
    } finally {
      setApertura(false);
    }
  };

  const chiudi = async () => {
    const { token } = sessione;
    setSessione(null);
    try { await chiudiSessioneFoto(token); } catch (e) { console.warn('Collegamento foto non chiuso:', e); }
  };

  const mancanti = consigliateMancanti(foto);
  const orari = testoOrari(foto);
  const titoloFase = fase === 'rientro' ? 'rientro' : 'consegna';

  return (
    <section className="pz-sezione fv">
      <h3 className="pz-titolo-sezione">Foto dell&apos;auto{foto.length > 0 ? ` · ${foto.length} ${foto.length === 1 ? 'caricata' : 'caricate'}` : ''}</h3>

      {!sessione && (
        <button type="button" className="vd-btn vd-btn--primario" onClick={apri} disabled={apertura || !prenotazioneId}>
          <Smartphone size={16} aria-hidden="true" /> {apertura ? 'Apro il collegamento…' : foto.length > 0 ? 'Aggiungi altre foto dal telefono' : 'Aggiungi foto dal telefono'}
        </button>
      )}
      {errore && <p className="fv-errore" role="alert">{errore}</p>}

      {sessione && (
        <div className="fv-qr" role="region" aria-label="Collegamento per le foto dal telefono">
          <img src={sessione.immagine} width="112" height="112" alt={`Codice QR per caricare le foto della ${titoloFase}`} />
          <div className="fv-qr-testo">
            <p><b>Inquadra il QR col telefono</b> e scegli le foto dalla galleria.</p>
            <p className="pz-aiuto">Vale solo per questa {fase === 'rientro' ? 'riconsegna' : 'consegna'} · scade tra {minutiRimasti(sessione.scadeIlMs)} min</p>
            <p className="fv-attesa">In attesa delle foto…</p>
            <button type="button" className="pz-link" onClick={chiudi}>Chiudi il collegamento</button>
          </div>
        </div>
      )}

      {foto.length > 0 && (
        <div className="fv-griglia">
          {foto.map((f, i) => (
            <figure key={f.id} className="fv-foto">
              <a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={nomeFoto(f, i)} loading="lazy" /></a>
              <select
                aria-label={`Etichetta della foto ${i + 1}`} value={f.etichetta}
                onChange={(e) => aggiornaEtichettaFoto(f.id, e.target.value).catch(() => setErrore('Etichetta non salvata, riprova.'))}
              >
                <option value="">Foto {i + 1}</option>
                {ETICHETTE.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <button
                type="button" className="fv-togli" aria-label={`Togli la foto ${i + 1}`}
                onClick={() => { if (window.confirm('Togliere questa foto?')) eliminaFoto(f).catch(() => setErrore('Foto non tolta, riprova.')); }}
              ><X size={14} aria-hidden="true" /></button>
            </figure>
          ))}
        </div>
      )}

      {foto.length > 0 && (
        <div className="fv-chip">
          {CONSIGLIATE.map(([etichetta, breve]) => {
            const c = !mancanti.some(([m]) => m === etichetta);
            return <span key={etichetta} className={c ? 'fv-chip-ok' : ''}>{c ? '✓ ' : ''}{breve}</span>;
          })}
        </div>
      )}
      {orari && <p className="pz-aiuto">{orari}</p>}

      {foto.length === 0 && (
        <div className="fv-consigli">
          <div className="fv-chip">{CONSIGLIATE.map(([e]) => <span key={e}>{e.replace(' (km e carburante)', ': km e carburante')}</span>)}</div>
          <p className="pz-aiuto">Gira intorno all&apos;auto e fotografa i 4 angoli, poi il quadro acceso e gli interni. Più danni ci sono, più foto di dettaglio servono.</p>
        </div>
      )}
      {caricato && !erroreLettura && pocheFoto(foto) && !sessione && (
        <p className="fv-avviso">
          {foto.length === 0 ? 'Nessuna foto ancora. ' : `Solo ${foto.length} ${foto.length === 1 ? 'foto' : 'foto'}. `}
          Puoi andare avanti lo stesso, ma in caso di contestazione le foto sono la prova più forte.
        </p>
      )}
      {erroreLettura && <p className="fv-errore" role="alert">Non riesco a leggere le foto: controlla la connessione.</p>}
    </section>
  );
}

export default FotoDalTelefono;
