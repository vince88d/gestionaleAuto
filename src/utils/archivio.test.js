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
