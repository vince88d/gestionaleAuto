import { normalizzaAddebiti, validaAddebiti, addebitiPerForm, ADDEBITI_DI_PARTENZA } from './addebiti';

describe('addebiti al rientro', () => {
  it('parte dai prezzi di partenza', () => {
    expect(normalizzaAddebiti(undefined)).toEqual(ADDEBITI_DI_PARTENZA);
  });
  it('legge gli importi all\'italiana e scarta quelli sbagliati', () => {
    const n = normalizzaAddebiti({ rifornimentoQuarto: '25,50', pulizia: '-3', chiave: 'ciao', oggettoMancante: 0 });
    expect(n).toEqual({ rifornimentoQuarto: 25.5, pulizia: 30, chiave: 150, oggettoMancante: 0 });
  });
  it('valida: vuoto e non numeri sono errori, 0 va bene', () => {
    expect(validaAddebiti({ rifornimentoQuarto: '', pulizia: 'x', chiave: '0', oggettoMancante: '15' })).toEqual({
      rifornimentoQuarto: expect.any(String), pulizia: expect.any(String),
    });
  });
  it('scrive le caselle del form', () => {
    expect(addebitiPerForm({ rifornimentoQuarto: 20.5 }).rifornimentoQuarto).toBe('20,5');
  });
});
