import { coloreScadenza, testoScadenza, formattaData, giornoLocale } from './scadenze';

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
