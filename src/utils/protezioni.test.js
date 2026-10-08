import {
  leggiEuro, normalizzaProtezione, normalizzaProtezioni, protezioneImpostata, perForm,
  validaProtezione, preparaProtezione, prezzoProtezione, esempioProtezione,
} from './protezioni';

const formOk = () => ({
  base: { danni: '1.200', furto: '1500', cauzione: '500' },
  totale: {
    offerta: true, prezzoGiorno: '12', massimo: '120', danni: '0', furto: '300', cauzione: '200',
    copre: { cristalli: true, gomme: true, sottoscocca: false },
  },
});

describe('leggiEuro', () => {
  test.each([
    ['1200', 1200], ['1.200', 1200], ['1 200', 1200], ['12,50', 12.5], ['1.200,50', 1200.5],
    ['12.5', 12.5], ['0', 0], ['500 €', 500], [80, 80],
  ])('%p -> %p', (testo, atteso) => expect(leggiEuro(testo)).toBe(atteso));
  test('vuoto = non scritto', () => expect(leggiEuro('')).toBeNull());
  test('testo non numerico = NaN', () => {
    expect(leggiEuro('abc')).toBeNaN();
    expect(leggiEuro('-5')).toBeNaN();
  });
});

test('normalizza: importi mancanti restano null, coperture sempre presenti', () => {
  const p = normalizzaProtezione({ base: { danni: 1200 } });
  expect(p.base).toEqual({ danni: 1200, furto: null, cauzione: null });
  expect(p.totale.offerta).toBe(false);
  expect(p.totale.copre).toEqual({ cristalli: false, gomme: false, sottoscocca: false });
});

test('una categoria e\' impostata solo con tutti gli importi della Base (anche 0)', () => {
  expect(protezioneImpostata(undefined)).toBe(false);
  expect(protezioneImpostata(normalizzaProtezione({ base: { danni: 1200, furto: 1500 } }))).toBe(false);
  expect(protezioneImpostata(normalizzaProtezione({ base: { danni: 0, furto: 0, cauzione: 0 } }))).toBe(true);
});

test('documento intero: categorie e testi comuni', () => {
  const d = normalizzaProtezioni({ perCategoria: { SUV: { base: { danni: '1800' } } }, nonCopre: 'Chiavi perse' });
  expect(d.perCategoria.SUV.base.danni).toBe(1800);
  expect(d.nonCopre).toBe('Chiavi perse');
  expect(d.cauzioneTesto).toBe('');
});

describe('validaProtezione', () => {
  test('form corretto: nessun errore', () => expect(validaProtezione(formOk())).toEqual({}));

  test('la Base vuole tutti gli importi', () => {
    const f = formOk();
    f.base.furto = '';
    f.base.cauzione = 'tanti';
    const e = validaProtezione(f);
    expect(e['base.furto']).toMatch(/anche 0/);
    expect(e['base.cauzione']).toBeDefined();
  });

  test('Totale non offerta: i suoi campi non si controllano', () => {
    const f = formOk();
    f.totale = { ...f.totale, offerta: false, prezzoGiorno: '', danni: '' };
    expect(validaProtezione(f)).toEqual({});
  });

  test('Totale: prezzo obbligatorio e tetto non sotto il prezzo di un giorno', () => {
    const f = formOk();
    f.totale.prezzoGiorno = '';
    expect(validaProtezione(f)['totale.prezzoGiorno']).toBeDefined();
    f.totale.prezzoGiorno = '12';
    f.totale.massimo = '10';
    expect(validaProtezione(f)['totale.massimo']).toMatch(/prezzo di un giorno/);
  });

  test('la Totale non puo\' far pagare piu\' della Base', () => {
    const f = formOk();
    f.totale.cauzione = '600';
    expect(validaProtezione(f)['totale.cauzione']).toMatch(/Base/);
  });
});

test('dal form ai dati e ritorno', () => {
  const p = preparaProtezione(formOk());
  expect(p.base).toEqual({ danni: 1200, furto: 1500, cauzione: 500 });
  expect(p.totale).toMatchObject({ offerta: true, prezzoGiorno: 12, massimo: 120, danni: 0 });
  expect(perForm(p).base.danni).toBe('1200');
  expect(perForm(undefined).totale.offerta).toBe(false);
});

test('prezzo della Totale: al giorno, fino al tetto; 0 se non offerta', () => {
  const p = preparaProtezione(formOk());
  expect(prezzoProtezione(p, 3)).toBe(36);
  expect(prezzoProtezione(p, 15)).toBe(120);
  expect(prezzoProtezione({ ...p, totale: { ...p.totale, offerta: false } }, 3)).toBe(0);
});

test('esempio per il form', () => {
  expect(esempioProtezione(formOk())).toBe(
    'Esempio per 3 giorni: Base inclusa, Totale +36 €. Con la Totale, in caso di danno il cliente paga al massimo 0 €.',
  );
  const f = formOk();
  f.totale.offerta = false;
  expect(esempioProtezione(f)).toBe('');
});
