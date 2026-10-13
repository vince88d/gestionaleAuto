import { useState, useCallback } from 'react';

// Quali schede richiudibili sono aperte. `iniziali` = {id: bool}.
// Con `chiave` la scelta si ricorda da una volta all'altra (solo su questo
// computer, in localStorage); senza, vale finche' la finestra resta aperta e
// riparte dalle `iniziali` (es. i dettagli di una prenotazione: si apre da sola
// la scheda che serve in quel momento).
export function useSchedeAperte(iniziali, chiave = null) {
  const ids = Object.keys(iniziali);
  const [aperte, setAperte] = useState(() => {
    if (!chiave) return iniziali;
    try {
      const salvato = JSON.parse(window.localStorage.getItem(chiave) || '{}');
      return Object.fromEntries(ids.map((id) => [id, typeof salvato?.[id] === 'boolean' ? salvato[id] : iniziali[id]]));
    } catch {
      return iniziali;
    }
  });
  const cambia = useCallback((fn) => setAperte((prima) => {
    const dopo = fn(prima);
    if (chiave) {
      try { window.localStorage.setItem(chiave, JSON.stringify(dopo)); } catch { /* il ricordo e' facoltativo */ }
    }
    return dopo;
  }), [chiave]);
  const tutteAperte = ids.every((id) => aperte[id]);
  return {
    aperta: (id) => Boolean(aperte[id]),
    toggle: (id) => () => cambia((a) => ({ ...a, [id]: !a[id] })),
    tutteAperte,
    apriChiudiTutte: () => cambia(() => Object.fromEntries(ids.map((id) => [id, !tutteAperte]))),
    // Riparte dalle iniziali (la finestra ora mostra un'altra prenotazione).
    reimposta: (nuove) => setAperte(nuove),
  };
}
