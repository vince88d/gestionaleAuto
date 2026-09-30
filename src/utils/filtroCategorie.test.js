import {
  SENZA_CATEGORIA, categoriaDiFiltro, filtraPerCategorie, chipCategorie, alternaCategoria,
} from './filtroCategorie';

const veicoli = [
  { id: 1, categoria: 'SUV' },
  { id: 2, categoria: 'City Car' },
  { id: 3, categoria: 'SUV' },
  { id: 4, categoria: '' },
  { id: 5 },
  { id: 6, categoria: 'Vecchia' },
];

describe('filtro per categorie', () => {
  test('categoriaDiFiltro: vuota o mancante diventa Senza categoria', () => {
    expect(categoriaDiFiltro({ categoria: ' SUV ' })).toBe('SUV');
    expect(categoriaDiFiltro({ categoria: '  ' })).toBe(SENZA_CATEGORIA);
    expect(categoriaDiFiltro({})).toBe(SENZA_CATEGORIA);
  });

  test('senza selezione mostra tutti', () => {
    expect(filtraPerCategorie(veicoli, [])).toHaveLength(6);
  });

  test('selezione multipla: veicoli di una qualsiasi delle categorie', () => {
    const ids = filtraPerCategorie(veicoli, ['SUV', 'City Car']).map((v) => v.id);
    expect(ids).toEqual([1, 2, 3]);
  });

  test('Senza categoria prende sia vuota sia mancante', () => {
    const ids = filtraPerCategorie(veicoli, [SENZA_CATEGORIA]).map((v) => v.id);
    expect(ids).toEqual([4, 5]);
  });

  test('chip: elenco, poi categorie fuori elenco, poi Senza categoria', () => {
    expect(chipCategorie(veicoli, ['City Car', 'Furgone', 'SUV'])).toEqual([
      { nome: 'City Car', conteggio: 1 },
      { nome: 'Furgone', conteggio: 0 },
      { nome: 'SUV', conteggio: 2 },
      { nome: 'Vecchia', conteggio: 1 },
      { nome: SENZA_CATEGORIA, conteggio: 2 },
    ]);
  });

  test('chip: Senza categoria non compare se tutti ce l\'hanno', () => {
    const nomi = chipCategorie([{ categoria: 'SUV' }], ['SUV']).map((c) => c.nome);
    expect(nomi).toEqual(['SUV']);
  });

  test('alternaCategoria aggiunge e toglie senza mutare', () => {
    const base = ['SUV'];
    expect(alternaCategoria(base, 'City Car')).toEqual(['SUV', 'City Car']);
    expect(alternaCategoria(base, 'SUV')).toEqual([]);
    expect(base).toEqual(['SUV']);
  });
});
