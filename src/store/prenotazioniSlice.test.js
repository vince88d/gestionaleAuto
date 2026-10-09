import reducer, { addPrenotazione, setPrenotazioni } from './prenotazioniSlice';

test('una prenotazione gia\' arrivata dall\'elenco in tempo reale non si duplica', () => {
  // Prima arriva dall'elenco in tempo reale, poi dal salvataggio.
  let stato = reducer([], setPrenotazioni([{ id: 'a', cliente: 'Mario' }]));
  stato = reducer(stato, addPrenotazione({ id: 'a', cliente: 'Mario', totale: 99 }));
  expect(stato).toEqual([{ id: 'a', cliente: 'Mario', totale: 99 }]);
});

test('una prenotazione nuova si aggiunge', () => {
  const stato = reducer([{ id: 'a' }], addPrenotazione({ id: 'b' }));
  expect(stato.map((p) => p.id)).toEqual(['a', 'b']);
});
