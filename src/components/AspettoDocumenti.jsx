import React, { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Palette, Upload, Trash2, CheckCircle, AlertTriangle, Save, Check } from 'lucide-react';
import { contrasto } from '../utils/pdfLayout';
import { coloreValido } from '../utils/azienda';
import { preparaLogo, dimensioniDaDataUrl, MESSAGGI_ERRORE_LOGO } from '../utils/logoAzienda';
import SezioneImpostazioni from './SezioneImpostazioni';
import './AspettoDocumenti.css';

export const COLORE_BASE = '#1f4e79';
export const TINTE = [
  ['#1f4e79', 'Blu'], ['#2c6e49', 'Verde'], ['#8b2e2e', 'Rosso scuro'], ['#6b3fa0', 'Viola'],
  ['#b45309', 'Ambra'], ['#0f6b73', 'Petrolio'], ['#444b54', 'Grigio scuro'], ['#a1274b', 'Bordeaux'],
];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mescolaConBianco = (hex, k) => `#${rgb(hex).map((v) => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0')).join('')}`;
// Come nei verbali: sotto 4,5 : 1 di contrasto sul bianco si usa il colore di base.
export const contrastoSuBianco = (hex) => contrasto(rgb(hex), [255, 255, 255]);
export const iniziali = (nome) => {
  const parole = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (parole.length === 0) return '';
  return parole.length === 1 ? parole[0].slice(0, 2).toUpperCase() : (parole[0][0] + parole[1][0]).toUpperCase();
};

// Sezione «Aspetto dei documenti» delle Impostazioni: logo e colore dei verbali
// PDF, con l'anteprima della testata. Si salvano da soli (non con i dati azienda).
function AspettoDocumenti({ dati = {}, caricato = true, onSalva, aperta = true, onToggle }) {
  const [bozza, setBozza] = useState(null); // null = niente di modificato
  const [hexScritto, setHexScritto] = useState(null); // testo del campo mentre si scrive
  const [erroreLogo, setErroreLogo] = useState('');
  const [infoLogo, setInfoLogo] = useState(null); // { nome, larghezza, altezza, kb } del file appena scelto
  const [salvando, setSalvando] = useState(false);
  const input = useRef(null);

  const salvato = { logo: dati.logo || '', colore: dati.coloreAccento || '' };
  const attuale = bozza ?? salvato;
  const modificato = attuale.logo !== salvato.logo || attuale.colore !== salvato.colore;
  const cambia = (campi) => setBozza({ ...attuale, ...campi });

  const colore = attuale.colore || COLORE_BASE;
  const rapporto = contrastoSuBianco(colore);
  const leggibile = rapporto >= 4.5;
  const usato = leggibile ? colore : COLORE_BASE;
  const testoHex = hexScritto ?? colore.toUpperCase();

  const scegliColore = (hex) => { setHexScritto(null); cambia({ colore: hex === COLORE_BASE ? '' : hex }); };
  const scriviColore = (testo) => {
    setHexScritto(testo);
    const valido = coloreValido(testo);
    if (valido) cambia({ colore: valido === COLORE_BASE ? '' : valido });
  };
  const hexNonValido = hexScritto !== null && hexScritto.trim() !== '' && !coloreValido(hexScritto);

  const sceltoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErroreLogo('');
    try {
      const { logo, larghezza, altezza, kb } = await preparaLogo(file);
      cambia({ logo });
      setInfoLogo({ nome: file.name, larghezza, altezza, kb });
    } catch (err) {
      setErroreLogo(MESSAGGI_ERRORE_LOGO[err.message] || MESSAGGI_ERRORE_LOGO['immagine-non-leggibile']);
    }
  };
  const togliLogo = () => { cambia({ logo: '' }); setInfoLogo(null); setErroreLogo(''); };

  const misureSalvate = attuale.logo && !infoLogo ? dimensioniDaDataUrl(attuale.logo) : null;
  const dettaglioLogo = infoLogo
    ? `${infoLogo.nome} · ${infoLogo.larghezza} × ${infoLogo.altezza} px · ${infoLogo.kb} KB`
    : misureSalvate ? `${misureSalvate.larghezza} × ${misureSalvate.altezza} px · ${Math.max(1, Math.round((attuale.logo.length * 0.75) / 1024))} KB` : '';

  const annulla = () => { setBozza(null); setHexScritto(null); setInfoLogo(null); setErroreLogo(''); };
  const salva = async () => {
    setSalvando(true);
    try {
      await onSalva({ logo: attuale.logo, coloreAccento: attuale.colore });
      toast.success('Aspetto dei documenti salvato.');
      annulla();
    } catch (err) {
      console.error('Errore salvataggio aspetto documenti:', err);
      toast.error('Non riesco a salvare: controlla la connessione e riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const sigla = iniziali(dati.nome) || '?';
  const contatti = [
    [dati.indirizzo, dati.partitaIva && `P.IVA ${dati.partitaIva}`].filter(Boolean).join(' · '),
    [dati.telefono && `Tel. ${dati.telefono}`, dati.email].filter(Boolean).join(' · '),
  ].filter(Boolean);

  const nomeTinta = TINTE.find(([hex]) => hex === colore.toLowerCase())?.[1];

  return (
    <SezioneImpostazioni
      Icona={Palette}
      titolo="Aspetto dei documenti"
      riassunto={`${attuale.logo ? 'Logo caricato' : 'Nessun logo'} · ${nomeTinta ? `colore ${nomeTinta.toLowerCase()}` : 'colore personalizzato'}`}
      descrizione="Logo e colore compaiono nei verbali di consegna e di rientro (PDF). Sono uguali su tutte le postazioni."
      stato={modificato ? { testo: 'Modifiche non salvate', tono: 'attenzione' } : null}
      aperta={aperta}
      onToggle={onToggle}
    >
      {/* 1. Il risultato, sempre in vista mentre si sceglie */}
      <div className="asp-blocco">
        <h3 className="asp-h3">Così apparirà il verbale</h3>
        <div className="asp-cornice">
          <div className="asp-doc" style={{ '--asp-acc': usato, '--asp-acc-chiaro': mescolaConBianco(usato, 0.9) }} data-testid="anteprima-verbale">
            <div className="asp-doc-testa">
              <div className="asp-doc-marchio">
                {attuale.logo
                  ? <img className="asp-doc-logo" src={attuale.logo} alt="" />
                  : <span className="asp-doc-sigla">{sigla}</span>}
                <div className="asp-doc-nome">
                  <b>{dati.nome || 'La tua azienda'}</b>
                  {contatti.map((c) => <span key={c}>{c}</span>)}
                </div>
              </div>
              <div className="asp-doc-titolo">
                <h4>Verbale di consegna</h4>
                <span>N. ABC123 · 12/10/2026</span>
                <span className="asp-doc-copia">COPIA PER IL CLIENTE</span>
              </div>
            </div>
            <div className="asp-doc-fascia">
              <div><small>CLIENTE</small><b>Mario Rossi</b></div>
              <div><small>VEICOLO</small><b>Fiat Panda · AA111AA</b></div>
              <div><small>RIENTRO</small><b>entro 15/10</b></div>
            </div>
            <p className="asp-doc-sezione"><i>1</i>Cliente e conducente</p>
          </div>
        </div>
      </div>

      {/* 2. Logo */}
      <div className="asp-blocco">
        <h3 className="asp-h3">Logo</h3>
        <p className="asp-aiuto">PNG, JPG, WebP o SVG, meglio su sfondo trasparente o bianco. Si riduce da solo e non pesa sul PDF.</p>
        <div className="asp-logo">
          <div className="asp-logo-anteprima">
            {attuale.logo
              ? <img src={attuale.logo} alt="Logo dell'azienda" />
              : <span className="asp-logo-vuoto"><Upload size={20} aria-hidden="true" /><span>nessun logo</span></span>}
          </div>
          <div className="asp-logo-testi">
            <span className="asp-logo-dettaglio">
              {attuale.logo ? dettaglioLogo : `Nei documenti compare il quadratino con le iniziali «${sigla}».`}
            </span>
            <div className="asp-azioni">
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={sceltoFile} aria-label="Scegli il file del logo" />
              <button type="button" className="imp-btn asp-btn" onClick={() => input.current?.click()} disabled={!caricato}>
                <Upload size={16} aria-hidden="true" /> {attuale.logo ? 'Cambia logo' : 'Carica logo'}
              </button>
              {attuale.logo && (
                <button type="button" className="imp-btn asp-btn asp-togli" onClick={togliLogo}>
                  <Trash2 size={16} aria-hidden="true" /> Togli
                </button>
              )}
            </div>
          </div>
        </div>
        {erroreLogo && <p className="asp-errore" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {erroreLogo}</p>}
      </div>

      {/* 3. Colore */}
      <div className="asp-blocco">
        <h3 className="asp-h3" id="asp-colore">Colore</h3>
        <p className="asp-aiuto">Per titolo, numeri delle sezioni e fascia in alto. Il testo deve restare leggibile: il gestionale controlla il contrasto.</p>
        <div className="asp-tinte" role="radiogroup" aria-labelledby="asp-colore">
          {TINTE.map(([hex, nome]) => {
            const scelta = colore.toLowerCase() === hex;
            return (
              <button
                key={hex}
                type="button"
                role="radio"
                aria-checked={scelta}
                aria-label={`Colore ${nome}`}
                title={nome}
                className={`asp-tinta ${scelta ? 'asp-tinta--scelta' : ''}`}
                style={{ background: hex }}
                onClick={() => scegliColore(hex)}
              >
                {scelta && <Check size={20} strokeWidth={3} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="asp-hex">
          <label className="asp-hex-campo">
            <span className="asp-campione" style={{ background: colore }} aria-hidden="true" />
            <span className="asp-hex-testi">
              <span className="asp-hex-etichetta">Codice colore{nomeTinta ? ` · ${nomeTinta}` : ' · personalizzato'}</span>
              <input
                type="text"
                className="imp-input asp-hex-input"
                value={testoHex}
                maxLength={7}
                aria-label="Colore, codice esadecimale"
                aria-invalid={hexNonValido || undefined}
                onChange={(e) => scriviColore(e.target.value)}
              />
            </span>
          </label>
          <button type="button" className="imp-btn asp-btn" onClick={() => scegliColore(COLORE_BASE)} disabled={!attuale.colore && hexScritto === null}>Colore di base</button>
        </div>
        {hexNonValido ? (
          <p className="asp-errore" role="alert"><AlertTriangle size={16} aria-hidden="true" /> Scrivi 6 caratteri, es. #1F4E79.</p>
        ) : leggibile ? (
          <p className="asp-verdetto asp-verdetto--ok" role="status">
            <CheckCircle size={16} aria-hidden="true" />
            <span><b>Si legge bene</b> (contrasto {rapporto.toFixed(1).replace('.', ',')} : 1, il minimo è 4,5).</span>
          </p>
        ) : (
          <p className="asp-verdetto asp-verdetto--no" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            <span><b>Troppo chiaro</b> (contrasto {rapporto.toFixed(1).replace('.', ',')} : 1, serve almeno 4,5). Nei verbali si userà il colore di base: scegline uno più scuro.</span>
          </p>
        )}
      </div>

      <div className="asp-piede">
        <span className="asp-stato" role="status">{modificato ? 'Modifiche non salvate' : ''}</span>
        {modificato && <button type="button" className="imp-btn asp-btn" onClick={annulla} disabled={salvando}>Annulla modifiche</button>}
        <button type="button" className="imp-btn imp-btn--primario asp-btn" onClick={salva} disabled={!modificato || salvando || hexNonValido}>
          <Save size={16} aria-hidden="true" /> {salvando ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>
    </SezioneImpostazioni>
  );
}

export default AspettoDocumenti;
