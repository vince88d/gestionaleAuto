import {
  ETICHETTE, CONSIGLIATE, normalizzaFoto, ordinaFoto, consigliateMancanti, pocheFoto, testoOrari, nomeFoto, didascaliaPdf,
} from './fotoVerbale';

const t = (g, h, m) => new Date(2026, 9, g, h, m).getTime();
const foto = (campi) => ({ id: 'x', url: 'u', ...campi });

test('etichette e foto consigliate', () => {
  expect(ETICHETTE).toHaveLength(8);
  expect(CONSIGLIATE.every(([e]) => ETICHETTE.includes(e))).toBe(true);
});

test('documento Firestore -> foto con date in millisecondi e etichetta valida', () => {
  const f = normalizzaFoto('a1', {
    url: 'https://x', path: 'p', fase: 'consegna', etichetta: 'Interni',
    scattataIl: { toMillis: () => 100 }, caricataIl: { toMillis: () => 200 },
  });
  expect(f).toEqual({ id: 'a1', url: 'https://x', path: 'p', fase: 'consegna', etichetta: 'Interni', scattataIl: 100, caricataIl: 200 });
  expect(normalizzaFoto('a2', { etichetta: 'Inventata', scattataIl: null })).toMatchObject({ etichetta: '', scattataIl: null, caricataIl: null });
});

test('ordine di scatto, poi di caricamento', () => {
  const a = foto({ id: 'a', scattataIl: 300, caricataIl: 900 });
  const b = foto({ id: 'b', scattataIl: 100, caricataIl: 900 });
  const c = foto({ id: 'c', scattataIl: null, caricataIl: 200 });
  expect(ordinaFoto([a, b, c]).map((f) => f.id)).toEqual(['b', 'c', 'a']);
});

test('foto consigliate che mancano e poche foto', () => {
  expect(consigliateMancanti([])).toHaveLength(6);
  const presenti = CONSIGLIATE.slice(0, 4).map(([etichetta]) => foto({ etichetta }));
  expect(consigliateMancanti(presenti).map(([, breve]) => breve)).toEqual(['Quadro', 'Interni']);
  expect(pocheFoto(presenti)).toBe(true);
  expect(pocheFoto([...presenti, foto({})])).toBe(false);
});

test('orari di scatto e di caricamento', () => {
  expect(testoOrari([])).toBe('');
  expect(testoOrari([foto({ scattataIl: t(12, 9, 2), caricataIl: t(12, 9, 21) }), foto({ scattataIl: t(12, 9, 6), caricataIl: t(12, 9, 21) })]))
    .toBe('Scattate il 12/10 alle 09:02–09:06 · caricate alle 09:21');
  expect(testoOrari([foto({ scattataIl: t(12, 9, 2), caricataIl: t(12, 9, 3) })])).toBe('Scattate il 12/10 alle 09:02 · caricate alle 09:03');
  expect(testoOrari([foto({ scattataIl: t(11, 18, 30), caricataIl: t(12, 9, 21) })])).toBe('Scattate il 11/10 alle 18:30 · caricate il 12/10 alle 09:21');
  expect(testoOrari([foto({ scattataIl: null, caricataIl: t(12, 9, 21) })])).toBe('Caricate alle 09:21');
});

test('nome e didascalia per il PDF', () => {
  expect(nomeFoto(foto({ etichetta: 'Interni' }), 3)).toBe('Interni');
  expect(nomeFoto(foto({ etichetta: '' }), 3)).toBe('Foto 4');
  expect(didascaliaPdf(foto({ scattataIl: t(12, 9, 2), caricataIl: t(12, 9, 21) }))).toBe('scattata 12/10 09:02 · caricata 12/10 09:21');
  expect(didascaliaPdf(foto({ scattataIl: null, caricataIl: t(12, 9, 21) }))).toBe('caricata 12/10 09:21');
  expect(didascaliaPdf(foto({}))).toBe('');
});
