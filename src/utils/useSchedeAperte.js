import { useState, useCallback } from 'react';

// Quali schede richiudibili sono aperte. `iniziali` = {id: bool}: com'e' di
// partenza (puo' dipendere dai dati). Quello che l'utente apre o chiude a mano
// ha la precedenza. Con `chiave` le scelte si ricordano da una volta all'altra
// (solo su questo computer, in localStorage); senza, valgono finche' la
// finestra resta aperta (`reimposta` le toglie: es. i dettagli di un'altra prenotazione).
export function useSchedeAperte(iniziali, chiave = null) {
  const ids = Object.keys(iniziali);
  const [scelte, setScelte] = useState(() => {
    if (!chiave) return {};
    try {
      const salvato = JSON.parse(window.localStorage.getItem(chiave) || '{}');
      return Object.fromEntries(ids.filter((id) => typeof salvato?.[id] === 'boolean').map((id) => [id, salvato[id]]));
    } catch {
      return {};
    }
  });
  const aperta = (id) => (typeof scelte[id] === 'boolean' ? scelte[id] : Boolean(iniziali[id]));
  const cambia = useCallback((nuove) => {
    setScelte(nuove);
    if (chiave) {
      try { window.localStorage.setItem(chiave, JSON.stringify(nuove)); } catch { /* il ricordo e' facoltativo */ }
    }
  }, [chiave]);
  const tutteAperte = ids.every(aperta);
  return {
    aperta,
    toggle: (id) => () => cambia({ ...scelte, [id]: !aperta(id) }),
    tutteAperte,
    apriChiudiTutte: () => cambia(Object.fromEntries(ids.map((id) => [id, !tutteAperte]))),
    reimposta: () => setScelte({}),
  };
}
