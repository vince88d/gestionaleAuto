// Filtro per categoria della pagina Veicoli. La selezione e' multipla: un
// veicolo resta in elenco se la sua categoria e' tra quelle scelte. Nessuna
// categoria scelta = nessun filtro (si vedono tutti).

// Etichetta (e chiave) del gruppo dei veicoli che non hanno una categoria.
export const SENZA_CATEGORIA = 'Senza categoria';

// Categoria "di filtro" di un veicolo: la sua, oppure SENZA_CATEGORIA.
export function categoriaDiFiltro(veicolo) {
  const categoria = (veicolo?.categoria || '').toString().trim();
  return categoria || SENZA_CATEGORIA;
}

export function filtraPerCategorie(veicoli, categorieScelte) {
  const lista = veicoli || [];
  if (!categorieScelte || categorieScelte.length === 0) return lista;
  const scelte = new Set(categorieScelte);
  return lista.filter((v) => scelte.has(categoriaDiFiltro(v)));
}

// Chip da mostrare: prima le categorie dell'elenco (con anche quelle a zero
// veicoli), poi eventuali categorie usate dai veicoli ma non piu' in elenco,
// infine "Senza categoria" solo se c'e' almeno un veicolo senza categoria.
export function chipCategorie(veicoli, elencoCategorie) {
  const conteggio = new Map();
  (veicoli || []).forEach((v) => {
    const chiave = categoriaDiFiltro(v);
    conteggio.set(chiave, (conteggio.get(chiave) || 0) + 1);
  });
  const chiavi = [...(elencoCategorie || [])];
  [...conteggio.keys()]
    .filter((c) => c !== SENZA_CATEGORIA && !chiavi.includes(c))
    .sort((a, b) => a.localeCompare(b, 'it'))
    .forEach((c) => chiavi.push(c));
  if (conteggio.has(SENZA_CATEGORIA)) chiavi.push(SENZA_CATEGORIA);
  return chiavi.map((nome) => ({ nome, conteggio: conteggio.get(nome) || 0 }));
}

// Aggiunge o toglie una categoria dalla selezione (senza modificarla).
export function alternaCategoria(categorieScelte, nome) {
  return categorieScelte.includes(nome)
    ? categorieScelte.filter((c) => c !== nome)
    : [...categorieScelte, nome];
}
