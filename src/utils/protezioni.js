// Protezioni e cauzione per categoria: funzioni pure, testate.
// Le imposta lo staff nella scheda "Protezioni e cauzione" di Tariffe e
// optional; il sito le legge (documento pubblico impostazioni/protezioni).
//
// Ogni categoria ha:
// - base: inclusa nel prezzo. Quanto paga al massimo il cliente per danni e
//   furto (franchigia) e quanto si blocca sulla carta (cauzione);
// - totale: protezione a pagamento, facoltativa (offerta o no). Prezzo al
//   giorno con eventuale tetto, franchigie e cauzione ridotte, coperture extra.
//
// Il calcolo del prezzo (prezzoProtezione) deve restare identico a quello del
// sito (formiarent, functions/src): se cambi uno, cambia anche l'altro.

export const COPERTURE = [
  ['cristalli', 'Cristalli'],
  ['gomme', 'Gomme'],
  ['sottoscocca', 'Sottoscocca'],
];

const IMPORTI = ['danni', 'furto', 'cauzione'];

// Importo in euro scritto a mano: accetta "1200", "1.200", "1 200", "12,50",
// "1.200,50". Un punto seguito da gruppi di 3 cifre e' il separatore delle
// migliaia (all'italiana), altrimenti e' la virgola dei decimali.
// '' / null = non scritto; NaN = scritto ma non e' un numero.
export function leggiEuro(valore) {
  if (valore === '' || valore === null || valore === undefined) return null;
  if (typeof valore === 'number') return Number.isFinite(valore) ? valore : NaN;
  let testo = String(valore).replace(/[\s€]/g, '');
  if (testo === '') return null;
  if (testo.includes(',')) testo = testo.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(testo)) testo = testo.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(testo)) return NaN;
  return Number(testo);
}

const arrotonda = (n) => Math.round(n * 100) / 100;
const importo = (v) => {
  const n = leggiEuro(v);
  return n === null || Number.isNaN(n) || n < 0 ? null : arrotonda(n);
};

// Da Firestore (o dal form) a una protezione con i tipi giusti. Gli importi
// mancanti restano null: la categoria risulta "da impostare".
export function normalizzaProtezione(dati = {}) {
  const base = dati.base || {};
  const tot = dati.totale || {};
  const copre = tot.copre || {};
  const prezzoGiorno = importo(tot.prezzoGiorno);
  const massimo = importo(tot.massimo);
  return {
    base: Object.fromEntries(IMPORTI.map((k) => [k, importo(base[k])])),
    totale: {
      offerta: tot.offerta === true,
      prezzoGiorno,
      massimo: massimo > 0 ? massimo : null,
      ...Object.fromEntries(IMPORTI.map((k) => [k, importo(tot[k])])),
      copre: Object.fromEntries(COPERTURE.map(([k]) => [k, copre[k] === true])),
    },
  };
}

// Documento impostazioni/protezioni intero: categorie e testi comuni.
export function normalizzaProtezioni(dati = {}) {
  const perCategoria = {};
  Object.entries(dati.perCategoria || {}).forEach(([categoria, p]) => {
    perCategoria[categoria] = normalizzaProtezione(p);
  });
  return {
    perCategoria,
    nonCopre: String(dati.nonCopre || ''),
    cauzioneTesto: String(dati.cauzioneTesto || ''),
  };
}

// Una categoria e' prenotabile sul sito solo se la Base ha tutti e tre gli
// importi (anche 0): mai mostrare al cliente una franchigia vuota.
export const protezioneImpostata = (p) => Boolean(p) && IMPORTI.every((k) => typeof p.base?.[k] === 'number');

// Campi del form (testo) da una protezione salvata, o vuoti per una nuova.
// Nelle caselle gli importi si leggono all'italiana ("1.200", "12,5"); leggiEuro li rilegge.
const testo = (n) => (n === null || n === undefined ? '' : n.toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' }));
export function perForm(p) {
  const n = normalizzaProtezione(p || {});
  return {
    base: Object.fromEntries(IMPORTI.map((k) => [k, testo(n.base[k])])),
    totale: {
      offerta: p ? n.totale.offerta : false,
      prezzoGiorno: testo(n.totale.prezzoGiorno),
      massimo: testo(n.totale.massimo),
      ...Object.fromEntries(IMPORTI.map((k) => [k, testo(n.totale[k])])),
      copre: { ...n.totale.copre },
    },
  };
}

const NOMI = { danni: 'danni', furto: 'furto', cauzione: 'cauzione' };

// Errori per campo ({} se si puo' salvare). Chiavi: "base.danni",
// "totale.prezzoGiorno", ...
export function validaProtezione(form) {
  const errori = {};
  IMPORTI.forEach((k) => {
    const n = leggiEuro(form.base[k]);
    if (n === null) errori[`base.${k}`] = 'Scrivi l\'importo (anche 0).';
    else if (Number.isNaN(n) || n < 0) errori[`base.${k}`] = 'Scrivi un importo, es. 1.200';
  });
  if (!form.totale.offerta) return errori;

  const prezzo = leggiEuro(form.totale.prezzoGiorno);
  if (prezzo === null) errori['totale.prezzoGiorno'] = 'Scrivi il prezzo.';
  else if (Number.isNaN(prezzo) || !(prezzo > 0)) errori['totale.prezzoGiorno'] = 'Il prezzo deve essere maggiore di zero.';
  const massimo = leggiEuro(form.totale.massimo);
  if (massimo !== null) {
    if (Number.isNaN(massimo) || massimo <= 0) errori['totale.massimo'] = 'Lascia vuoto o scrivi un importo.';
    else if (prezzo > 0 && massimo < prezzo) errori['totale.massimo'] = 'Non può essere meno del prezzo di un giorno.';
  }
  IMPORTI.forEach((k) => {
    const n = leggiEuro(form.totale[k]);
    const b = leggiEuro(form.base[k]);
    if (n === null) errori[`totale.${k}`] = 'Scrivi l\'importo (anche 0).';
    else if (Number.isNaN(n) || n < 0) errori[`totale.${k}`] = 'Scrivi un importo.';
    // La protezione a pagamento deve far pagare meno, non di piu'.
    else if (typeof b === 'number' && !Number.isNaN(b) && n > b) errori[`totale.${k}`] = `Non più della Base (${NOMI[k]}).`;
  });
  return errori;
}

// Dal form ai campi da salvare. Se la Totale non e' offerta si tengono
// comunque i valori scritti (se la si riattiva non vanno riscritti).
export const preparaProtezione = (form) => normalizzaProtezione({
  base: form.base,
  totale: { ...form.totale, offerta: form.totale.offerta === true },
});

// Prezzo della protezione Totale per `giorni` giorni: prezzo al giorno x
// giorni, ma non oltre il tetto. 0 se non offerta.
export function prezzoProtezione(protezione, giorni) {
  const t = normalizzaProtezione(protezione).totale;
  if (!t.offerta || !(t.prezzoGiorno > 0)) return 0;
  return arrotonda(Math.min(t.prezzoGiorno * Math.max(1, giorni || 1), t.massimo ?? Infinity));
}

// "1.200 €": il punto delle migliaia sempre (in italiano di serie parte da 10.000).
export const euro = (n) => `${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: 'always' })} €`;

// "Esempio per 3 giorni: Totale +36 €. Con la Totale, in caso di danno il
// cliente paga al massimo 0 €."
export function esempioProtezione(form, giorni = 3) {
  if (!form.totale.offerta) return '';
  const p = preparaProtezione(form);
  const prezzo = prezzoProtezione(p, giorni);
  if (!(prezzo > 0)) return '';
  const danni = p.totale.danni;
  return `Esempio per ${giorni} giorni: Base inclusa, Totale\u00a0+${euro(prezzo).replace(' ', '\u00a0')}.`
    + (typeof danni === 'number' ? ` Con la Totale, in caso di danno il cliente paga al massimo ${euro(danni).replace(' ', '\u00a0')}.` : '');
}
