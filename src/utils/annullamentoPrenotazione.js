import { formattaData } from './scadenze';

// Testo della conferma di «Annulla prenotazione»: dice che cosa succede davvero
// (l'auto torna libera, la prenotazione va nel Cestino). Mockup approvato:
// formiarent-documenti/mockup/gestionale-prenotazione-modello-unico.html
export function testoAnnullamento(p) {
  if (!p) return '';
  const auto = [p.veicolo, p.targa ? `(${p.targa})` : ''].filter(Boolean).join(' ');
  const periodo = p.dataInizio && p.dataFine ? ` dal ${formattaData(p.dataInizio)} al ${formattaData(p.dataFine)}` : '';
  const liberaz = auto ? `${auto} torna libera${periodo}.` : `L'auto torna libera${periodo}.`;
  return `${p.cliente ? `Prenotazione di ${p.cliente}. ` : ''}${liberaz} La prenotazione va nel Cestino: la ritrovi per 6 mesi, poi viene cancellata.`;
}
