import { statoSelezione, alterna, alternaTutti, soloPresenti } from './selezione';

describe('selezione multipla', () => {
  const chiavi = ['a', 'b', 'c'];
  test('stato: nessuno, alcuni, tutti', () => {
    expect(statoSelezione(new Set(), chiavi)).toBe('nessuno');
    expect(statoSelezione(new Set(['a']), chiavi)).toBe('alcuni');
    expect(statoSelezione(new Set(chiavi), chiavi)).toBe('tutti');
    expect(statoSelezione(new Set(['x']), chiavi)).toBe('nessuno');
    expect(statoSelezione(new Set(['a']), [])).toBe('nessuno');
  });
  test('alterna una chiave senza modificare l\'insieme di partenza', () => {
    const s = new Set(['a']);
    expect([...alterna(s, 'b')]).toEqual(['a', 'b']);
    expect([...alterna(s, 'a')]).toEqual([]);
    expect([...s]).toEqual(['a']);
  });
  test('seleziona tutto: sceglie tutte, e se erano tutte le toglie', () => {
    expect(statoSelezione(alternaTutti(new Set(['a']), chiavi), chiavi)).toBe('tutti');
    expect(statoSelezione(alternaTutti(new Set(chiavi), chiavi), chiavi)).toBe('nessuno');
  });
  test('seleziona tutto non tocca le chiavi di altri gruppi', () => {
    const s = alternaTutti(new Set(['z']), chiavi);
    expect(s.has('z')).toBe(true);
    expect(alternaTutti(s, chiavi).has('z')).toBe(true);
  });
  test('solo presenti: scarta le chiavi sparite', () => {
    expect([...soloPresenti(new Set(['a', 'x']), chiavi)]).toEqual(['a']);
  });
});
