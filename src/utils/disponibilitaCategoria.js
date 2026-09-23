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

  const flotta = (veicoli || []).filter((v) => v.categoria === categoria);
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
  const occupatoPerTarga = (prenotazioni || []).some(
    (p) => veicolo.targa && p.targa === veicolo.targa && siSovrappongono(dataInizio, dataFine, p.dataInizio, p.dataFine)
  );
  if (occupatoPerTarga) return false;
  if (!veicolo.categoria) return true;
  return disponibiliPerCategoria(veicolo.categoria, dataInizio, dataFine, veicoli, prenotazioni, holds) > 0;
}
