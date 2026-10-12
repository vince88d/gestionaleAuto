import {
  nuovoSegno, segniValidi, segniDaTesto, segniDi, testoDanni, senzaDescrizione, vistaDelPunto, SAGOME,
} from './schemaDanni';

test('il punto toccato dice su quale vista si e\' cliccato', () => {
  expect(vistaDelPunto(75, 140)).toBe('alto');
  expect(vistaDelPunto(280, 50)).toBe('sx');
  expect(vistaDelPunto(280, 190)).toBe('dx');
  expect(vistaDelPunto(160, 140)).toBeNull();
  Object.values(SAGOME).forEach(({ parti }) => expect(parti.length).toBeGreaterThan(0));
});

test('un nuovo segno parte come graffio senza descrizione, a coordinate intere', () => {
  const s = nuovoSegno('sx', 300.4, 56.6);
  expect(s).toMatchObject({ vista: 'sx', x: 300, y: 57, tipo: 'Graffio', testo: '' });
  expect(typeof s.id).toBe('string');
});

test('segniValidi scarta il non valido e sistema i campi', () => {
  expect(segniValidi(null)).toEqual([]);
  expect(segniValidi([null, 4, { id: 'a', vista: 'dx', x: '10', y: 5, tipo: 'Rottura', testo: ' lunotto ' }, { vista: 'boh', tipo: 'xx' }])).toEqual([
    { id: 'a', vista: 'dx', x: 10, y: 5, tipo: 'Rottura', testo: 'lunotto' },
    { id: 'd1', vista: null, x: 0, y: 0, tipo: 'Altro', testo: '' },
  ]);
});

test('il vecchio testo libero diventa un segno senza punto; "nessuno" no', () => {
  expect(segniDaTesto('Graffio portiera')).toEqual([{ id: 'testo', vista: null, x: 0, y: 0, tipo: 'Altro', testo: 'Graffio portiera' }]);
  expect(segniDaTesto('Nessuno')).toEqual([]);
  expect(segniDaTesto('  ')).toEqual([]);
  expect(segniDi([], 'Graffio')).toEqual([]);
  expect(segniDi(undefined, 'Graffio')).toHaveLength(1);
});

test('testoDanni riassume per le email, i dettagli e l\'archivio', () => {
  expect(testoDanni([])).toBe('');
  expect(testoDanni([
    { id: 'a', vista: 'sx', x: 1, y: 1, tipo: 'Graffio', testo: 'portiera destra' },
    { id: 'b', vista: 'alto', x: 1, y: 1, tipo: 'Altro', testo: 'paraurti segnato' },
    { id: 'c', vista: 'alto', x: 1, y: 1, tipo: 'Rottura', testo: '' },
  ])).toBe('Graffio - portiera destra; paraurti segnato; Rottura');
});

test('senzaDescrizione conta i punti dove non e\' scritto cos\'e\'', () => {
  expect(senzaDescrizione([{ id: 'a', tipo: 'Graffio', testo: '  ' }, { id: 'b', tipo: 'Graffio', testo: 'x' }])).toHaveLength(1);
});
