import { quandoPrenotazione } from './quandoPrenotazione';

const base = { dataInizio: '2026-10-12', dataFine: '2026-10-13', oraInizio: '09:00', oraFine: '09:00', targa: 'AB123TR', status: 'attiva' };

test('ritiro oggi: in evidenza il ritiro, sotto il rientro con i giorni', () => {
  expect(quandoPrenotazione(base, '2026-10-12', 1)).toEqual({
    principale: 'Ritiro oggi · 9:00', secondaria: 'Rientro 13/10 · 9:00 · 1 giorno', livello: 'urgente',
  });
});

test('ritiro domani e tra due giorni conservano il livello del promemoria', () => {
  expect(quandoPrenotazione(base, '2026-10-11', 1)).toMatchObject({ principale: 'Ritiro domani · 9:00', livello: 'domani' });
  expect(quandoPrenotazione(base, '2026-10-10', 1)).toMatchObject({ principale: 'Ritiro tra 2 gg · 9:00', livello: 'prossima' });
});

test('ritiro lontano: la data, non «tra N gg»', () => {
  expect(quandoPrenotazione(base, '2026-10-01', 1)).toEqual({
    principale: 'Ritiro 12/10 · 9:00', secondaria: 'Rientro 13/10 · 9:00 · 1 giorno', livello: '',
  });
});

test('auto dal cliente: in evidenza il rientro, sotto il ritiro', () => {
  const inCorso = { ...base, dataInizio: '2026-10-11', dataFine: '2026-10-16', oraFine: '18:00', consegnataIl: '2026-10-11T09:00:00Z' };
  expect(quandoPrenotazione(inCorso, '2026-10-12', 5)).toEqual({
    principale: 'Rientro 16/10 · 18:00', secondaria: 'Ritiro 11/10 · 9:00 · 5 giorni', livello: '',
  });
});

test('rientro scaduto: lo dice, con il livello urgente', () => {
  const scaduto = { ...base, dataInizio: '2026-10-09', dataFine: '2026-10-11', consegnataIl: '2026-10-09T09:00:00Z' };
  expect(quandoPrenotazione(scaduto, '2026-10-12', 2)).toMatchObject({ principale: 'Rientro scaduto da 1 gg · 9:00', livello: 'urgente' });
});

test('senza ore e con un altro anno', () => {
  const p = { ...base, oraInizio: '', oraFine: '', dataInizio: '2027-01-05', dataFine: '2027-01-08' };
  expect(quandoPrenotazione(p, '2026-10-12', 0)).toEqual({ principale: 'Ritiro 05/01/2027', secondaria: 'Rientro 08/01/2027', livello: '' });
});
