import { danniConsegna, danniRientro, elencoFoto } from './danni';

test('danni alla consegna: vuoto, "Nessuno" o testo libero', () => {
  expect(danniConsegna({})).toEqual([]);
  expect(danniConsegna({ danni: 'Nessuno' })).toEqual([]);
  expect(danniConsegna({ danni: '  ' })).toEqual([]);
  expect(danniConsegna({ danni: 'Graffio portiera destra' })).toEqual([
    { numero: 1, titolo: 'Graffio portiera destra', dettaglio: 'Già presente alla consegna', nuovo: false },
  ]);
});

test('danni al rientro: quelli della consegna e poi il nuovo, numerati di seguito', () => {
  const voci = danniRientro({ schedaVeicolo: { danni: 'Graffio' }, descrizioneDanno: 'Ammaccatura paraurti', daRiparare: true });
  expect(voci.map((v) => [v.numero, v.titolo, v.nuovo, v.dettaglio])).toEqual([
    [1, 'Graffio', false, 'Già presente alla consegna'],
    [2, 'Ammaccatura paraurti', true, 'Da riparare'],
  ]);
  expect(danniRientro({})).toEqual([]);
});

test('elencoFoto accetta una foto sola o un elenco e scarta il resto', () => {
  expect(elencoFoto('a')).toEqual(['a']);
  expect(elencoFoto(['a', null, 'b'])).toEqual(['a', 'b']);
  expect(elencoFoto(null)).toEqual([]);
});

test('con lo schema i danni hanno punto, tipo e vista; i nuovi seguono i vecchi', () => {
  const p = {
    daRiparare: true,
    segniDanni: [{ id: 'n', vista: 'sx', x: 300, y: 56, tipo: 'Ammaccatura', testo: 'Portiera sinistra' }],
    schedaVeicolo: { segniDanni: [{ id: 'v', vista: 'dx', x: 260, y: 186, tipo: 'Graffio', testo: 'Portiera destra' }] },
  };
  expect(danniConsegna(p.schedaVeicolo)).toEqual([
    { numero: 1, titolo: 'Portiera destra', dettaglio: 'Già presente · Graffio · Lato destro', nuovo: false, vista: 'dx', x: 260, y: 186 },
  ]);
  expect(danniRientro(p).map((v) => [v.numero, v.titolo, v.nuovo, v.dettaglio, v.vista])).toEqual([
    [1, 'Portiera destra', false, 'Già presente · Graffio · Lato destro', 'dx'],
    [2, 'Portiera sinistra', true, 'Ammaccatura · Lato sinistro · Da riparare', 'sx'],
  ]);
});

test('uno schema vuoto (nessun danno) vince sul vecchio testo', () => {
  expect(danniConsegna({ segniDanni: [], danni: 'Graffio' })).toEqual([]);
});
