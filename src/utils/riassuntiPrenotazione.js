import { formattaData } from './scadenze';
import { euro } from './protezioni';
import { prezzoPrenotazione } from './dashboard';
import { eConsegnata } from './regolePrenotazione';
import { daAssegnare } from './assegnazioneVeicolo';

// Riassunti di una riga per le schede richiudibili dei dettagli della
// prenotazione (compaiono solo da chiuse) e quali schede si aprono da sole.

export const SCHEDE_PRENOTAZIONE = ['cliente', 'noleggio', 'protezione', 'consegna', 'rientro', 'danni'];

const unisci = (parti) => parti.filter(Boolean).join(' · ');

export const riassuntoCliente = (p = {}) => unisci([p.cliente, p.codiceFiscale, p.emailCliente]) || 'Dati del cliente non indicati';

export function riassuntoNoleggio(p = {}) {
  const prezzo = prezzoPrenotazione(p);
  const auto = daAssegnare(p) ? `${p.categoria || 'Categoria'} · auto da scegliere` : unisci([p.veicolo || p.categoria, p.targa]);
  return unisci([auto, `${formattaData(p.dataInizio)} → ${formattaData(p.dataFine)}`, p.chilometri?.kmGiorno ? p.chilometri.nome : '', prezzo ? `€ ${prezzo}` : '']);
}

export function riassuntoProtezioneExtra(p = {}) {
  const extra = (Array.isArray(p.optional) ? p.optional : []).filter((r) => r?.quantita > 0);
  const protezione = p.protezione ? (p.protezione.tipo === 'totale' ? 'Protezione Totale' : 'Protezione Base') : '';
  const cauzione = typeof p.protezione?.cauzione === 'number' ? `cauzione ${euro(p.protezione.cauzione)}` : '';
  const elencoExtra = extra.length === 0 ? '' : extra.length <= 2 ? extra.map((r) => r.nome).join(', ') : `${extra.length} extra`;
  const eta = p.giovaneConducente ? 'giovane conducente' : typeof p.etaConducente === 'number' ? `conducente ${p.etaConducente} anni` : '';
  return unisci([protezione, cauzione, elencoExtra, eta]);
}

export function riassuntoConsegna(p = {}) {
  if (!eConsegnata(p)) return 'Non ancora consegnata';
  const km = p.schedaVeicolo?.kmIniziali ? `${Number(p.schedaVeicolo.kmIniziali).toLocaleString('it-IT')} km` : '';
  return unisci([p.consegnataIl ? `Fatta il ${formattaData(p.consegnataIl)}` : 'Fatta', km, p.schedaVeicolo?.carburante]);
}

export function riassuntoRientro(p = {}) {
  const r = p.rientro;
  if (!r) return 'Non ancora avvenuto';
  const totale = Number(r.totaleAddebiti) || 0;
  return unisci([`Il ${formattaData(r.dataRientro)}`, totale > 0 ? `addebiti ${euro(totale)}` : 'nessun addebito']);
}

export const riassuntoDanni = (p = {}) => p.descrizioneDanno || 'Danni segnalati alla riconsegna';

// Le schede che servono in quel momento: da consegnare = cliente e noleggio;
// auto fuori = la consegna; noleggio concluso = il rientro; sempre aperti i danni da riparare.
export function schedeAperteIniziali(p = {}) {
  const aperte = {};
  if (p.status === 'completata') aperte.rientro = true;
  else if (p.status !== 'annullata' && eConsegnata(p)) aperte.consegna = true;
  else { aperte.cliente = true; aperte.noleggio = true; }
  if (p.daRiparare) aperte.danni = true;
  return Object.fromEntries(SCHEDE_PRENOTAZIONE.map((id) => [id, Boolean(aperte[id])]));
}
