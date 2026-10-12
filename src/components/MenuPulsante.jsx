import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Pulsante che apre un menu verso l'alto (sta nella barra in fondo alle
// finestre). `sezioni`: [{ titolo, nota, voci: [{ etichetta, icona, nota, disattiva, onClick }] }].
// Si chiude con Esc, cliccando fuori o scegliendo una voce; frecce su/giu' per
// spostarsi. Mockup approvato: formiarent-documenti/mockup/gestionale-dettagli-pulsanti.html
function MenuPulsante({ etichetta, icona, primario = false, sezioni = [] }) {
  const [aperto, setAperto] = useState(false);
  const radice = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!aperto) return undefined;
    const fuori = (e) => { if (radice.current && !radice.current.contains(e.target)) setAperto(false); };
    document.addEventListener('mousedown', fuori);
    return () => document.removeEventListener('mousedown', fuori);
  }, [aperto]);

  const voci = () => Array.from(radice.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || []);

  const tasto = (e) => {
    if (e.key === 'Escape' && aperto) {
      e.stopPropagation();
      setAperto(false);
      radice.current?.querySelector('button[aria-haspopup]')?.focus();
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && aperto) {
      e.preventDefault();
      const elenco = voci();
      const i = elenco.indexOf(document.activeElement);
      const prossimo = e.key === 'ArrowDown' ? elenco[(i + 1) % elenco.length] : elenco[(i - 1 + elenco.length) % elenco.length];
      prossimo?.focus();
    }
  };

  const apriOChiudi = () => {
    setAperto((a) => !a);
    // Con la tastiera il focus passa alla prima voce.
    setTimeout(() => voci()[0]?.focus(), 0);
  };

  return (
    <div className="pz-menu" ref={radice} onKeyDown={tasto}>
      <button
        type="button" className={`vd-btn ${primario ? 'vd-btn--primario' : ''} ${aperto ? 'pz-menu-btn--aperto' : ''}`}
        aria-haspopup="menu" aria-expanded={aperto} aria-controls={id} onClick={apriOChiudi}
      >
        {icona} {etichetta} <ChevronDown size={14} aria-hidden="true" className={`pz-menu-freccia ${aperto ? 'pz-menu-freccia--su' : ''}`} />
      </button>
      {aperto && (
        <div className="pz-menu-lista" id={id} role="menu" aria-label={etichetta}>
          {sezioni.map((s, i) => (
            <div key={s.titolo || i} className="pz-menu-sezione" role="group" aria-label={s.titolo}>
              {i > 0 && <hr className="pz-menu-linea" />}
              {s.titolo && <p className="pz-menu-titolo">{s.titolo}</p>}
              {s.voci.map((v) => (
                <button
                  key={v.etichetta} type="button" role="menuitem" className="pz-menu-voce" disabled={v.disattiva}
                  onClick={() => { setAperto(false); v.onClick?.(); }}
                >
                  {v.icona}
                  <span>{v.etichetta}{v.nota && <small>{v.nota}</small>}</span>
                </button>
              ))}
              {s.nota && <p className="pz-menu-nota">{s.nota}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MenuPulsante;
