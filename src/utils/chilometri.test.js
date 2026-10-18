import {
  normalizzaFormule, formulaDiPartenza, trovaFormula, ciSonoScelte, nomeFormula, kmInclusi,
  chilometriPrenotazione, kmInPiu, formulePerForm, validaFormule, preparaFormule, FORMULE_DI_PARTENZA,
} from './chilometri';

const formule = normalizzaFormule({
  formule: [
    { id: 'a', km: 200, supplemento: 0, partenza: true },
    { id: 'b', km: 400, supplemento: '6' },
    { id: 'c', km: null, supplemento: '12,50' },
  ],
}).formule;

describe('normalizzaFormule', () => {
  it('senza documento: una sola formula, km illimitati, nessuna scelta', () => {
    expect(normalizzaFormule(undefined).formule).toEqual(FORMULE_DI_PARTENZA);
    expect(ciSonoScelte(normalizzaFormule(undefined).formule)).toBe(false);
  });
  it('legge km, supplementi con la virgola e la formula di partenza', () => {
    expect(formule.map((f) => [f.id, f.km, f.supplemento, f.partenza])).toEqual([
      ['a', 200, 0, true], ['b', 400, 6, false], ['c', null, 12.5, false],
    ]);
    expect(ciSonoScelte(formule)).toBe(true);
  });
  it('una sola di partenza (la prima se manca) e sempre a 0 €', () => {
    const n = normalizzaFormule({ formule: [{ id: 'x', km: 100, supplemento: 5 }, { id: 'y', km: null, supplemento: 9, partenza: true }, { id: 'z', km: 50, partenza: true }] }).formule;
    expect(n.map((f) => [f.id, f.partenza, f.supplemento])).toEqual([['x', false, 5], ['y', true, 0], ['z', false, 0]]);
    expect(normalizzaFormule({ formule: [{ id: 'x', km: 100, supplemento: 5 }] }).formule[0]).toMatchObject({ partenza: true, supplemento: 0 });
  });
  it('scarta le formule limitate senza km validi', () => {
    expect(normalizzaFormule({ formule: [{ id: 'x', km: 'boh' }, { id: 'y', km: null }] }).formule.map((f) => f.id)).toEqual(['y']);
  });
});

describe('formule nella prenotazione', () => {
  it('nomi, partenza e ricerca per id', () => {
    expect(formule.map(nomeFormula)).toEqual(['200 km al giorno', '400 km al giorno', 'Km illimitati']);
    expect(formulaDiPartenza(formule).id).toBe('a');
    expect(trovaFormula(formule, 'c').id).toBe('c');
    expect(trovaFormula(formule, 'sparita').id).toBe('a');
  });
  it('km inclusi e supplemento per i giorni del noleggio', () => {
    expect(kmInclusi(formule[0], 3)).toBe(600);
    expect(kmInclusi(formule[2], 3)).toBeNull();
    expect(chilometriPrenotazione(formule[1], 3, 0.25)).toEqual({
      formulaId: 'b', nome: '400 km al giorno', kmGiorno: 400, kmInclusi: 1200, supplementoGiorno: 6, importo: 18, euroKmInPiu: 0.25,
    });
    expect(chilometriPrenotazione(formule[2], 3, 0.25)).toMatchObject({ kmInclusi: null, importo: 37.5, euroKmInPiu: null });
  });
  it('km in più al rientro: 210 fatti su 200 = 10 km', () => {
    const c = chilometriPrenotazione(formule[0], 1, 0.25);
    expect(kmInPiu(c, 210)).toEqual({ km: 10, importo: 2.5 });
    expect(kmInPiu(c, 150)).toEqual({ km: 0, importo: 0 });
    expect(kmInPiu(chilometriPrenotazione(formule[2], 1, 0.25), 5000)).toEqual({ km: 0, importo: 0 });
    expect(kmInPiu(undefined, 5000)).toEqual({ km: 0, importo: 0 });
    // Prenotazione senza prezzo salvato: si usa quello del listino.
    expect(kmInPiu({ kmInclusi: 100 }, 120, 0.3)).toEqual({ km: 20, importo: 6 });
  });
});

describe('form della scheda Chilometri', () => {
  it('dal salvato al form e ritorno', () => {
    const righe = formulePerForm({ formule });
    expect(righe[2]).toEqual({ id: 'c', illimitati: true, km: '', supplemento: '12,5', partenza: false });
    expect(preparaFormule(righe).formule).toEqual(formule);
  });
  it('errori: km mancanti, supplemento sbagliato, formule doppie', () => {
    expect(validaFormule([{ illimitati: false, km: '', supplemento: '', partenza: true }])).toEqual({ '0.km': 'Scrivi i km al giorno, es. 200' });
    expect(validaFormule([
      { illimitati: false, km: '200', supplemento: '0', partenza: true },
      { illimitati: false, km: '200', supplemento: '-3', partenza: false },
    ])).toEqual({ '1.supplemento': 'Scrivi un importo, es. 6', doppie: 'Due formule hanno gli stessi km: tienine una sola.' });
    expect(validaFormule(formulePerForm({ formule }))).toEqual({});
  });
});
