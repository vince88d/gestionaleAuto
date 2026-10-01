import { prossimaScadenza, coloreScadenza, testoScadenza, formattaData, giornoLocale } from './scadenze';

const OGGI = new Date('2026-09-23T10:00:00');

describe('coloreScadenza', () => {
  test.each([
    [undefined, 'grigio'],
    ['', 'grigio'],
    ['non-una-data', 'grigio'],
    ['2026-09-01', 'rosso'],
    ['2026-10-10', 'giallo'],
    ['2027-03-12', 'verde'],
  ])('%s -> %s', (data, atteso) => {
    expect(coloreScadenza(data, OGGI)).toBe(atteso);
  });
});

describe('testoScadenza', () => {
  test('dice quanto manca solo quando e\' vicina', () => {
    expect(testoScadenza(undefined, OGGI)).toBe('Data non inserita');
    expect(testoScadenza('2026-09-01', OGGI)).toBe('Scaduta');
    expect(testoScadenza('2026-09-25', OGGI)).toBe('Scade tra 1 giorno');
    expect(testoScadenza('2026-10-10', OGGI)).toBe('Scade tra 16 giorni');
    expect(testoScadenza('2027-03-12', OGGI)).toBe('In regola');
  });
});

describe('formattaData', () => {
  test('formato italiano, trattino se manca', () => {
    expect(formattaData('2027-03-12')).toBe('12/03/2027');
    expect(formattaData(undefined)).toBe('—');
  });
});

describe('giornoLocale', () => {
  test('usa la data locale, non quella UTC', () => {
    expect(giornoLocale(new Date(2026, 8, 23, 0, 30))).toBe('2026-09-23');
  });
});

describe('prossimaScadenza', () => {
  test('un anno dopo per bollo e assicurazione, due per la revisione', () => {
    expect(prossimaScadenza('bollo', '2026-07-05')).toBe('2027-07-05');
    expect(prossimaScadenza('assicurazione', '2026-09-24')).toBe('2027-09-24');
    expect(prossimaScadenza('revisione', '2026-09-30')).toBe('2028-09-30');
  });

  test('senza data valida parte da oggi', () => {
    expect(prossimaScadenza('bollo', '', '2026-10-01')).toBe('2027-10-01');
    expect(prossimaScadenza('bollo', 'boh', '2026-10-01')).toBe('2027-10-01');
  });

  test('29 febbraio diventa 28 febbraio', () => {
    expect(prossimaScadenza('bollo', '2028-02-29')).toBe('2029-02-28');
  });
});
