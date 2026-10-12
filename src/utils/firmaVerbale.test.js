import { normalizzaFirma, nonFirmato, testoFirmaMancante, STATI_FIRMA } from './firmaVerbale';

const adesso = new Date('2026-10-12T09:05:00');

test('firma normale senza osservazioni: niente da salvare', () => {
  expect(normalizzaFirma(undefined, adesso)).toBeNull();
  expect(normalizzaFirma({ stato: 'foglio', osservazioni: '   ' }, adesso)).toBeNull();
  expect(normalizzaFirma({ stato: 'boh' }, adesso)).toBeNull();
});

test('osservazioni o rifiuto si salvano con la data', () => {
  expect(normalizzaFirma({ stato: 'foglio', osservazioni: '  Firmo   con riserva  ' }, adesso))
    .toEqual({ stato: 'foglio', osservazioni: 'Firmo con riserva', registrataIl: adesso.toISOString() });
  expect(normalizzaFirma({ stato: 'rifiuta' }, adesso)).toMatchObject({ stato: 'rifiuta', osservazioni: '' });
  expect(normalizzaFirma({ stato: 'foglio', osservazioni: 'x'.repeat(900) }, adesso).osservazioni).toHaveLength(500);
});

test('testo al posto della firma solo se non ha firmato', () => {
  expect(nonFirmato({ stato: 'foglio' })).toBe(false);
  expect(testoFirmaMancante({ stato: 'foglio' })).toBe('');
  expect(testoFirmaMancante({ stato: 'rifiuta', registrataIl: adesso.toISOString() }))
    .toBe('Firma non apposta: il cliente ha rifiutato di firmare. Registrato il 12/10/2026 alle 09:05.');
  expect(testoFirmaMancante({ stato: 'assente' })).toBe('Firma non apposta: il cliente non era presente.');
});

test('gli stati sono tre', () => {
  expect(STATI_FIRMA.map((s) => s.id)).toEqual(['foglio', 'rifiuta', 'assente']);
});
