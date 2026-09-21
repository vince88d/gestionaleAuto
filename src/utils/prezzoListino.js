// Prezzo giornaliero di una prenotazione: il gestore parte dal listino dell'auto
// ma può scrivere qualsiasi prezzo (nessun limite). Queste funzioni evitano che il
// prezzo concordato venga rimesso a listino senza volerlo e calcolano lo scarto.

const positivo = (valore) => {
  const numero = Number(valore);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
};

// Prezzo con cui aprire il modulo: se la prenotazione ha già un prezzo salvato (anche
// diverso dal listino) resta quello, altrimenti si parte dal listino dell'auto.
export function prezzoIniziale({ prezzoSalvato, listino }) {
  if (positivo(prezzoSalvato) !== null) return prezzoSalvato;
  return listino ?? '';
}

// Il listino va applicato solo quando il gestore sceglie un'auto diversa da quella
// già allineata: un aggiornamento della lista veicoli o la riapertura della
// prenotazione non devono cancellare il prezzo scritto a mano.
export function devoApplicareListino({ targaScelta, targaAllineata }) {
  return (targaScelta || '') !== (targaAllineata || '');
}

// Confronto tra il prezzo applicato e il listino, per mostrarlo sotto il campo.
// stato: 'nessuno' (listino o prezzo non noti), 'uguale', 'sopra', 'sotto'.
export function confrontaConListino(applicato, listino) {
  const prezzo = positivo(applicato);
  const base = positivo(listino);
  if (prezzo === null || base === null) return { stato: 'nessuno', listino: base, differenza: 0 };
  const differenza = Math.round((prezzo - base) * 100) / 100;
  if (differenza === 0) return { stato: 'uguale', listino: base, differenza: 0 };
  return { stato: differenza > 0 ? 'sopra' : 'sotto', listino: base, differenza };
}
