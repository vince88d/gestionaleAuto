// Scadenze del veicolo (assicurazione, bollo, revisione): colore e testo,
// usati sia dalla card sia dalla scheda del veicolo.

export const SCADENZE_VEICOLO = [
  { chiave: 'assicurazione', nome: 'Assicurazione', breve: 'Assic.' },
  { chiave: 'bollo', nome: 'Bollo', breve: 'Bollo' },
  { chiave: 'revisione', nome: 'Revisione', breve: 'Revis.' },
];

const GIORNO_MS = 1000 * 60 * 60 * 24;

function giorniMancanti(dataStr, oggi) {
  const data = new Date(dataStr);
  if (Number.isNaN(data.getTime())) return null;
  return Math.floor((data - oggi) / GIORNO_MS);
}

// 'grigio' se manca la data, 'rosso' se scaduta, 'giallo' entro 30 giorni,
// altrimenti 'verde'.
export function coloreScadenza(dataStr, oggi = new Date()) {
  if (!dataStr) return 'grigio';
  const giorni = giorniMancanti(dataStr, oggi);
  if (giorni === null) return 'grigio';
  if (giorni < 0) return 'rosso';
  if (giorni <= 30) return 'giallo';
  return 'verde';
}

export function testoScadenza(dataStr, oggi = new Date()) {
  if (!dataStr) return 'Data non inserita';
  const giorni = giorniMancanti(dataStr, oggi);
  if (giorni === null) return 'Data non valida';
  if (giorni < 0) return 'Scaduta';
  if (giorni === 0) return 'Scade oggi';
  if (giorni <= 30) return `Scade tra ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`;
  return 'In regola';
}

// Data locale in formato YYYY-MM-DD. toISOString() userebbe l'ora UTC: in
// Italia tra mezzanotte e le 2 darebbe il giorno prima.
export function giornoLocale(data = new Date()) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

// Data in formato italiano (12/03/2027); '—' se manca.
export function formattaData(valore) {
  if (!valore) return '—';
  const data = new Date(valore);
  return Number.isNaN(data.getTime()) ? String(valore) : data.toLocaleDateString('it-IT');
}

// "12/10/2026 alle 9:00" (senza ora, solo la data: prenotazioni di prima).
export const dataEOra = (data, ora) => `${formattaData(data)}${ora ? ` alle ${String(ora).replace(/^0(\d)/, '$1')}` : ''}`;

// Nuova scadenza proposta quando si segna un rinnovo: un anno dopo quella
// vecchia (due per la revisione). Se manca o non e' valida si parte da oggi.
// Il gestore la puo' sempre correggere.
export function prossimaScadenza(chiave, dataAttuale, oggi = giornoLocale()) {
  const anni = chiave === 'revisione' ? 2 : 1;
  const base = /^\d{4}-\d{2}-\d{2}/.test(dataAttuale || '') ? String(dataAttuale).slice(0, 10) : oggi;
  const [a, m, g] = base.split('-').map(Number);
  const data = new Date(a + anni, m - 1, g);
  // 29 febbraio -> 28 febbraio (senza sconfinare a marzo).
  if (data.getMonth() !== m - 1) data.setDate(0);
  return giornoLocale(data);
}
