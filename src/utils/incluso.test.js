import {
  normalizzaIncluso, inclusoPerForm, nuovaVoceIncluso, preparaIncluso, validaIncluso, vociInclusePerSito,
  INCLUSO_DI_PARTENZA, MAX_VOCI_INCLUSO, MAX_TESTO_INCLUSO,
} from './incluso';

describe('normalizzaIncluso', () => {
  test('senza documento: nessuna voce', () => {
    expect(normalizzaIncluso(undefined)).toEqual(INCLUSO_DI_PARTENZA);
    expect(normalizzaIncluso({ voci: 'no' })).toEqual({ voci: [] });
  });
  test('toglie voci vuote, pulisce gli spazi, acceso di partenza', () => {
    expect(normalizzaIncluso({ voci: [{ id: 'a', testo: '  Assicurazione   RCA ' }, { id: 'b', testo: '   ' }, { id: 'c', testo: 'Seconda guida', attiva: false }] }).voci).toEqual([
      { id: 'a', testo: 'Assicurazione RCA', attiva: true },
      { id: 'c', testo: 'Seconda guida', attiva: false },
    ]);
  });
  test('taglia i testi lunghi e limita il numero di voci', () => {
    const lunga = 'x'.repeat(200);
    expect(normalizzaIncluso({ voci: [{ id: 'a', testo: lunga }] }).voci[0].testo).toHaveLength(MAX_TESTO_INCLUSO);
    const tante = Array.from({ length: 30 }, (_, i) => ({ id: `i${i}`, testo: `Voce ${i}` }));
    expect(normalizzaIncluso({ voci: tante }).voci).toHaveLength(MAX_VOCI_INCLUSO);
  });
  test('senza id se ne da uno', () => {
    expect(normalizzaIncluso({ voci: [{ testo: 'Una' }] }).voci[0].id).toBe('v1');
  });
});

describe('form, salvataggio e sito', () => {
  test('il form parte dai dati salvati', () => {
    expect(inclusoPerForm({ voci: [{ id: 'a', testo: 'Una', attiva: true }] }).voci).toHaveLength(1);
  });
  test('nuova voce: vuota e accesa, con id diverso ogni volta', () => {
    const a = nuovaVoceIncluso();
    const b = nuovaVoceIncluso();
    expect(a).toMatchObject({ testo: '', attiva: true });
    expect(a.id).not.toBe(b.id);
  });
  test('si salva senza righe vuote', () => {
    expect(preparaIncluso({ voci: [{ id: 'a', testo: ' Una ', attiva: true }, { id: 'b', testo: '', attiva: true }] }).voci).toEqual([{ id: 'a', testo: 'Una', attiva: true }]);
  });
  test('una riga vuota si segnala', () => {
    expect(validaIncluso({ voci: [{ id: 'a', testo: 'Ok' }, { id: 'b', testo: '  ' }] })).toEqual({ 'voci.1': 'Scrivi la voce oppure toglila.' });
    expect(validaIncluso({ voci: [{ id: 'a', testo: 'Ok' }] })).toEqual({});
    expect(validaIncluso({ voci: [{ id: 'a', testo: 'x'.repeat(81) }] })['voci.0']).toMatch(/80/);
  });
  test('il sito vede solo le voci accese, nell\'ordine scritto', () => {
    expect(vociInclusePerSito({ voci: [{ id: 'a', testo: 'Prima' }, { id: 'b', testo: 'Spenta', attiva: false }, { id: 'c', testo: 'Terza' }] })).toEqual(['Prima', 'Terza']);
    expect(vociInclusePerSito(undefined)).toEqual([]);
  });
});
