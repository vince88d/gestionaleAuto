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
