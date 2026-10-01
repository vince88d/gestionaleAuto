// Optional a pagamento (seggiolino, catene...): funzioni pure, testate.
// Il catalogo lo gestisce lo staff nella pagina "Tariffe e optional"; il sito
// legge solo quelli con `sulSito`.
//
// Il calcolo del prezzo (prezzoOptional) deve restare identico a quello del
// sito (formiarent, functions/src): se cambi uno, cambia anche l'altro.

export const MODI_PREZZO = {
  giorno: 'al giorno',
  noleggio: 'a noleggio',
};

export const OPTIONAL_VUOTO = {
  nome: '',
  descrizione: '',
  modo: 'giorno',
  prezzo: '',
  massimo: '',
  maxPerNoleggio: '1',
  pezzi: '',
  sulSito: true,
};

const numero = (valore) => {
  if (valore === '' || valore === null || valore === undefined) return null;
  const n = Number(String(valore).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
const arrotonda = (n) => Math.round(n * 100) / 100;

// Da un documento Firestore (o dal form) a un optional con i tipi giusti.
// `massimo` e `pezzi` null = nessun tetto / pezzi senza limite.
export function normalizzaOptional(dati = {}) {
  const modo = dati.modo === 'noleggio' ? 'noleggio' : 'giorno';
  const massimo = numero(dati.massimo);
  const pezzi = numero(dati.pezzi);
  return {
    ...(dati.id ? { id: dati.id } : {}),
    nome: String(dati.nome || '').trim(),
    descrizione: String(dati.descrizione || '').trim(),
    modo,
    prezzo: numero(dati.prezzo) ?? 0,
    // Il tetto ha senso solo per il prezzo al giorno.
    massimo: modo === 'giorno' && massimo > 0 ? massimo : null,
    maxPerNoleggio: Math.max(1, Math.floor(numero(dati.maxPerNoleggio) || 1)),
    pezzi: pezzi === null || Number.isNaN(pezzi) ? null : Math.max(0, Math.floor(pezzi)),
    sulSito: dati.sulSito !== false,
  };
}

// Errori per campo ({} se si puo' salvare). `altri`: gli optional gia' in
// catalogo (per il nome doppio); in modifica si esclude se stesso con `id`.
export function validaOptional(dati, altri = [], id = null) {
  const errori = {};
  const nome = String(dati.nome || '').trim();
  if (!nome) errori.nome = 'Scrivi il nome.';
  else if (altri.some((o) => o.id !== id && o.nome.trim().toLowerCase() === nome.toLowerCase())) {
    errori.nome = 'C\'è già un optional con questo nome.';
  }
  const prezzo = numero(dati.prezzo);
  if (prezzo === null) errori.prezzo = 'Scrivi il prezzo.';
  else if (!(prezzo > 0)) errori.prezzo = 'Il prezzo deve essere maggiore di zero.';
  const massimo = numero(dati.massimo);
  if (dati.modo !== 'noleggio' && massimo !== null) {
    if (Number.isNaN(massimo) || massimo <= 0) errori.massimo = 'Lascia vuoto o scrivi un importo.';
    else if (prezzo > 0 && massimo < prezzo) errori.massimo = 'Il massimo non può essere meno del prezzo di un giorno.';
  }
  const perNoleggio = numero(dati.maxPerNoleggio);
  if (!(perNoleggio >= 1) || !Number.isInteger(perNoleggio)) errori.maxPerNoleggio = 'Almeno 1.';
  const pezzi = numero(dati.pezzi);
  if (pezzi !== null && (Number.isNaN(pezzi) || pezzi < 0 || !Number.isInteger(pezzi))) {
    errori.pezzi = 'Lascia vuoto (senza limite) o scrivi un numero intero.';
  }
  return errori;
}

// Prezzo di `quantita` pezzi per `giorni` giorni di noleggio. Al giorno: prezzo
// x giorni, ma non oltre il massimo (per ogni pezzo). A noleggio: una volta.
export function prezzoOptional(optional, giorni, quantita = 1) {
  const o = normalizzaOptional(optional);
  const q = Math.max(0, Math.floor(quantita || 0));
  if (q === 0) return 0;
  const perPezzo = o.modo === 'noleggio'
    ? o.prezzo
    : Math.min(o.prezzo * Math.max(1, giorni || 1), o.massimo ?? Infinity);
  return arrotonda(perPezzo * q);
}

const euro = (n) => `${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;

// "8 € al giorno · massimo 60 € a noleggio" / "25 € a noleggio"
export function testoPrezzo(optional) {
  const o = normalizzaOptional(optional);
  const base = `${euro(o.prezzo)} ${MODI_PREZZO[o.modo]}`;
  return o.massimo ? `${base} · massimo ${euro(o.massimo)} a noleggio` : base;
}

// Esempio per il form: "5 giorni = 40 €, 10 giorni = 60 € (massimo)".
export function esempioPrezzo(optional) {
  const o = normalizzaOptional(optional);
  if (!(o.prezzo > 0)) return '';
  if (o.modo === 'noleggio') return `Qualunque durata = ${euro(o.prezzo)} a pezzo.`;
  const voce = (g) => {
    const p = prezzoOptional(o, g, 1);
    return `${g} giorni = ${euro(p)}${o.massimo && p >= o.massimo ? ' (massimo)' : ''}`;
  };
  return `Esempio per un pezzo: ${voce(5)}, ${voce(10)}.`;
}

// Dal form ai campi da salvare.
export function preparaOptional(dati) {
  const { id, ...campi } = normalizzaOptional(dati);
  return campi;
}

// Ordine nell'elenco: prima quelli sul sito, poi per nome.
export const ordinaOptional = (elenco = []) => [...elenco].sort(
  (a, b) => Number(b.sulSito) - Number(a.sulSito) || a.nome.localeCompare(b.nome, 'it'),
);
