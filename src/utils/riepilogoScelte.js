// Protezione ed extra nel Riepilogo della nuova prenotazione: cosa e' scelto
// adesso e se ce n'e' da scegliere (altrimenti non si mostra nulla).

import { protezioneImpostata, euro } from './protezioni';
import { totaleSceglibile } from './sceltaExtra';

// Ha senso far guardare la sezione 4? Serve l'auto (categoria) e qualcosa da
// scegliere: la protezione Totale oppure degli extra a catalogo.
export const haScelteDaFare = ({ categoria, protezione, numeroExtra = 0 }) => Boolean(categoria)
  && (numeroExtra > 0 || (protezioneImpostata(protezione) && Boolean(totaleSceglibile(protezione))));

// { protezione: 'Base · inclusa', extra: 'Seggiolino × 1, Navigatore × 1' | 'nessuno' }
export function testoScelte({ protezione, sceltaProtezione, preventivo }) {
  const p = preventivo?.protezione;
  let testoProtezione = 'non impostata';
  if (protezioneImpostata(protezione)) {
    testoProtezione = sceltaProtezione === 'totale' && p?.tipo === 'totale'
      ? `Totale · ${euro(p.prezzo)}`
      : 'Base · inclusa';
  }
  const extra = (preventivo?.optional || []).filter((o) => o.quantita > 0).map((o) => `${o.nome} × ${o.quantita}`);
  return { protezione: testoProtezione, extra: extra.length > 0 ? extra.join(', ') : 'nessuno' };
}
