import {
  riassuntoCliente, riassuntoNoleggio, riassuntoProtezioneExtra, riassuntoConsegna, riassuntoRientro, schedeAperteIniziali,
} from './riassuntiPrenotazione';

const aperte = (p) => Object.keys(schedeAperteIniziali(p)).filter((k) => schedeAperteIniziali(p)[k]);

test('cliente e noleggio in una riga', () => {
  expect(riassuntoCliente({ cliente: 'Mario Rossi', emailCliente: 'm@r.it' })).toBe('Mario Rossi · m@r.it');
  expect(riassuntoCliente({})).toBe('Dati del cliente non indicati');
  expect(riassuntoNoleggio({ veicolo: 'Panda', targa: 'AA111AA', dataInizio: '2026-10-14', dataFine: '2026-10-17', prezzoTotale: '180' }))
    .toBe('Panda · AA111AA · 14/10/2026 → 17/10/2026 · € 180');
});

test('protezione ed extra: vuoto se non c\'e\' niente, altrimenti protezione, cauzione, extra', () => {
  expect(riassuntoProtezioneExtra({})).toBe('');
  expect(riassuntoProtezioneExtra({ protezione: { tipo: 'totale', cauzione: 300 }, optional: [{ nome: 'Seggiolino', quantita: 1 }, { nome: 'GPS', quantita: 0 }] }))
    .toBe('Protezione Totale · cauzione 300 € · Seggiolino');
  expect(riassuntoProtezioneExtra({ optional: [1, 2, 3].map((n) => ({ nome: `E${n}`, quantita: 1 })) })).toBe('3 extra');
  expect(riassuntoProtezioneExtra({ giovaneConducente: { importo: 30 } })).toBe('giovane conducente');
});

test('consegna e rientro', () => {
  expect(riassuntoConsegna({})).toBe('Non ancora consegnata');
  expect(riassuntoConsegna({ consegnataIl: '2026-10-14T08:30:00', schedaVeicolo: { kmIniziali: 48250, carburante: '3/4' } })).toBe('Fatta il 14/10/2026 · 48.250 km · 3/4');
  expect(riassuntoRientro({})).toBe('Non ancora avvenuto');
  expect(riassuntoRientro({ rientro: { dataRientro: '2026-10-17', totaleAddebiti: 30 } })).toBe('Il 17/10/2026 · addebiti 30 €');
  expect(riassuntoRientro({ rientro: { dataRientro: '2026-10-17', totaleAddebiti: 0 } })).toBe('Il 17/10/2026 · nessun addebito');
});

test('si aprono da sole solo le schede che servono', () => {
  expect(aperte({ status: 'attiva' })).toEqual(['cliente', 'noleggio']);
  expect(aperte({ status: 'attiva', consegnataIl: '2026-10-14' })).toEqual(['consegna']);
  expect(aperte({ status: 'completata', consegnataIl: '2026-10-14', rientro: {} })).toEqual(['rientro']);
  expect(aperte({ status: 'annullata' })).toEqual(['cliente', 'noleggio']);
  expect(aperte({ status: 'completata', daRiparare: true })).toEqual(['rientro', 'danni']);
});
