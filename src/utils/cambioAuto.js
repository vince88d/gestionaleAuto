import { controlloAbbinamento } from './neopatentati';
import { eConsegnata } from './regolePrenotazione';

// Categoria di una prenotazione: quella salvata (prenotazioni del sito) oppure
// quella dell'auto abbinata (prenotazioni fatte in sede, che non la salvano).
export const categoriaPrenotazione = (p, veicoli = []) =>
  p?.categoria || (veicoli || []).find((v) => v.targa === p?.targa)?.categoria || '';

// L'auto abbinata a una prenotazione non ancora consegnata va cambiata (o
// verificata) perche' non va bene per chi guida (neopatentato)? Serve per
// avvisare PRIMA della consegna: sulla riga, nei dettagli e in Dashboard.
// null se va tutto bene o non si puo' dire (manca la data della patente).
// { esito: 'no' | 'nd', messaggio, veicolo }
export function autoDaCambiare(prenotazione, veicoli = [], oggi = '') {
  const p = prenotazione;
  if (!p || p.status !== 'attiva' || eConsegnata(p) || !p.targa || !p.rilascioPatente) return null;
  const veicolo = (veicoli || []).find((v) => v.targa === p.targa);
  if (!veicolo) return null;
  const inizio = String(p.dataInizio || '').slice(0, 10);
  const ritiro = oggi && oggi > inizio ? oggi : inizio;
  const c = controlloAbbinamento({ veicolo, rilascio: p.rilascioPatente, ritiro });
  if (c.ok || !c.neopatentato) return null;
  return { esito: c.idoneita?.esito === 'no' ? 'no' : 'nd', messaggio: c.messaggio, veicolo };
}
