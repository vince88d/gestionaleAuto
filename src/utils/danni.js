// Danni dell'auto per i verbali: elenco numerato [{ numero, titolo, dettaglio, nuovo }].
// Alla consegna i danni sono ancora un testo libero (`scheda.danni`): se c'e'
// qualcosa di scritto diventa una voce sola. Con lo schema (utils/schemaDanni.js)
// ci sono i segni numerati con il punto sull'auto: `segniDanni`.

import { VISTE, segniDi } from './schemaDanni';

// Voce dell'elenco dei danni. Con un punto sullo schema porta anche vista e
// posizione; il vecchio testo libero resta una voce senza punto.
const voce = (segno, numero, { nuovo, daRiparare = false }) => {
  const punto = segno.vista ? { vista: segno.vista, x: segno.x, y: segno.y } : {};
  let dettaglio;
  if (!segno.vista) dettaglio = nuovo ? (daRiparare ? 'Da riparare' : '') : 'Già presente alla consegna';
  else {
    dettaglio = [nuovo ? '' : 'Già presente', segno.tipo, VISTE[segno.vista], nuovo && daRiparare ? 'Da riparare' : '']
      .filter(Boolean).join(' · ');
  }
  return { numero, titolo: segno.testo.trim() || segno.tipo, dettaglio, nuovo, ...punto };
};

// Danni gia' presenti alla consegna.
export function danniConsegna(scheda = {}) {
  return segniDi(scheda.segniDanni, scheda.danni).map((s, i) => voce(s, i + 1, { nuovo: false }));
}

// Danni emersi al rientro: quelli della consegna (grigi) piu' i nuovi (rossi).
export function danniRientro(prenotazione = {}) {
  const vecchi = danniConsegna(prenotazione.schedaVeicolo);
  const nuovi = segniDi(prenotazione.segniDanni, prenotazione.descrizioneDanno);
  return [
    ...vecchi,
    ...nuovi.map((s, i) => voce(s, vecchi.length + i + 1, { nuovo: true, daRiparare: Boolean(prenotazione.daRiparare) })),
  ];
}

// Immagini (indirizzi o dati incorporati) di un campo foto: testo singolo o elenco.
export const elencoFoto = (valore) => [].concat(valore || []).filter((f) => typeof f === 'string' && f);
