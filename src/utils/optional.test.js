import {
  normalizzaOptional, validaOptional, prezzoOptional, testoPrezzo, esempioPrezzo, preparaOptional, ordinaOptional,
} from './optional';

const seggiolino = { nome: 'Seggiolino', modo: 'giorno', prezzo: '8', massimo: '60', maxPerNoleggio: '2', pezzi: '3' };
const catene = { nome: 'Catene', modo: 'noleggio', prezzo: '25', maxPerNoleggio: '1', pezzi: '' };

describe('prezzoOptional', () => {
  test('al giorno: prezzo x giorni, ma non oltre il massimo (per pezzo)', () => {
    expect(prezzoOptional(seggiolino, 5, 1)).toBe(40);
    expect(prezzoOptional(seggiolino, 10, 1)).toBe(60);
    expect(prezzoOptional(seggiolino, 10, 2)).toBe(120);
  });

  test('al giorno senza massimo; minimo un giorno', () => {
    expect(prezzoOptional({ ...seggiolino, massimo: '' }, 10, 1)).toBe(80);
    expect(prezzoOptional(seggiolino, 0, 1)).toBe(8);
  });

  test('a noleggio: una volta per pezzo, qualunque durata', () => {
    expect(prezzoOptional(catene, 1, 1)).toBe(25);
    expect(prezzoOptional(catene, 30, 2)).toBe(50);
  });

  test('zero pezzi = zero; centesimi arrotondati', () => {
    expect(prezzoOptional(seggiolino, 5, 0)).toBe(0);
    expect(prezzoOptional({ nome: 'x', prezzo: '3,33' }, 3, 1)).toBe(9.99);
  });
});

describe('normalizzaOptional', () => {
  test('tipi giusti; vuoti = nessun tetto / senza limite', () => {
    expect(normalizzaOptional(catene)).toEqual({
      nome: 'Catene', descrizione: '', modo: 'noleggio', prezzo: 25, massimo: null, maxPerNoleggio: 1, pezzi: null, sulSito: true,
    });
    expect(normalizzaOptional(seggiolino)).toEqual(expect.objectContaining({ massimo: 60, maxPerNoleggio: 2, pezzi: 3 }));
  });

  test('il massimo vale solo al giorno', () => {
    expect(normalizzaOptional({ ...catene, massimo: '60' }).massimo).toBeNull();
  });

  test('preparaOptional toglie l\'id', () => {
    expect(preparaOptional({ id: 'x', ...catene }).id).toBeUndefined();
  });
});

describe('validaOptional', () => {
  test('va bene', () => {
    expect(validaOptional(seggiolino)).toEqual({});
    expect(validaOptional(catene)).toEqual({});
  });

  test('nome mancante o gia\' usato (non conta se stesso)', () => {
    expect(validaOptional({ ...catene, nome: ' ' }).nome).toBeTruthy();
    const altri = [{ id: 'a', nome: 'catene' }];
    expect(validaOptional(catene, altri).nome).toMatch(/già/);
    expect(validaOptional(catene, altri, 'a')).toEqual({});
  });

  test('prezzo, massimo, quantita\' e pezzi', () => {
    expect(validaOptional({ ...catene, prezzo: '' }).prezzo).toBeTruthy();
    expect(validaOptional({ ...catene, prezzo: '0' }).prezzo).toBeTruthy();
    expect(validaOptional({ ...seggiolino, massimo: '5' }).massimo).toMatch(/meno/);
    expect(validaOptional({ ...seggiolino, maxPerNoleggio: '0' }).maxPerNoleggio).toBeTruthy();
    expect(validaOptional({ ...seggiolino, pezzi: '1.5' }).pezzi).toBeTruthy();
    expect(validaOptional({ ...seggiolino, pezzi: '0' })).toEqual({});
  });
});

describe('testi', () => {
  test('prezzo ed esempio', () => {
    expect(testoPrezzo(seggiolino)).toBe('8 € al giorno · massimo 60 € a noleggio');
    expect(testoPrezzo(catene)).toBe('25 € a noleggio');
    expect(esempioPrezzo(seggiolino)).toBe('Esempio per un pezzo: 5 giorni = 40 €, 10 giorni = 60 € (massimo).');
    expect(esempioPrezzo(catene)).toBe('Qualunque durata = 25 € a pezzo.');
    expect(esempioPrezzo({ prezzo: '' })).toBe('');
  });

  test('ordine: prima quelli sul sito, poi per nome', () => {
    const elenco = [{ nome: 'B', sulSito: false }, { nome: 'Z', sulSito: true }, { nome: 'A', sulSito: true }];
    expect(ordinaOptional(elenco).map((o) => o.nome)).toEqual(['A', 'Z', 'B']);
  });
});
