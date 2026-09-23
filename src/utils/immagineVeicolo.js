// Foto dei veicoli: controlli e misure, senza toccare il browser (si testano da soli).

export const LATO_MASSIMO = 1600; // pixel del lato più lungo dopo il ridimensionamento
export const DIMENSIONE_MASSIMA_FILE = 25 * 1024 * 1024; // 25 MB: oltre non ha senso una foto di un'auto
const TIPI_AMMESSI = ['image/jpeg', 'image/png', 'image/webp'];

// Messaggio d'errore se il file non va bene, altrimenti null.
export function controllaFile(file) {
  if (!file) return 'Nessun file scelto.';
  if (!TIPI_AMMESSI.includes(file.type)) return 'Scegli una foto JPG, PNG o WebP.';
  if (file.size > DIMENSIONE_MASSIMA_FILE) return 'La foto è troppo grande (massimo 25 MB).';
  return null;
}

// Misure dopo il ridimensionamento: stesse proporzioni, mai più grande dell'originale.
export function dimensioniRidotte(larghezza, altezza, massimo = LATO_MASSIMO) {
  const lato = Math.max(larghezza, altezza);
  if (!(lato > 0)) return { larghezza: 0, altezza: 0 };
  if (lato <= massimo) return { larghezza, altezza };
  const scala = massimo / lato;
  return { larghezza: Math.round(larghezza * scala), altezza: Math.round(altezza * scala) };
}

// Nome del file su Storage: unico, così una foto nuova non sovrascrive quella vecchia
// (e il sito non mostra per errore la versione in cache).
export function nomeFileVeicolo(adesso = Date.now(), casuale = Math.random()) {
  return `${adesso}-${Math.floor(casuale * 1e6).toString(36)}.webp`;
}

// Indirizzo web (Storage) e non un percorso locale del computer.
export function eImmagineOnline(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

// Foto incorporata nel dato (data:image/...;base64), come si salvavano prima le
// foto dei danni dentro il documento Firestore del veicolo.
export function eFotoIncorporata(valore) {
  return typeof valore === 'string' && /^data:image\//i.test(valore);
}
