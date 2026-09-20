// Prenotazione arrivata dal sito e già pagata con carta: per annullarla serve il
// rimborso su Stripe, non basta eliminarla (il cliente resterebbe addebitato).
export function isPagataOnline(prenotazione) {
  return Boolean(prenotazione?.paymentIntentId) && prenotazione.status === 'attiva';
}
