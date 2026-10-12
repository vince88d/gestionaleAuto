// Colonna «Quando» dell'elenco prenotazioni: prima l'evento che conta adesso
// (il ritiro se l'auto non e' ancora stata data, il rientro se e' dal cliente),
// poi l'altro con i giorni. Funzione pura, testata.

import { eConsegnata, promemoria } from './regolePrenotazione';

const giorno = (valore) => (valore ? String(valore).slice(0, 10) : '');
const ora = (o) => (o ? String(o).replace(/^0(\d)/, '$1') : '');

// '2026-10-12' -> '12/10' (con l'anno se non e' quello di oggi)
function dataBreve(iso, oggi) {
  const g = giorno(iso);
  if (!g) return '';
  const [a, m, d] = g.split('-');
  return a === String(oggi || '').slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a}`;
}

// { principale, secondaria, livello } — `livello` come in promemoria():
// 'urgente' | 'domani' | 'prossima' | ''.
export function quandoPrenotazione(p, oggiIso, giorniNoleggio = 0) {
  const consegnata = eConsegnata(p);
  const nota = promemoria(p, oggiIso);
  const cosa = consegnata ? 'Rientro' : 'Ritiro';
  const dataEvento = consegnata ? p.dataFine : p.dataInizio;
  const oraEvento = consegnata ? p.oraFine : p.oraInizio;
  const vicino = Boolean(nota.livello);
  const principale = [vicino ? nota.testo : `${cosa} ${dataBreve(dataEvento, oggiIso)}`.trim(), ora(oraEvento)].filter(Boolean).join(' · ');

  const altro = consegnata
    ? `Ritiro ${dataBreve(p.dataInizio, oggiIso)}${p.oraInizio ? ` · ${ora(p.oraInizio)}` : ''}`
    : `Rientro ${dataBreve(p.dataFine, oggiIso)}${p.oraFine ? ` · ${ora(p.oraFine)}` : ''}`;
  const durata = giorniNoleggio > 0 ? `${giorniNoleggio} ${giorniNoleggio === 1 ? 'giorno' : 'giorni'}` : '';
  return { principale, secondaria: [altro, durata].filter(Boolean).join(' · '), livello: nota.livello };
}
