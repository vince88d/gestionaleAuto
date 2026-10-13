import React, { useEffect, useRef, useState } from 'react';
import {
  SAGOME, SCRITTE, SCHEMA_LARGHEZZA, SCHEMA_ALTEZZA, VISTE, TIPI_DANNO, nuovoSegno, vistaDelPunto,
} from '../utils/schemaDanni';
import './SchemaDanni.css';

const RIEMPIMENTI = { bianco: '#fff', vetro: '#dfe6ee', nero: '#1a1f26', cerchione: '#5d6b79' };

// Schema dell'auto con i danni numerati. Si tocca il punto, compare un numero
// e si scrive cos'e'. `vecchi` sono i danni gia' presenti (grigi, non si
// modificano); `segni` quelli che si segnano adesso. `provato` fa comparire
// l'errore sui punti senza descrizione.
export default function SchemaDanni({ segni = [], onChange, vecchi = [], provato = false, vuoto = 'Nessun danno segnato.', aiuto = '' }) {
  const [scelto, setScelto] = useState(null);
  const [daFocalizzare, setDaFocalizzare] = useState(null);
  const svgRef = useRef(null);
  const primo = vecchi.length + 1;

  useEffect(() => {
    if (!daFocalizzare) return;
    document.querySelector(`[data-segno="${daFocalizzare}"] input`)?.focus();
    setDaFocalizzare(null);
  }, [daFocalizzare]);

  const aggiungi = (vista, x, y) => {
    const segno = nuovoSegno(vista, x, y);
    onChange([...segni, segno]);
    setScelto(segno.id);
    setDaFocalizzare(segno.id);
  };

  const tocca = (e) => {
    const svg = svgRef.current;
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = ((e.clientX - r.left) * SCHEMA_LARGHEZZA) / r.width;
    const y = ((e.clientY - r.top) * SCHEMA_ALTEZZA) / r.height;
    const vista = vistaDelPunto(x, y);
    if (vista) aggiungi(vista, x, y);
  };

  // Da tastiera: Invio sulla vista mette il punto al centro.
  const daTastiera = (vista) => (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const { zona } = SAGOME[vista];
    aggiungi(vista, zona.x + zona.w / 2, zona.y + zona.h / 2);
  };

  const cambia = (id, campi) => onChange(segni.map((s) => (s.id === id ? { ...s, ...campi } : s)));
  const togli = (id) => { onChange(segni.filter((s) => s.id !== id)); if (scelto === id) setScelto(null); };

  const pallino = (s, numero, vecchio) => (
    <g
      key={s.id}
      className={`sd-pin ${vecchio ? 'sd-pin--vecchio' : ''} ${s.id === scelto ? 'sd-pin--scelto' : ''}`}
      onClick={(e) => { e.stopPropagation(); if (!vecchio) setScelto(s.id); }}
    >
      <circle cx={s.x} cy={s.y} r="10" />
      <text x={s.x} y={s.y + 3.7}>{numero}</text>
    </g>
  );

  return (
    <div className="sd">
      {aiuto && <p className="pz-aiuto sd-aiuto">{aiuto}</p>}
      <div className="sd-corpo">
        <div className="sd-schema">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SCHEMA_LARGHEZZA} ${SCHEMA_ALTEZZA}`}
            role="group"
            aria-label="Schema dell'auto: vista dall'alto e i due lati. Tocca un punto per segnare un danno."
            onClick={tocca}
            data-testid="sd-svg"
          >
            {Object.entries(SAGOME).map(([vista, { parti, zona }]) => (
              <g key={vista}>
                {parti.map((p, i) => (
                  <path
                    key={i}
                    d={p.d}
                    fill={p.riempi ? RIEMPIMENTI[p.riempi] : 'none'}
                    stroke={p.contorno ? '#1a1f26' : 'none'}
                    strokeWidth={p.contorno || 0}
                    strokeLinejoin="round"
                  />
                ))}
                <rect
                  className="sd-zona"
                  x={zona.x} y={zona.y} width={zona.w} height={zona.h}
                  tabIndex={0}
                  role="button"
                  aria-label={`${VISTE[vista]}: aggiungi un danno`}
                  onKeyDown={daTastiera(vista)}
                />
              </g>
            ))}
            {SCRITTE.map((t, i) => (
              <text
                key={i} className="sd-scritta" x={t.x} y={t.y}
                textAnchor={t.centro ? 'middle' : t.fine ? 'end' : 'start'}
              >{t.testo}</text>
            ))}
            {vecchi.filter((s) => s.vista).map((s, i) => pallino(s, i + 1, true))}
            {segni.filter((s) => s.vista).map((s) => pallino(s, primo + segni.indexOf(s), false))}
          </svg>
        </div>

        <ul className="sd-elenco">
          {vecchi.length === 0 && segni.length === 0 && <li className="sd-vuoto">{vuoto}</li>}
          {vecchi.map((s, i) => (
            <li key={s.id} className="sd-voce sd-voce--vecchio">
              <span className="sd-numero sd-numero--vecchio">{i + 1}</span>
              <div className="sd-campi">
                <span className="sd-testo">{s.testo || s.tipo}</span>
                <span className="sd-dove">{[s.tipo, s.vista ? VISTE[s.vista] : 'scritto a mano'].join(' · ')}</span>
              </div>
              <span className="sd-badge">Già presente</span>
            </li>
          ))}
          {segni.map((s, i) => {
            const manca = provato && !s.testo.trim();
            return (
              <li key={s.id} data-segno={s.id} className={`sd-voce ${s.id === scelto ? 'sd-voce--scelto' : ''}`} onClick={() => setScelto(s.id)}>
                <span className="sd-numero">{primo + i}</span>
                <div className="sd-campi">
                  <div className="sd-riga">
                    <select value={s.tipo} aria-label={`Tipo del danno ${primo + i}`} onChange={(e) => cambia(s.id, { tipo: e.target.value })}>
                      {TIPI_DANNO.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input
                      type="text"
                      value={s.testo}
                      aria-label={`Descrizione del danno ${primo + i}`}
                      aria-invalid={manca || undefined}
                      className={manca ? 'sd-errore' : ''}
                      placeholder="Es. portiera anteriore destra"
                      onChange={(e) => cambia(s.id, { testo: e.target.value })}
                    />
                  </div>
                  <span className={`sd-dove ${manca ? 'sd-dove--errore' : ''}`} role={manca ? 'alert' : undefined}>
                    {s.vista ? VISTE[s.vista] : 'Scritto a mano'}{manca ? ' · scrivi cos’è: serve nel verbale' : ''}
                  </span>
                </div>
                <button type="button" className="sd-togli" onClick={(e) => { e.stopPropagation(); togli(s.id); }} aria-label={`Togli il danno ${primo + i}`}>Togli</button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="pz-aiuto sd-suggerimento">Tocca l'auto per aggiungere un punto; tocca un numero per selezionarlo.</p>
    </div>
  );
}
