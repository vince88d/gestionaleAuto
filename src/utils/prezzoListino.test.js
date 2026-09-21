import { confrontaConListino, devoApplicareListino, prezzoIniziale } from './prezzoListino';

describe('prezzoIniziale', () => {
  it('una prenotazione con prezzo salvato lo mantiene, anche se diverso dal listino', () => {
    expect(prezzoIniziale({ prezzoSalvato: 35, listino: 25 })).toBe(35);
    expect(prezzoIniziale({ prezzoSalvato: '35', listino: '25' })).toBe('35');
  });

  it('senza prezzo salvato parte dal listino', () => {
    expect(prezzoIniziale({ prezzoSalvato: '', listino: 25 })).toBe(25);
    expect(prezzoIniziale({ prezzoSalvato: undefined, listino: '25' })).toBe('25');
    expect(prezzoIniziale({ prezzoSalvato: 0, listino: 25 })).toBe(25);
  });

  it('senza nessuno dei due resta vuoto', () => {
    expect(prezzoIniziale({ prezzoSalvato: '', listino: undefined })).toBe('');
  });
});

describe('devoApplicareListino', () => {
  it("si applica quando il gestore sceglie un'auto diversa", () => {
    expect(devoApplicareListino({ targaScelta: 'BB2', targaAllineata: 'AA1' })).toBe(true);
    expect(devoApplicareListino({ targaScelta: 'AA1', targaAllineata: '' })).toBe(true);
  });

  it("non si applica se l'auto è la stessa (aggiornamento della lista, riapertura)", () => {
    expect(devoApplicareListino({ targaScelta: 'AA1', targaAllineata: 'AA1' })).toBe(false);
    expect(devoApplicareListino({ targaScelta: '', targaAllineata: undefined })).toBe(false);
  });
});

describe('confrontaConListino', () => {
  it('prezzo uguale al listino', () => {
    expect(confrontaConListino(25, 25)).toEqual({ stato: 'uguale', listino: 25, differenza: 0 });
    expect(confrontaConListino('25', 25).stato).toBe('uguale');
  });

  it('prezzo sopra il listino (il gestore guadagna di più)', () => {
    expect(confrontaConListino(35, 25)).toEqual({ stato: 'sopra', listino: 25, differenza: 10 });
  });

  it('prezzo sotto il listino (sconto)', () => {
    expect(confrontaConListino(20, 25)).toEqual({ stato: 'sotto', listino: 25, differenza: -5 });
  });

  it('decimali senza errori di arrotondamento', () => {
    expect(confrontaConListino(25.1, 25).differenza).toBe(0.1);
  });

  it('listino o prezzo non noti: nessun confronto', () => {
    expect(confrontaConListino('', 25).stato).toBe('nessuno');
    expect(confrontaConListino(30, undefined).stato).toBe('nessuno');
    expect(confrontaConListino(30, 0).stato).toBe('nessuno');
  });
});
