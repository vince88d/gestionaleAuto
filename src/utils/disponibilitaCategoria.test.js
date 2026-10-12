import {
  disponibiliPerCategoria, veicoloLibero, sovraprenotazioniCategoria, prenotazioniSuVeicoloSospeso,
} from './disponibilitaCategoria';

const auto = (targa, extra = {}) => ({ id: targa, targa, categoria: 'City car', ...extra });
const prenotazione = (id, dataInizio, dataFine, extra = {}) =>
  ({ id, status: 'attiva', dataInizio, dataFine, categoria: 'City car', ...extra });

describe('veicolo sospeso', () => {
  const flotta = [auto('AA111AA'), auto('BB222BB', { sospeso: true })];

  test('non conta nella flotta noleggiabile della categoria', () => {
    expect(disponibiliPerCategoria('City car', '2026-10-10', '2026-10-12', flotta, [], [])).toBe(1);
  });

  test('una prenotazione sulla sua targa occupa comunque un posto della categoria', () => {
    const prenotazioni = [prenotazione('p1', '2026-10-10', '2026-10-12', { targa: 'BB222BB', categoria: undefined })];
    expect(disponibiliPerCategoria('City car', '2026-10-11', '2026-10-11', flotta, prenotazioni, [])).toBe(0);
    expect(disponibiliPerCategoria('City car', '2026-10-20', '2026-10-21', flotta, prenotazioni, [])).toBe(1);
  });

  test('non e mai libero', () => {
    expect(veicoloLibero(flotta[1], '2026-10-10', '2026-10-12', flotta, [], [])).toBe(false);
    expect(veicoloLibero(flotta[0], '2026-10-10', '2026-10-12', flotta, [], [])).toBe(true);
  });
});

describe('sovraprenotazioniCategoria', () => {
  const flotta = [auto('AA111AA'), auto('BB222BB', { sospeso: true })];

  test('segnala i giorni con piu impegni che auto noleggiabili', () => {
    const prenotazioni = [
      prenotazione('p1', '2026-10-10', '2026-10-12'),
      prenotazione('p2', '2026-10-11', '2026-10-13'),
    ];
    expect(sovraprenotazioniCategoria('City car', flotta, prenotazioni, [], '2026-10-01')).toEqual([
      { da: '2026-10-11', a: '2026-10-12', occupati: 2, disponibili: 1 },
    ]);
  });

  test('niente da segnalare se la flotta basta o senza sospesi', () => {
    const prenotazioni = [prenotazione('p1', '2026-10-10', '2026-10-12')];
    expect(sovraprenotazioniCategoria('City car', flotta, prenotazioni, [], '2026-10-01')).toEqual([]);
    const tutte = [auto('AA111AA'), auto('BB222BB')];
    const due = [...prenotazioni, prenotazione('p2', '2026-10-10', '2026-10-12')];
    expect(sovraprenotazioniCategoria('City car', tutte, due, [], '2026-10-01')).toEqual([]);
  });

  test('ignora i giorni gia passati e le altre categorie', () => {
    const prenotazioni = [
      prenotazione('p1', '2026-09-01', '2026-09-05'),
      prenotazione('p2', '2026-09-01', '2026-09-05'),
      prenotazione('p3', '2026-10-10', '2026-10-12', { categoria: 'SUV' }),
      prenotazione('p4', '2026-10-10', '2026-10-12', { categoria: 'SUV' }),
    ];
    expect(sovraprenotazioniCategoria('City car', flotta, prenotazioni, [], '2026-10-01')).toEqual([]);
  });

  test('conta anche gli hold non scaduti', () => {
    const holds = [{ categoria: 'City car', dataInizio: '2026-10-10', dataFine: '2026-10-10', scadeIl: new Date(Date.now() + 60000) }];
    const prenotazioni = [prenotazione('p1', '2026-10-10', '2026-10-10')];
    expect(sovraprenotazioniCategoria('City car', flotta, prenotazioni, holds, '2026-10-01')).toEqual([
      { da: '2026-10-10', a: '2026-10-10', occupati: 2, disponibili: 1 },
    ]);
  });
});

describe('prenotazioniSuVeicoloSospeso', () => {
  const flotta = [auto('AA111AA'), auto('BB222BB', { sospeso: true })];

  test('trova solo quelle ancora da onorare sulla targa sospesa', () => {
    const prenotazioni = [
      prenotazione('p1', '2026-10-10', '2026-10-12', { targa: 'BB222BB' }),
      prenotazione('p2', '2026-10-10', '2026-10-12', { targa: 'AA111AA' }),
      prenotazione('p3', '2026-08-01', '2026-08-03', { targa: 'BB222BB' }),
      prenotazione('p4', '2026-10-10', '2026-10-12', { targa: 'BB222BB', status: 'annullata' }),
      prenotazione('p5', '2026-09-28', '2026-10-05', { targa: 'BB222BB', consegnataIl: '2026-09-28' }),
    ];
    expect(prenotazioniSuVeicoloSospeso(flotta, prenotazioni, '2026-10-01').map((p) => p.id)).toEqual(['p1']);
  });
});

describe('prenotazioni nel Cestino', () => {
  const { disponibiliPerCategoria, sovraprenotazioniCategoria, prenotazioniSuVeicoloSospeso } = require('./disponibilitaCategoria');
  const veicoli = [{ targa: 'FU111RG', categoria: 'Furgoni' }];
  const nelCestino = { id: 'x', status: 'attiva', eliminato: true, targa: 'FU111RG', categoria: 'Furgoni', dataInizio: '2099-10-12', dataFine: '2099-10-15' };

  it('non tolgono unita\' alla categoria', () => {
    expect(disponibiliPerCategoria('Furgoni', '2099-10-13', '2099-10-14', veicoli, [nelCestino], [])).toBe(1);
    expect(disponibiliPerCategoria('Furgoni', '2099-10-13', '2099-10-14', veicoli, [{ ...nelCestino, eliminato: false }], [])).toBe(0);
  });
  it('non contano come sovraprenotazioni ne come impegni su un veicolo sospeso', () => {
    expect(sovraprenotazioniCategoria('Furgoni', [], [nelCestino], [], '2099-10-01')).toEqual([]);
    expect(prenotazioniSuVeicoloSospeso([{ targa: 'FU111RG', sospeso: true }], [nelCestino], '2099-10-01')).toEqual([]);
  });
});
