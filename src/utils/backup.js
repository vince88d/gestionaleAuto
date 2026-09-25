// Backup dei dati veri (quelli su Firestore) in un file JSON leggibile.
// Funzioni pure, testate: la lettura da Firestore sta in lib/backupDati.js.

export const VERSIONE_BACKUP = 1;

// Le date di Firestore (Timestamp, con toDate) diventano testo ISO; il resto
// resta com'e', anche dentro oggetti e liste.
export function serializzaValore(valore) {
  if (valore && typeof valore.toDate === 'function') return valore.toDate().toISOString();
  if (valore instanceof Date) return valore.toISOString();
  if (Array.isArray(valore)) return valore.map(serializzaValore);
  if (valore && typeof valore === 'object') {
    return Object.fromEntries(Object.entries(valore).map(([k, v]) => [k, serializzaValore(v)]));
  }
  return valore;
}

// collezioni: { veicoli: [{ id, ...dati }], ... }; impostazioni: { tariffe: {...} | null, ... }
export function componiBackup({ collezioni, impostazioni, creatoIl = new Date(), creatoDa = '' }) {
  return {
    tipo: 'backup-gestionale-noleggio',
    versione: VERSIONE_BACKUP,
    creatoIl: creatoIl.toISOString(),
    creatoDa,
    conteggi: Object.fromEntries(Object.entries(collezioni).map(([nome, docs]) => [nome, docs.length])),
    collezioni: serializzaValore(collezioni),
    impostazioni: serializzaValore(impostazioni),
  };
}

// Nome del file proposto: backup-gestionale-2026-09-24.json (data locale).
export function nomeFileBackup(data = new Date()) {
  const due = (n) => String(n).padStart(2, '0');
  return `backup-gestionale-${data.getFullYear()}-${due(data.getMonth() + 1)}-${due(data.getDate())}.json`;
}

// Riepilogo per il messaggio finale: "12 veicoli, 340 prenotazioni, 210 clienti".
export function riepilogoBackup(backup) {
  const c = backup.conteggi || {};
  return `${c.veicoli ?? 0} veicoli, ${c.prenotazioni ?? 0} prenotazioni, ${c.clienti ?? 0} clienti`;
}
