import {
  eAnnullamento, dataAnnullamento, puoEliminareDaArchivio, conflittoRipristino, cercaArchivio, ordinaPerRecenti, importiArchivio,
} from './archivio';

jest.mock('../lib/firestorePrenotazioni', () => ({
  STATI_PRENOTAZIONE_NON_CONFERMATE: ['richiesta-sito', 'scaduta', 'pagamento-fallito'],
}));

test('annullamenti veri: non i pagamenti abbandonati a meta\' checkout', () => {
  expect(eAnnullamento({ status: 'annullata', annullataDa: 'cliente' })).toBe(true);
  expect(eAnnullamento({ status: 'annullata', annullataDa: 'staff' })).toBe(true);
  expect(eAnnullamento({ status: 'annullata' })).toBe(false);
  expect(eAnnullamento({ status: 'completata', annullataDa: 'staff' })).toBe(false);
});

test('data di annullamento da Timestamp o da testo', () => {
  expect(dataAnnullamento({ annullataIl: { toDate: () => new Date('2026-09-20T10:00:00Z') } })).toBe('2026-09-20T10:00:00.000Z');
  expect(dataAnnullamento({})).toBe('');
});

test('pagate sul sito: non si eliminano', () => {
  expect(puoEliminareDaArchivio({ origine: 'sito' })).toBe(false);
  expect(puoEliminareDaArchivio({ paymentIntentId: 'pi_1' })).toBe(false);
  expect(puoEliminareDaArchivio({})).toBe(true);
});

describe('conflittoRipristino', () => {
  const noleggio = { id: 'x', targa: 'AA111AA', dataInizio: '2026-10-01', dataFine: '2026-10-05', status: 'completata' };
  test('veicolo preso da un\'altra prenotazione attiva in quelle date', () => {
    const altra = { id: 'y', targa: 'AA111AA', dataInizio: '2026-10-04', dataFine: '2026-10-06', status: 'attiva', cliente: 'Rossi' };
    expect(conflittoRipristino(noleggio, [noleggio, altra])).toBe(altra);
  });
  test('libero se l\'altra e\' annullata, conclusa, su altra targa o in altre date', () => {
    const altre = [
      { id: 'a', targa: 'AA111AA', dataInizio: '2026-10-02', dataFine: '2026-10-03', status: 'annullata' },
      { id: 'b', targa: 'AA111AA', dataInizio: '2026-10-02', dataFine: '2026-10-03', status: 'completata' },
      { id: 'c', targa: 'BB222BB', dataInizio: '2026-10-02', dataFine: '2026-10-03', status: 'attiva' },
      { id: 'd', targa: 'AA111AA', dataInizio: '2026-10-06', dataFine: '2026-10-08', status: 'attiva' },
    ];
    expect(conflittoRipristino(noleggio, [noleggio, ...altre])).toBeNull();
  });
});

test('ricerca su piu\' parole e anche senza targa', () => {
  const p = [{ id: '1', cliente: 'Mario Rossi', targa: 'AB123CD' }, { id: '2', cliente: 'Anna Verdi', categoria: 'SUV' }];
  expect(cercaArchivio(p, 'rossi ab123').map((x) => x.id)).toEqual(['1']);
  expect(cercaArchivio(p, 'suv').map((x) => x.id)).toEqual(['2']);
  expect(cercaArchivio(p, '')).toHaveLength(2);
});

test('ordine dal piu\' recente e importi', () => {
  expect(ordinaPerRecenti([{ id: 'a', dataFine: '2026-01-01' }, { id: 'b', dataFine: '2026-05-01' }]).map((x) => x.id)).toEqual(['b', 'a']);
  expect(importiArchivio({ totale: 240, rimborsato: 200, penaleTrattenuta: 40 })).toEqual({ totale: 240, rimborsato: 200, trattenuto: 40 });
});

describe('periodo, totali e CSV', () => {
  const {
    filtraPeriodo, anniDisponibili, riepilogoConclusi, riepilogoAnnullati, righeCsv, testoCsv,
  } = require('./archivio');
  const conclusi = [
    { id: '1', status: 'completata', dataInizio: '2026-08-28', dataFine: '2026-09-02', prezzoTotale: 150, cliente: 'Mario "Mimmo" Rossi' },
    { id: '2', status: 'completata', dataInizio: '2026-09-10', dataFine: '2026-09-12', totale: 240.5, origine: 'sito' },
    { id: '3', status: 'completata', dataInizio: '2025-12-30', dataFine: '2026-01-02', prezzoTotale: 90 },
    { id: '4', status: 'completata', dataInizio: '2025-05-01', dataFine: '2025-05-03', prezzoTotale: 60 },
  ];
  test('il noleggio cade nel mese in cui finisce', () => {
    expect(filtraPeriodo(conclusi, { anno: '2026', mese: '09' }).map((p) => p.id)).toEqual(['1', '2']);
    expect(filtraPeriodo(conclusi, { anno: '2026' }).map((p) => p.id)).toEqual(['1', '2', '3']);
    expect(filtraPeriodo(conclusi, {})).toHaveLength(4);
    expect(anniDisponibili(conclusi)).toEqual(['2026', '2025']);
  });
  test('totali', () => {
    expect(riepilogoConclusi(filtraPeriodo(conclusi, { anno: '2026', mese: '09' }))).toEqual({ numero: 2, incassato: 390.5 });
    const annullati = [
      { status: 'annullata', annullataDa: 'staff', annullataIl: '2026-09-18T09:00:00Z', totale: 200, rimborsato: 160, penaleTrattenuta: 40 },
      { status: 'annullata', annullataDa: 'cliente', annullataIl: '2026-09-20T09:00:00Z', totale: 100, rimborsato: 100 },
    ];
    expect(riepilogoAnnullati(annullati)).toEqual({ numero: 2, pagato: 300, rimborsato: 260, trattenuto: 40 });
    expect(filtraPeriodo(annullati, { anno: '2026', mese: '09' })).toHaveLength(2);
  });
  test('CSV per Excel italiano: punto e virgola, virgola decimale, date gg/mm/aaaa, virgolette protette', () => {
    const righe = righeCsv([conclusi[0], conclusi[1]]);
    expect(righe[0][0]).toBe('Cliente');
    expect(righe[2]).toEqual(expect.arrayContaining(['240,5', 'Sito', '10/09/2026']));
    expect(testoCsv(righe).split('\r\n')[1].startsWith('"Mario ""Mimmo"" Rossi";')).toBe(true);
  });
});
