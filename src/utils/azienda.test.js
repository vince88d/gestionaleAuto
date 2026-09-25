import {
  AZIENDA_VUOTA, normalizzaAzienda, validaAzienda, aziendeUguali, aziendaVuota, campiCambiati,
} from './azienda';

describe('normalizzaAzienda', () => {
  it('tiene solo i campi conosciuti e toglie gli spazi', () => {
    expect(normalizzaAzienda({ nome: '  Formia Rent ', password: 'segreta', telefono: 3 })).toEqual({
      ...AZIENDA_VUOTA, nome: 'Formia Rent',
    });
  });

  it('partita IVA senza spazi e in maiuscolo, email in minuscolo', () => {
    const a = normalizzaAzienda({ partitaIva: 'rss mra 80a01 h501u', email: 'Info@X.it', pec: 'PEC@X.IT' });
    expect(a.partitaIva).toBe('RSSMRA80A01H501U');
    expect(a.email).toBe('info@x.it');
    expect(a.pec).toBe('pec@x.it');
  });
});

describe('validaAzienda', () => {
  it('il nome e\' obbligatorio', () => {
    expect(validaAzienda({ nome: '  ' })).toEqual({ nome: expect.any(String) });
    expect(validaAzienda({ nome: 'Formia Rent' })).toEqual({});
  });

  it('accetta partita IVA di 11 cifre o codice fiscale di 16 caratteri', () => {
    expect(validaAzienda({ nome: 'A', partitaIva: '01234567890' })).toEqual({});
    expect(validaAzienda({ nome: 'A', partitaIva: 'RSSMRA80A01H501U' })).toEqual({});
    expect(validaAzienda({ nome: 'A', partitaIva: '12345' }).partitaIva).toBeDefined();
  });

  it('controlla email e PEC solo se scritte', () => {
    expect(validaAzienda({ nome: 'A', email: 'nonvalida', pec: 'x@' })).toEqual({
      email: expect.any(String), pec: expect.any(String),
    });
    expect(validaAzienda({ nome: 'A', email: 'a@b.it', pec: 'a@pec.it' })).toEqual({});
  });
});

describe('aziendeUguali / aziendaVuota', () => {
  it('confronta i dati normalizzati', () => {
    expect(aziendeUguali({ nome: 'A ' }, { nome: 'A', email: '' })).toBe(true);
    expect(aziendeUguali({ nome: 'A' }, { nome: 'B' })).toBe(false);
  });

  it('elenca i campi cambiati', () => {
    expect(campiCambiati({ nome: 'A', pec: 'x@y.it' }, { nome: 'A ', telefono: '1' })).toEqual(['pec', 'telefono']);
  });

  it('riconosce i dati vuoti', () => {
    expect(aziendaVuota({})).toBe(true);
    expect(aziendaVuota({ nome: ' ', hasPassword: true })).toBe(true);
    expect(aziendaVuota({ telefono: '0771' })).toBe(false);
  });
});
