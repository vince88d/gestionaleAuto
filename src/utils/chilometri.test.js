import {
  normalizzaFormule, trovaFormula, ciSonoScelte, nomeFormula, kmInclusi, chilometriPrenotazione, chilometriDichiarati,
  sceglieChilometri, kmInPiu, kmDichiaratiValidi, modoEffettivo, descrizioneChilometri,
  schemaPerScheda, validaSchema, schemaAFormule, FORMULE_DI_PARTENZA,
} from './chilometri';

const imp = normalizzaFormule({
  formule: [
    { id: 'c', km: null, supplemento: '12,50' },
    { id: 'a', km: 200, supplemento: 0 },
    { id: 'b', km: 400, supplemento: '6' },
  ],
});
const formule = imp.formule;

describe('normalizzaFormule', () => {
  it('senza documento: una sola formula, km illimitati, nessuna scelta', () => {
    const n = normalizzaFormule(undefined);
    expect(n.formule).toEqual(FORMULE_DI_PARTENZA);
    expect(n.modo).toBe('pacchetti');
    expect(n.dichiaratiIllimitati).toBe(true);
    expect(ciSonoScelte(n)).toBe(false);
  });
  it('legge km e supplementi con la virgola, in ordine: meno km prima, illimitati per ultimi', () => {
    expect(formule.map((f) => [f.id, f.km, f.supplemento])).toEqual([['a', 200, 0], ['b', 400, 6], ['c', null, 12.5]]);
    expect(ciSonoScelte(imp)).toBe(true);
  });
  it('non forza piu un supplemento a 0: ogni formula tiene il suo', () => {
    expect(normalizzaFormule({ formule: [{ id: 'x', km: 100, supplemento: 5 }] }).formule[0]).toEqual({ id: 'x', km: 100, supplemento: 5 });
  });
  it('vecchi documenti con «partenza»: il campo si ignora', () => {
    const n = normalizzaFormule({ formule: [{ id: 'x', km: 100, supplemento: 0, partenza: true }, { id: 'y', km: null, supplemento: 9 }] });
    expect(n.formule).toEqual([{ id: 'x', km: 100, supplemento: 0 }, { id: 'y', km: null, supplemento: 9 }]);
  });
  it('scarta le formule limitate senza km validi', () => {
    expect(normalizzaFormule({ formule: [{ id: 'x', km: 'boh' }, { id: 'y', km: null }] }).formule.map((f) => f.id)).toEqual(['y']);
  });
  it('modo dichiarati: scelta anche con una sola formula; «illimitati» permessi di default', () => {
    const d = normalizzaFormule({ modo: 'dichiarati' });
    expect(d.modo).toBe('dichiarati');
    expect(ciSonoScelte(d)).toBe(true);
    expect(d.dichiaratiIllimitati).toBe(true);
    expect(normalizzaFormule({ modo: 'dichiarati', dichiaratiIllimitati: false }).dichiaratiIllimitati).toBe(false);
    expect(normalizzaFormule({ modo: 'boh' }).modo).toBe('pacchetti');
  });
  it('il modo dichiarati vale solo con «Solo richieste»', () => {
    expect(modoEffettivo('dichiarati', 'richiesta')).toBe('dichiarati');
    expect(modoEffettivo('dichiarati', 'pagamento')).toBe('pacchetti');
    expect(modoEffettivo('pacchetti', 'richiesta')).toBe('pacchetti');
  });
});

describe('formule nella prenotazione', () => {
  it('nomi e ricerca per id', () => {
    expect(formule.map(nomeFormula)).toEqual(['200 km al giorno', '400 km al giorno', 'Km illimitati']);
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

describe('km dichiarati dal cliente', () => {
  it('numeri validi: interi da 1 a 99.999 (anche con il punto delle migliaia)', () => {
    expect(kmDichiaratiValidi('1500')).toBe(1500);
    expect(kmDichiaratiValidi('1.500')).toBe(1500);
    expect(kmDichiaratiValidi(0)).toBeNull();
    expect(kmDichiaratiValidi('abc')).toBeNull();
    expect(kmDichiaratiValidi('12,5')).toBeNull();
    expect(kmDichiaratiValidi(100000)).toBeNull();
  });
  it('si salvano come km inclusi, senza importo', () => {
    expect(chilometriDichiarati(1500, 0.25)).toEqual({
      formulaId: 'dichiarati', nome: '1.500 km dichiarati', kmGiorno: null, kmDichiarati: 1500, kmInclusi: 1500, supplementoGiorno: 0, importo: 0, euroKmInPiu: 0.25,
    });
  });
  it('al rientro i km oltre i dichiarati si pagano: 1.620 su 1.500 = 120 km × 0,25 = 30 €', () => {
    expect(kmInPiu(chilometriDichiarati(1500, 0.25), 1620)).toEqual({ km: 120, importo: 30 });
  });
  it('sceglieChilometri: pacchetti, dichiarati, illimitati e errori', () => {
    expect(sceglieChilometri(imp, { sceltaKm: 'b' }, 3, 0.25).chilometri.formulaId).toBe('b');
    const d = normalizzaFormule({ modo: 'dichiarati' });
    expect(sceglieChilometri(d, { kmDichiarati: '1500' }, 3, 0.25).chilometri.kmInclusi).toBe(1500);
    expect(sceglieChilometri(d, { sceltaKm: 'illimitati' }, 3, 0.25).chilometri).toMatchObject({ formulaId: 'illimitati', kmInclusi: null });
    expect(sceglieChilometri(d, { kmDichiarati: '' }, 3, 0.25).errore).toMatch(/Scrivi quanti km/);
    const senza = normalizzaFormule({ modo: 'dichiarati', dichiaratiIllimitati: false });
    expect(sceglieChilometri(senza, { sceltaKm: 'illimitati', kmDichiarati: '' }, 3, 0.25).errore).toMatch(/Scrivi quanti km/);
  });
  it('testo per dettagli e verbali', () => {
    expect(descrizioneChilometri(chilometriPrenotazione(formule[1], 3, 0.25))).toBe('400 km al giorno · 1.200 km inclusi · poi 0,25 € al km');
    expect(descrizioneChilometri(chilometriDichiarati(1500, 0.25))).toBe('1.500 km dichiarati · poi 0,25 € al km');
    expect(descrizioneChilometri(chilometriPrenotazione(formule[2], 3, 0.25))).toBe('Km illimitati');
    expect(descrizioneChilometri(undefined)).toBe('');
  });
});

describe('scheda Chilometri', () => {
  const doc = { modo: 'pacchetti', formule: [{ id: 'a', km: 200, supplemento: 0 }, { id: 'c', km: null, supplemento: 6 }] };
  it('dal salvato alla scheda e ritorno', () => {
    const sc = schemaPerScheda(doc);
    expect(sc.formule[1]).toEqual({ id: 'c', illimitati: true, km: '', supplemento: '6' });
    expect(schemaAFormule(sc)).toEqual({ modo: 'pacchetti', dichiaratiIllimitati: true, formule: doc.formule });
  });
  it('errori: km mancanti, costo sbagliato, pacchetti doppi', () => {
    const sc = schemaPerScheda(doc);
    expect(validaSchema(sc)).toEqual({});
    const conErr = { ...sc, formule: [{ ...sc.formule[0], km: '' }, { ...sc.formule[1], supplemento: '-3' }] };
    expect(validaSchema(conErr)).toEqual({ '0.km': 'Scrivi i km al giorno, es. 200', '1.supplemento': 'Scrivi un importo, es. 6' });
    const doppi = { ...sc, formule: [sc.formule[0], { ...sc.formule[0], id: 'z' }] };
    expect(validaSchema(doppi).doppie).toMatch(/stessi km/);
  });
  it('più km non possono costare meno', () => {
    const sc = schemaPerScheda({ formule: [{ id: 'a', km: 200, supplemento: 8 }, { id: 'b', km: 400, supplemento: 3 }] });
    expect(validaSchema(sc).ordine).toMatch(/più km/);
    expect(validaSchema(sc, { conPrezzi: false })).toEqual({});
  });
  it('modo dichiarati: i pacchetti non si controllano e restano salvati', () => {
    const sc = { ...schemaPerScheda(doc), modo: 'dichiarati' };
    expect(validaSchema({ ...sc, formule: [{ id: 'x', illimitati: false, km: '', supplemento: '' }] })).toEqual({});
    expect(schemaAFormule(sc).modo).toBe('dichiarati');
    expect(schemaAFormule(sc).formule).toHaveLength(2);
  });
});
