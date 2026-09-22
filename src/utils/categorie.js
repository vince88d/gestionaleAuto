// Elenco delle categorie gestibili dal gestionale (documento Firestore
// `impostazioni/categorie`: { elenco: ["City Car", "SUV", ...] }).
// Il sito NON legge questo documento: deriva le categorie direttamente dai
// veicoli (src/lib/categorie.ts di formiarent), quindi qui basta che il
// gestionale offra un elenco pulito da scegliere nel form del veicolo.

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

// Pulisce un elenco grezzo: toglie spazi, scarta vuoti e duplicati (senza
// distinguere maiuscole/minuscole, tenendo la prima grafia incontrata),
// ordina alfabeticamente. Usata sia per validare un nuovo elenco prima di
// salvarlo, sia per normalizzare quello letto da Firestore.
export function normalizzaElencoCategorie(grezzo) {
  const visti = new Map();
  (Array.isArray(grezzo) ? grezzo : []).forEach((valore) => {
    const pulito = valore?.toString().trim();
    if (pulito && !visti.has(pulito.toLowerCase())) visti.set(pulito.toLowerCase(), pulito);
  });
  return [...visti.values()].sort((a, b) => collator.compare(a, b));
}

// Una categoria si può eliminare solo se nessun veicolo la usa più: altrimenti
// quei veicoli resterebbero con una categoria non più nell'elenco.
export function puoiEliminareCategoria(categoria, veicoli) {
  return !(veicoli || []).some((v) => v.categoria === categoria);
}

// Quanti veicoli usano ogni categoria, per mostrarlo nella pagina Categorie.
export function contaVeicoliPerCategoria(veicoli) {
  const conteggio = new Map();
  (veicoli || []).forEach((v) => {
    if (!v.categoria) return;
    conteggio.set(v.categoria, (conteggio.get(v.categoria) || 0) + 1);
  });
  return conteggio;
}
