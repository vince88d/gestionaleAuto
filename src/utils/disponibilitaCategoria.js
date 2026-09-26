// Stessa logica usata lato sito (functions/src/disponibilita.ts), portata
// qui per il gestionale: una unità di categoria è "occupata" se esiste una
// prenotazione con status 'attiva' (di qualunque origine, sito o gestionale)
// oppure un hold non scaduto che si sovrappone alle date richieste,
// indipendentemente dal fatto che sia già legata a una targa specifica.
// Serve per evitare il doppio blocco: un cliente in ufficio non deve poter
// prenotare un'auto di una categoria già impegnata da un hold/prenotazione
// del sito, e viceversa.

function siSovrappongono(aInizio, aFine, bInizio, bFine) {
  return aInizio <= bFine && aFine >= bInizio;
}

function scadeIlInMillis(scadeIl) {
  if (!scadeIl) return null;
  if (typeof scadeIl.toMillis === 'function') return scadeIl.toMillis();
  const ms = new Date(scadeIl).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Risolve la categoria di una prenotazione/hold: quelli nati dal sito hanno
// già il campo `categoria`; quelli nati dal gestionale hanno `targa`, quindi
// la categoria va recuperata dal veicolo corrispondente in flotta.
function risolviCategoria(doc, veicoliPerTarga) {
  if (doc.categoria) return doc.categoria;
  if (doc.targa) return veicoliPerTarga.get(doc.targa)?.categoria;
  return undefined;
}

// Quante unità della categoria data sono libere per il periodo richiesto.
export function disponibiliPerCategoria(categoria, dataInizio, dataFine, veicoli, prenotazioni, holds, { escludiPrenotazioneId } = {}) {
  if (!categoria || !dataInizio || !dataFine) return Infinity;

  // Un veicolo sospeso (fermo per riparazione o altro) non fa parte della flotta
  // noleggiabile, ma le prenotazioni gia' prese sulla sua targa restano
  // conteggiate qui sotto: e' il gestore a doverle onorare con un altro mezzo.
  const flotta = (veicoli || []).filter((v) => v.categoria === categoria && !v.sospeso);
  const veicoliPerTarga = new Map((veicoli || []).filter((v) => v.targa).map((v) => [v.targa, v]));

  let occupati = 0;
  const ora = Date.now();

  (prenotazioni || []).forEach((p) => {
    if (p.status !== 'attiva') return;
    if (escludiPrenotazioneId && p.id === escludiPrenotazioneId) return;
    if (!p.dataInizio || !p.dataFine) return;
    if (!siSovrappongono(dataInizio, dataFine, p.dataInizio, p.dataFine)) return;
    if (risolviCategoria(p, veicoliPerTarga) === categoria) occupati += 1;
  });

  (holds || []).forEach((h) => {
    if (!h.dataInizio || !h.dataFine) return;
    const scadeMs = scadeIlInMillis(h.scadeIl);
    if (!scadeMs || scadeMs <= ora) return; // hold scaduto o senza scadenza, ignoralo
    if (!siSovrappongono(dataInizio, dataFine, h.dataInizio, h.dataFine)) return;
    if (h.categoria === categoria) occupati += 1;
  });

  return Math.max(0, flotta.length - occupati);
}

// Un veicolo e' libero nel periodo se non ha prenotazioni sulla sua targa che
// si sovrappongono E la sua categoria non e' piena (hold e prenotazioni del
// sito non ancora assegnate a un veicolo occupano un'unita' della categoria
// senza dire quale). Stessa regola per l'etichetta delle card in Veicoli e per
// la Dashboard. `prenotazioni` = solo quelle che occupano davvero (niente
// annullate, non pagate o gia' concluse).
export function veicoloLibero(veicolo, dataInizio, dataFine, veicoli, prenotazioni, holds) {
  if (veicolo.sospeso) return false;
  const occupatoPerTarga = (prenotazioni || []).some(
    (p) => veicolo.targa && p.targa === veicolo.targa && siSovrappongono(dataInizio, dataFine, p.dataInizio, p.dataFine)
  );
  if (occupatoPerTarga) return false;
  if (!veicolo.categoria) return true;
  return disponibiliPerCategoria(veicolo.categoria, dataInizio, dataFine, veicoli, prenotazioni, holds) > 0;
}

const ISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const prossimoGiorno = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return ISO(d);
};
const giornoDi = (valore) => (valore ? String(valore).slice(0, 10) : '');

// Giorni (da `oggi` in poi) in cui una categoria ha piu' prenotazioni/hold che
// veicoli noleggiabili: succede quando si sospende un'auto che ha gia' impegni.
// Non blocca e non cambia nulla: serve a far vedere al gestore dove deve
// intervenire (auto superiore, altro noleggiatore...). Restituisce intervalli
// consecutivi { da, a, occupati, disponibili } (`occupati` = il massimo nel
// tratto). `prenotazioni` = solo quelle che occupano davvero.
export function sovraprenotazioniCategoria(categoria, veicoli, prenotazioni, holds, oggi) {
  const flotta = (veicoli || []).filter((v) => v.categoria === categoria && !v.sospeso).length;
  const veicoliPerTarga = new Map((veicoli || []).filter((v) => v.targa).map((v) => [v.targa, v]));
  const ora = Date.now();

  const impegni = [];
  (prenotazioni || []).forEach((p) => {
    if (p.status !== 'attiva' || !p.dataInizio || !p.dataFine) return;
    if (risolviCategoria(p, veicoliPerTarga) !== categoria) return;
    impegni.push([giornoDi(p.dataInizio), giornoDi(p.dataRientroEffettiva || p.dataFine)]);
  });
  (holds || []).forEach((h) => {
    if (!h.dataInizio || !h.dataFine || h.categoria !== categoria) return;
    const scadeMs = scadeIlInMillis(h.scadeIl);
    if (!scadeMs || scadeMs <= ora) return;
    impegni.push([giornoDi(h.dataInizio), giornoDi(h.dataFine)]);
  });

  const futuri = impegni.filter(([, fine]) => fine >= oggi);
  if (futuri.length === 0) return [];
  const ultimo = futuri.reduce((max, [, fine]) => (fine > max ? fine : max), oggi);

  const intervalli = [];
  for (let g = oggi; g <= ultimo; g = prossimoGiorno(g)) {
    const occupati = futuri.filter(([inizio, fine]) => inizio <= g && fine >= g).length;
    if (occupati <= flotta) continue;
    const precedente = intervalli[intervalli.length - 1];
    if (precedente && prossimoGiorno(precedente.a) === g) {
      precedente.a = g;
      precedente.occupati = Math.max(precedente.occupati, occupati);
    } else {
      intervalli.push({ da: g, a: g, occupati, disponibili: flotta });
    }
  }
  return intervalli;
}

// Prenotazioni ancora da onorare che hanno la targa di un veicolo sospeso:
// vanno riassegnate a un altro mezzo. Le concluse, le annullate e quelle gia'
// finite non contano.
export function prenotazioniSuVeicoloSospeso(veicoli, prenotazioni, oggi) {
  const sospese = new Set((veicoli || []).filter((v) => v.sospeso && v.targa).map((v) => v.targa));
  if (sospese.size === 0) return [];
  return (prenotazioni || []).filter(
    (p) => p.status === 'attiva' && p.targa && sospese.has(p.targa) && giornoDi(p.dataRientroEffettiva || p.dataFine) >= oggi
  );
}
