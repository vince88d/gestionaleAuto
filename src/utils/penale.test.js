import { calcolaPenale } from './penale';

describe('calcolaPenale', () => {
  test('nessuna penale: rimborso totale, niente da inviare al server', () => {
    expect(calcolaPenale(75, { tipo: 'nessuna' })).toEqual({ valida: true, trattenuto: 0, rimborso: 75, penale: undefined });
    expect(calcolaPenale(75, undefined).rimborso).toBe(75);
  });

  test.each([
    [75, 10, 7.5, 67.5],
    [75, 20, 15, 60],
    [75, 30, 22.5, 52.5],
    [75, 50, 37.5, 37.5],
    [75, 100, 75, 0],
  ])('totale %s con penale %s%% -> trattenuto %s, rimborso %s', (totale, percentuale, trattenuto, rimborso) => {
    const r = calcolaPenale(totale, { tipo: 'percentuale', valore: percentuale });
    expect(r.valida).toBe(true);
    expect(r.trattenuto).toBe(trattenuto);
    expect(r.rimborso).toBe(rimborso);
    expect(r.penale).toEqual({ percentuale });
  });

  test('importo fisso in euro', () => {
    const r = calcolaPenale(75, { tipo: 'importo', valore: 12.5 });
    expect(r).toEqual({ valida: true, trattenuto: 12.5, rimborso: 62.5, penale: { importo: 12.5 } });
  });

  test('arrotonda al centesimo come il server (33,33 € al 10% -> 3,33 €)', () => {
    const r = calcolaPenale(33.33, { tipo: 'percentuale', valore: 10 });
    expect(r.trattenuto).toBe(3.33);
    expect(r.rimborso).toBe(30);
  });

  test('valori non validi non calcolano nulla e restituiscono un messaggio', () => {
    for (const scelta of [
      { tipo: 'percentuale', valore: -1 }, { tipo: 'percentuale', valore: 101 }, { tipo: 'percentuale', valore: 'abc' },
      { tipo: 'importo', valore: -5 }, { tipo: 'importo', valore: 75.01 }, { tipo: 'importo', valore: 'abc' },
    ]) {
      const r = calcolaPenale(75, scelta);
      expect(r.valida).toBe(false);
      expect(r.errore).toBeTruthy();
      expect(r.penale).toBeUndefined();
    }
  });

  test('importo pagato non valido', () => {
    expect(calcolaPenale('abc', { tipo: 'nessuna' }).valida).toBe(false);
  });
});
