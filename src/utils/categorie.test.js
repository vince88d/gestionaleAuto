import { normalizzaElencoCategorie, puoiEliminareCategoria, contaVeicoliPerCategoria } from './categorie';

describe('normalizzaElencoCategorie', () => {
  it('toglie spazi, vuoti e duplicati, ordina alfabeticamente', () => {
    expect(normalizzaElencoCategorie(['SUV', ' City Car ', 'suv', '', '  ', 'Berlina'])).toEqual([
      'Berlina', 'City Car', 'SUV',
    ]);
  });

  it('dati assenti o di tipo sbagliato', () => {
    expect(normalizzaElencoCategorie(undefined)).toEqual([]);
    expect(normalizzaElencoCategorie(null)).toEqual([]);
    expect(normalizzaElencoCategorie('SUV')).toEqual([]);
  });

  it('tiene la prima grafia incontrata per un duplicato case-insensitive', () => {
    expect(normalizzaElencoCategorie(['City Car', 'CITY CAR'])).toEqual(['City Car']);
  });
});

describe('puoiEliminareCategoria', () => {
  const veicoli = [{ categoria: 'SUV' }, { categoria: 'City Car' }];

  it('true se nessun veicolo usa la categoria', () => {
    expect(puoiEliminareCategoria('Furgone', veicoli)).toBe(true);
  });

  it('false se almeno un veicolo la usa', () => {
    expect(puoiEliminareCategoria('SUV', veicoli)).toBe(false);
  });

  it('true con elenco veicoli vuoto o assente', () => {
    expect(puoiEliminareCategoria('SUV', [])).toBe(true);
    expect(puoiEliminareCategoria('SUV', undefined)).toBe(true);
  });
});

describe('contaVeicoliPerCategoria', () => {
  it('conta i veicoli per categoria, ignora quelli senza categoria', () => {
    const conteggio = contaVeicoliPerCategoria([
      { categoria: 'SUV' }, { categoria: 'SUV' }, { categoria: 'City Car' }, {},
    ]);
    expect(conteggio.get('SUV')).toBe(2);
    expect(conteggio.get('City Car')).toBe(1);
    expect(conteggio.get('Furgone')).toBeUndefined();
  });

  it('elenco vuoto o assente', () => {
    expect(contaVeicoliPerCategoria([]).size).toBe(0);
    expect(contaVeicoliPerCategoria(undefined).size).toBe(0);
  });
});
