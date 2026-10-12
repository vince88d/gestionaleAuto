// Danni dell'auto per i verbali: elenco numerato [{ numero, titolo, dettaglio, nuovo }].
// Alla consegna i danni sono ancora un testo libero (`scheda.danni`): se c'e'
// qualcosa di scritto diventa una voce sola. Lo schema con i punti sull'auto
// (passo successivo) dara' un elenco vero nello stesso formato.

const NESSUNO = /^\s*(nessuno|nessun danno|niente|-|—)?\s*$/i;

// Danni gia' presenti alla consegna.
export function danniConsegna(scheda = {}) {
  const testo = typeof scheda.danni === 'string' ? scheda.danni.trim() : '';
  if (NESSUNO.test(testo)) return [];
  return [{ numero: 1, titolo: testo, dettaglio: 'Già presente alla consegna', nuovo: false }];
}

// Danni emersi al rientro: quelli della consegna (grigi) piu' quello nuovo (rosso).
export function danniRientro(prenotazione = {}) {
  const vecchi = danniConsegna(prenotazione.schedaVeicolo);
  const testo = String(prenotazione.descrizioneDanno || '').trim();
  const voci = [...vecchi];
  if (testo) {
    voci.push({
      numero: vecchi.length + 1,
      titolo: testo,
      dettaglio: prenotazione.daRiparare ? 'Da riparare' : '',
      nuovo: true,
    });
  }
  return voci;
}

// Immagini (indirizzi o dati incorporati) di un campo foto: testo singolo o elenco.
export const elencoFoto = (valore) => [].concat(valore || []).filter((f) => typeof f === 'string' && f);
