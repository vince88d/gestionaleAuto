// Tariffe per categoria: il gestore decide il prezzo al giorno di ogni categoria
// (documento Firestore `impostazioni/tariffe`: { prezziGiorno: { "City Car": 25 } }).
// Il prezzo del singolo veicolo resta solo come ripiego finché manca la tariffa.
//
// La regola di `prezzoCategoria` deve restare identica a quella del server
// (formiarent, functions/src/tariffe.ts) e del sito (src/lib/categorie.ts).

const positivo = (valore) => {
  const numero = Number(valore);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
};

// Tiene solo i prezzi validi (numeri maggiori di zero).
export function normalizzaTariffe(grezze) {
  const risultato = {};
  if (!grezze || typeof grezze !== 'object') return risultato;
  Object.entries(grezze).forEach(([categoria, valore]) => {
    const prezzo = positivo(valore);
    if (prezzo !== null) risultato[categoria] = prezzo;
  });
  return risultato;
}

// Prezzo al giorno di una categoria: la tariffa se c'è, altrimenti il prezzo più
// basso tra le auto della categoria (`veicoliCategoria` con il prezzo originale).
export function prezzoCategoria(categoria, tariffe, veicoliCategoria = []) {
  const tariffa = positivo(tariffe?.[categoria]);
  if (tariffa !== null) return tariffa;
  const prezzi = veicoliCategoria.map((v) => positivo(v.prezzoVeicolo ?? v.prezzo)).filter((p) => p !== null);
  return prezzi.length > 0 ? Math.min(...prezzi) : undefined;
}

// Per il gestionale ogni veicolo mostra e usa il prezzo della sua categoria: se c'è
// una tariffa, `prezzo` diventa la tariffa e il prezzo originale resta in
// `prezzoVeicolo` (per poterlo salvare così com'era).
export function applicaTariffe(veicoli, tariffe) {
  return (veicoli || []).map((veicolo) => {
    const tariffa = positivo(tariffe?.[veicolo.categoria]);
    if (tariffa === null) return veicolo;
    return { ...veicolo, prezzo: tariffa, prezzoVeicolo: 'prezzoVeicolo' in veicolo ? veicolo.prezzoVeicolo : veicolo.prezzo };
  });
}

// Il contrario di `applicaTariffe`, da usare prima di scrivere su Firestore: la
// tariffa non deve finire dentro il documento del veicolo.
export function perSalvataggio(veicolo) {
  if (!veicolo || !('prezzoVeicolo' in veicolo)) return veicolo;
  const { prezzoVeicolo, ...resto } = veicolo;
  if (prezzoVeicolo === undefined) {
    const { prezzo, ...senzaPrezzo } = resto;
    return senzaPrezzo;
  }
  return { ...resto, prezzo: prezzoVeicolo };
}

// Un prezzo di partenza per ogni categoria della flotta, per compilare la prima
// volta la pagina Tariffe: il prezzo più basso già presente tra le sue auto.
export function suggerisciTariffe(veicoli) {
  const suggerite = {};
  (veicoli || []).forEach((veicolo) => {
    if (!veicolo.categoria) return;
    const prezzo = positivo(veicolo.prezzoVeicolo ?? veicolo.prezzo);
    if (prezzo === null) return;
    suggerite[veicolo.categoria] = Math.min(suggerite[veicolo.categoria] ?? Infinity, prezzo);
  });
  return suggerite;
}

// Le categorie i cui prezzi cambiano tra quello che è salvato ora e quello che si
// sta per scrivere: per mostrarle nella conferma prima di salvare (il prezzo è
// live sul sito, quindi il gestore deve vedere cosa sta per cambiare).
// `dopo` undefined vuol dire che la tariffa viene tolta (si torna al prezzo delle auto).
export function differenzeTariffe(prezziGiorno, salvate) {
  const chiavi = new Set([...Object.keys(prezziGiorno), ...Object.keys(salvate)]);
  return [...chiavi]
    .filter((categoria) => prezziGiorno[categoria] !== salvate[categoria])
    .sort((a, b) => a.localeCompare(b, 'it'))
    .map((categoria) => ({ categoria, prima: salvate[categoria], dopo: prezziGiorno[categoria] }));
}

// Da quello che il gestore ha scritto nei campi ai prezzi da salvare. I campi vuoti
// tolgono la tariffa; un valore non valido (zero, negativo, testo) è un errore.
export function tariffeDaCampi(campi) {
  const prezziGiorno = {};
  const errori = [];
  Object.entries(campi).forEach(([categoria, testo]) => {
    const pulito = String(testo ?? '').trim().replace(',', '.');
    if (pulito === '') return;
    const prezzo = positivo(pulito);
    if (prezzo === null) errori.push(categoria);
    else prezziGiorno[categoria] = Math.round(prezzo * 100) / 100;
  });
  return { prezziGiorno, errori };
}
