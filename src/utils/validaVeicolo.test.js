import { normalizzaTarga, validaVeicolo, preparaVeicolo } from './validaVeicolo';

const flotta = [
  { id: 'v1', marca: 'Fiat', modello: 'Ducato', targa: 'AD123XY' },
  { id: 'v2', marca: 'Citroen', modello: 'C3', targa: 'ef 456 gh' },
];
const valido = { marca: 'Fiat', modello: 'Panda', targa: 'ZZ999ZZ', categoria: 'City Car' };

describe('normalizzaTarga', () => {
  test('maiuscolo, senza spazi ne\' trattini', () => {
    expect(normalizzaTarga(' ab 123-cd ')).toBe('AB123CD');
    expect(normalizzaTarga(undefined)).toBe('');
  });
});

describe('validaVeicolo', () => {
  test('un veicolo completo va bene', () => {
    expect(validaVeicolo(valido, flotta)).toEqual({});
  });

  test('marca, modello, targa e categoria sono obbligatori', () => {
    expect(Object.keys(validaVeicolo({ marca: ' ' }, flotta)).sort()).toEqual(['categoria', 'marca', 'modello', 'targa']);
  });

  test('targa gia\' in flotta, anche scritta diversa', () => {
    expect(validaVeicolo({ ...valido, targa: 'ad 123 xy' }, flotta).targa).toBe('Questa targa è già di Fiat Ducato.');
    expect(validaVeicolo({ ...valido, targa: 'EF456GH' }, flotta).targa).toBe('Questa targa è già di Citroen C3.');
  });

  test('modificando un veicolo la sua stessa targa non e\' un doppione', () => {
    expect(validaVeicolo({ ...valido, targa: 'AD123XY' }, flotta, 'v1')).toEqual({});
  });

  test('numeri fuori misura', () => {
    const errori = validaVeicolo({ ...valido, anno: 1800, km: -5, porte: 12 }, flotta, null, 2026);
    expect(errori).toEqual({ anno: 'Anno tra 1950 e 2027.', km: 'I km non possono essere negativi.', porte: 'Porte tra 1 e 9.' });
  });

  test('i campi facoltativi vuoti vanno bene', () => {
    expect(validaVeicolo({ ...valido, anno: '', km: '', porte: '' }, flotta)).toEqual({});
  });
});

describe('preparaVeicolo', () => {
  test('targa uniformata, testi puliti, numeri veri', () => {
    expect(preparaVeicolo({ targa: 'ab 123 cd', marca: ' Fiat ', anno: '2022', km: '45210', porte: '', note: ' ok ' }))
      .toEqual({ targa: 'AB123CD', marca: 'Fiat', anno: 2022, km: 45210, porte: '', note: 'ok' });
  });
});
