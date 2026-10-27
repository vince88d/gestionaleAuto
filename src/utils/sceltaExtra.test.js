import { pezziOccupati, pezziLiberi, preventivoPrenotazione, scelteIniziali, totaleSceglibile } from './sceltaExtra';
import { normalizzaProtezione } from './protezioni';
import { normalizzaOptional } from './optional';

const protezione = normalizzaProtezione({
  base: { danni: 1200, furto: 1500, cauzione: 500 },
  totale: { offerta: true, prezzoGiorno: 12, massimo: 120, danni: 0, furto: 300, cauzione: 200 },
});
const seggiolino = normalizzaOptional({ id: 's', nome: 'Seggiolino', modo: 'giorno', prezzo: 8, massimo: 60, maxPerNoleggio: 2, pezzi: 3 });
const catene = normalizzaOptional({ id: 'c', nome: 'Catene', modo: 'noleggio', prezzo: 25, maxPerNoleggio: 1, pezzi: '' });
const catalogo = [seggiolino, catene];

describe('preventivoPrenotazione', () => {
  // Stessi numeri del sito (functions/test/extra.test.mjs).
  test('Base inclusa + seggiolino: 75 + 24 = 99', () => {
    const r = preventivoPrenotazione({ prezzoGiornaliero: '25', giorni: 3, protezione, catalogo, sceltaOptional: { s: 1 } });
    expect(r).toMatchObject({ totaleNoleggio: 75, prezzoTotale: 99, cauzione: 500 });
    expect(r.protezione).toMatchObject({ tipo: 'base', prezzo: 0, danni: 1200, furto: 1500 });
  });

  test('Totale: 75 + 36 = 111, cauzione ridotta', () => {
    const r = preventivoPrenotazione({ prezzoGiornaliero: 25, giorni: 3, protezione, sceltaProtezione: 'totale', catalogo });
    expect(r).toMatchObject({ prezzoTotale: 111, cauzione: 200 });
  });

  test('categoria senza protezione: si prenota, senza protezione ne\' cauzione', () => {
    const r = preventivoPrenotazione({ prezzoGiornaliero: 25, giorni: 3, protezione: undefined, catalogo });
    expect(r).toMatchObject({ prezzoTotale: 75, protezione: null, cauzione: null });
  });

  test('errori: Totale non offerta, troppi pezzi, esauriti, extra sconosciuto', () => {
    const senzaTotale = normalizzaProtezione({ base: protezione.base });
    expect(preventivoPrenotazione({ giorni: 1, protezione: senzaTotale, sceltaProtezione: 'totale' }).errore).toMatch(/non è offerta/);
    expect(preventivoPrenotazione({ giorni: 1, catalogo, sceltaOptional: { s: 3 } }).errore).toMatch(/al massimo 2/);
    expect(preventivoPrenotazione({ giorni: 1, catalogo, sceltaOptional: { s: 2 }, occupati: new Map([['s', 2]]) }).errore).toMatch(/ne restano solo 1/);
    expect(preventivoPrenotazione({ giorni: 1, catalogo, sceltaOptional: { x: 1 } }).errore).toMatch(/non è più/);
    expect(preventivoPrenotazione({ giorni: 1, catalogo, sceltaOptional: { s: 1.5 } }).errore).toMatch(/non valida/);
  });

  test('extra tolto dal catalogo ma gia\' salvato: resta con il suo prezzo', () => {
    const r = preventivoPrenotazione({
      giorni: 2, catalogo: [], sceltaOptional: { v: 1 }, optionalSalvati: [{ id: 'v', nome: 'Vecchio', modo: 'noleggio', prezzo: 10, quantita: 1 }],
    });
    expect(r.optional).toEqual([expect.objectContaining({ id: 'v', nome: 'Vecchio', totale: 10 })]);
  });
});

describe('pezzi', () => {
  test('somma prenotazioni e hold non scaduti che si sovrappongono', () => {
    const occupati = pezziOccupati({
      occupanti: [
        { dataInizio: '2026-10-01', dataFine: '2026-10-03', optional: [{ id: 's', quantita: 1 }] },
        { dataInizio: '2026-11-01', dataFine: '2026-11-03', optional: [{ id: 's', quantita: 2 }] }, // altre date
      ],
      holds: [
        { dataInizio: '2026-10-02', dataFine: '2026-10-02', scadeIl: 2000, optional: [{ id: 's', quantita: 1 }] },
        { dataInizio: '2026-10-02', dataFine: '2026-10-02', scadeIl: 500, optional: [{ id: 's', quantita: 5 }] }, // scaduto
      ],
      inizio: '2026-10-02',
      fine: '2026-10-04',
      adesso: 1000,
    });
    expect(occupati.get('s')).toBe(2);
    expect(pezziLiberi(seggiolino, occupati)).toBe(1);
    expect(pezziLiberi(catene, occupati)).toBeNull();
  });
});

test('scelte iniziali da una prenotazione salvata', () => {
  expect(scelteIniziali({ protezione: { tipo: 'totale' }, optional: [{ id: 's', quantita: 2 }] }))
    .toEqual({ sceltaProtezione: 'totale', sceltaOptional: { s: 2 }, sceltaKm: null, kmDichiarati: '' });
  expect(scelteIniziali(null)).toEqual({ sceltaProtezione: 'base', sceltaOptional: {}, sceltaKm: null, kmDichiarati: '' });
  expect(scelteIniziali({ chilometri: { formulaId: 'f2' } }).sceltaKm).toBe('f2');
  expect(scelteIniziali({ chilometri: { formulaId: 'dichiarati', kmDichiarati: 1500 } })).toMatchObject({ sceltaKm: 'dichiarati', kmDichiarati: '1500' });
  expect(totaleSceglibile(protezione)).toBe(true);
});

describe('formule dei km nel preventivo', () => {
  const formuleKm = { modo: 'pacchetti', dichiaratiIllimitati: true, formule: [
    { id: 'base', km: 200, supplemento: 0 },
    { id: 'ill', km: null, supplemento: 12 },
  ] };
  it('prima formula: km inclusi, nessun supplemento', () => {
    const p = preventivoPrenotazione({ prezzoGiornaliero: '40', giorni: 3, formuleKm, euroKmInPiu: 0.25 });
    expect(p.chilometri).toMatchObject({ formulaId: 'base', kmInclusi: 600, importo: 0, euroKmInPiu: 0.25 });
    expect(p.prezzoTotale).toBe(120);
  });
  it('illimitati: supplemento al giorno nel totale', () => {
    const p = preventivoPrenotazione({ prezzoGiornaliero: '40', giorni: 3, formuleKm, sceltaKm: 'ill', euroKmInPiu: 0.25 });
    expect(p.chilometri).toMatchObject({ nome: 'Km illimitati', kmInclusi: null, importo: 36 });
    expect(p.prezzoTotale).toBe(156);
  });
  it('in modifica resta la formula salvata con i suoi prezzi, ricalcolata sui giorni nuovi', () => {
    const salvata = { formulaId: 'vecchia', kmGiorno: 300, supplementoGiorno: 5, euroKmInPiu: 0.2 };
    const p = preventivoPrenotazione({ prezzoGiornaliero: '40', giorni: 2, formuleKm, chilometriSalvati: salvata, euroKmInPiu: 0.25 });
    expect(p.chilometri).toMatchObject({ formulaId: 'vecchia', kmInclusi: 600, importo: 10, euroKmInPiu: 0.2 });
    // Cambiando formula valgono i prezzi di adesso.
    expect(preventivoPrenotazione({ prezzoGiornaliero: '40', giorni: 2, formuleKm, sceltaKm: 'ill', chilometriSalvati: salvata }).chilometri.importo).toBe(24);
  });
  describe('modo km dichiarati', () => {
    const dich = { modo: 'dichiarati', dichiaratiIllimitati: true, formule: formuleKm.formule };
    it('i km scritti dal cliente sono i km inclusi, senza supplemento', () => {
      const p = preventivoPrenotazione({ prezzoGiornaliero: '40', giorni: 3, formuleKm: dich, sceltaKm: 'dichiarati', kmDichiarati: '1500', euroKmInPiu: 0.25 });
      expect(p.chilometri).toMatchObject({ formulaId: 'dichiarati', kmDichiarati: 1500, kmInclusi: 1500, importo: 0, euroKmInPiu: 0.25 });
      expect(p.prezzoTotale).toBe(120);
    });
    it('senza km scritti: errore chiaro; con «Km illimitati» si va avanti', () => {
      expect(preventivoPrenotazione({ prezzoGiornaliero: '40', giorni: 3, formuleKm: dich, kmDichiarati: '' }).errore).toMatch(/Scrivi quanti km/);
      expect(preventivoPrenotazione({ prezzoGiornaliero: '40', giorni: 3, formuleKm: dich, sceltaKm: 'illimitati' }).chilometri).toMatchObject({ kmInclusi: null });
    });
    it('in modifica restano i km dichiarati salvati, anche se il modo e cambiato', () => {
      const salvata = { formulaId: 'dichiarati', kmDichiarati: 1500, euroKmInPiu: 0.2 };
      const p = preventivoPrenotazione({ prezzoGiornaliero: '40', giorni: 3, formuleKm: dich, chilometriSalvati: salvata, euroKmInPiu: 0.25 });
      expect(p.chilometri).toMatchObject({ formulaId: 'dichiarati', kmInclusi: 1500, euroKmInPiu: 0.2 });
      expect(preventivoPrenotazione({ prezzoGiornaliero: '40', giorni: 3, formuleKm, chilometriSalvati: salvata }).chilometri.formulaId).toBe('dichiarati');
      // Se lo staff cambia il numero, vale il nuovo.
      expect(preventivoPrenotazione({ prezzoGiornaliero: '40', giorni: 3, formuleKm: dich, sceltaKm: 'dichiarati', kmDichiarati: '2000', chilometriSalvati: salvata }).chilometri.kmInclusi).toBe(2000);
    });
  });
  it('senza formule (prenotazioni di prima): niente km', () => {
    expect(preventivoPrenotazione({ prezzoGiornaliero: '40', giorni: 2 }).chilometri).toBeNull();
  });
});
