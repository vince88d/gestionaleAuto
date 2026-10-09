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
    .toEqual({ sceltaProtezione: 'totale', sceltaOptional: { s: 2 } });
  expect(scelteIniziali(null)).toEqual({ sceltaProtezione: 'base', sceltaOptional: {} });
  expect(totaleSceglibile(protezione)).toBe(true);
});
