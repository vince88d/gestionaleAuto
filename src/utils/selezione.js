// Selezione multipla (Cestino, Archivio): funzioni pure, testate.
// Un insieme di chiavi scelte dall'utente; si tengono solo quelle ancora presenti.

// 'nessuno' | 'alcuni' | 'tutti': stato della casella «Seleziona tutto» di un gruppo.
export function statoSelezione(selezionati, chiavi) {
  if (!chiavi.length) return 'nessuno';
  const scelte = chiavi.filter((k) => selezionati.has(k)).length;
  if (scelte === 0) return 'nessuno';
  return scelte === chiavi.length ? 'tutti' : 'alcuni';
}

// Aggiunge o toglie una chiave (restituisce un nuovo insieme).
export function alterna(selezionati, chiave) {
  const nuovo = new Set(selezionati);
  if (nuovo.has(chiave)) nuovo.delete(chiave); else nuovo.add(chiave);
  return nuovo;
}

// «Seleziona tutto» di un gruppo: se sono gia' tutte scelte le toglie, altrimenti le sceglie tutte.
export function alternaTutti(selezionati, chiavi) {
  const nuovo = new Set(selezionati);
  if (statoSelezione(selezionati, chiavi) === 'tutti') chiavi.forEach((k) => nuovo.delete(k));
  else chiavi.forEach((k) => nuovo.add(k));
  return nuovo;
}

// Tiene solo le chiavi che esistono ancora (dopo un filtro, una ricerca o un'eliminazione).
export function soloPresenti(selezionati, chiavi) {
  const presenti = new Set(chiavi);
  return new Set([...selezionati].filter((k) => presenti.has(k)));
}
