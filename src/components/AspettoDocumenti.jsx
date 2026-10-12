import React, { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Palette, Upload, Trash2, CheckCircle, AlertTriangle, Save } from 'lucide-react';
import { contrasto } from '../utils/pdfLayout';
import { coloreValido } from '../utils/azienda';
import { preparaLogo, dimensioniDaDataUrl, MESSAGGI_ERRORE_LOGO } from '../utils/logoAzienda';
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
function AspettoDocumenti({ dati = {}, caricato = true, onSalva }) {
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

  return (
    <section className="imp-sezione asp" aria-labelledby="asp-titolo">
      <header className="imp-sezione-testa">
        <span className="imp-sezione-icona" aria-hidden="true"><Palette size={18} /></span>
        <div>
          <h2 id="asp-titolo">Aspetto dei documenti</h2>
          <p>Logo e colore compaiono nei verbali di consegna e di rientro (PDF). Sono uguali su tutte le postazioni.</p>
        </div>
      </header>

      <div className="asp-griglia">
        <div className="asp-scelte">
          <div className="asp-campo">
            <span className="asp-titolo-campo">Logo</span>
            <span className="asp-aiuto">PNG, JPG, WebP o SVG. Meglio su sfondo trasparente o bianco. Si riduce da solo e non pesa sul PDF.</span>
            <div className="asp-logo-riquadro">
              <div className="asp-logo-anteprima">
                {attuale.logo
                  ? <img src={attuale.logo} alt="Logo dell'azienda" />
                  : <span className="asp-logo-vuoto">nessun logo</span>}
              </div>
              <div className="asp-logo-testi">
                {attuale.logo
                  ? <span className="asp-logo-dettaglio">{dettaglioLogo}</span>
                  : <span className="asp-logo-dettaglio">Nei documenti compare il quadratino con le iniziali «{sigla}».</span>}
                <div className="asp-azioni">
                  <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={sceltoFile} aria-label="Scegli il file del logo" />
                  <button type="button" className="imp-btn" onClick={() => input.current?.click()} disabled={!caricato}>
                    <Upload size={16} aria-hidden="true" /> {attuale.logo ? 'Cambia logo' : 'Carica logo'}
                  </button>
                  {attuale.logo && (
                    <button type="button" className="imp-btn asp-togli" onClick={togliLogo}>
                      <Trash2 size={16} aria-hidden="true" /> Togli
                    </button>
                  )}
                </div>
              </div>
            </div>
            {erroreLogo && <p className="asp-errore" role="alert">{erroreLogo}</p>}
          </div>

          <div className="asp-campo">
            <span className="asp-titolo-campo" id="asp-colore">Colore</span>
            <span className="asp-aiuto">Si usa per titolo, numeri delle sezioni e fascia in alto. Il testo deve restare leggibile: il gestionale controlla il contrasto.</span>
            <div className="asp-tinte" role="radiogroup" aria-labelledby="asp-colore">
              {TINTE.map(([hex, nome]) => (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={colore.toLowerCase() === hex}
                  aria-label={`Colore ${nome}`}
                  className={`asp-tinta ${colore.toLowerCase() === hex ? 'asp-tinta--scelta' : ''}`}
                  style={{ background: hex }}
                  onClick={() => scegliColore(hex)}
                />
              ))}
            </div>
            <div className="asp-hex">
              <span className="asp-campione" style={{ background: colore }} aria-hidden="true" />
              <input
                type="text"
                className="imp-input asp-hex-input"
                value={testoHex}
                maxLength={7}
                aria-label="Colore, codice esadecimale"
                aria-invalid={hexNonValido || undefined}
                onChange={(e) => scriviColore(e.target.value)}
              />
              <button type="button" className="imp-btn" onClick={() => scegliColore(COLORE_BASE)} disabled={!attuale.colore && hexScritto === null}>Colore di base</button>
            </div>
            {hexNonValido ? (
              <p className="asp-errore" role="alert">Scrivi 6 caratteri, es. #1F4E79.</p>
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

          <div className="imp-piede asp-piede">
            {modificato && <button type="button" className="imp-btn" onClick={annulla} disabled={salvando}>Annulla modifiche</button>}
            <button type="button" className="imp-btn imp-btn--primario" onClick={salva} disabled={!modificato || salvando || hexNonValido}>
              <Save size={16} aria-hidden="true" /> {salvando ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>

        <div className="asp-anteprima">
          <span className="asp-etichetta">Anteprima della testata del verbale</span>
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
                <h3>Verbale di consegna</h3>
                <span>N. ABC123 · 12/10/2026</span>
                <span className="asp-doc-copia">COPIA PER IL CLIENTE</span>
              </div>
            </div>
            <div className="asp-doc-fascia">
              <div><small>CLIENTE</small><b>Mario Rossi</b></div>
              <div><small>VEICOLO</small><b>Fiat Panda · AA111AA</b></div>
              <div><small>RIENTRO</small><b>entro 15/10</b></div>
            </div>
            <h4 className="asp-doc-sezione"><i>1</i>Cliente e conducente</h4>
          </div>
          <p className="asp-aiuto">Un logo largo sta in un riquadro alto 34 punti (circa 12 mm); uno quadrato prende lo stesso posto del quadratino.</p>
        </div>
      </div>
    </section>
  );
}

export default AspettoDocumenti;
