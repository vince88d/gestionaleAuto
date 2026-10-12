import { haScelteDaFare, testoScelte } from './riepilogoScelte';

const protezione = { base: { danni: 1500, furto: 1500, cauzione: 1500 }, totale: { offerta: true, prezzoGiorno: 12, danni: 0, furto: 0, cauzione: 300 } };

test('ci sono scelte da fare solo con un\'auto e qualcosa da scegliere', () => {
  expect(haScelteDaFare({ categoria: '', protezione, numeroExtra: 3 })).toBe(false);
  expect(haScelteDaFare({ categoria: 'Furgone', protezione, numeroExtra: 0 })).toBe(true); // c'e' la Totale
  expect(haScelteDaFare({ categoria: 'Furgone', protezione: undefined, numeroExtra: 2 })).toBe(true);
  expect(haScelteDaFare({ categoria: 'Furgone', protezione: undefined, numeroExtra: 0 })).toBe(false);
});

test('testo delle scelte: Base inclusa e nessun extra, oppure Totale ed extra', () => {
  expect(testoScelte({ protezione, sceltaProtezione: 'base', preventivo: { protezione: { tipo: 'base' }, optional: [] } }))
    .toEqual({ protezione: 'Base · inclusa', extra: 'nessuno' });
  expect(testoScelte({
    protezione, sceltaProtezione: 'totale',
    preventivo: { protezione: { tipo: 'totale', prezzo: 24 }, optional: [{ nome: 'Seggiolino', quantita: 1 }, { nome: 'Navigatore', quantita: 2 }] },
  })).toEqual({ protezione: 'Totale · 24 €', extra: 'Seggiolino × 1, Navigatore × 2' });
  expect(testoScelte({ protezione: undefined, sceltaProtezione: 'base', preventivo: null })).toEqual({ protezione: 'non impostata', extra: 'nessuno' });
});
