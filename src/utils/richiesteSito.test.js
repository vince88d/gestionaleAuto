import { richiesteDaGestire, tempoRimasto, sceltaRichiesta, leggiPrezzo } from './richiesteSito';

const ORA = Date.parse('2026-10-17T12:00:00Z');
const ts = (ms) => ({ toMillis: () => ms });

describe('richiesteDaGestire', () => {
  it('prende le richieste in attesa e le scadute con il ritiro ancora da venire, in ordine di scadenza', () => {
    const elenco = [
      { id: 'pagata', origine: 'sito', status: 'attiva', paymentIntentId: 'pi' },
      { id: 'tardi', richiestaSenzaPagamento: true, status: 'richiesta-sito', scadeIl: ts(ORA + 20 * 3600e3), dataInizio: '2026-10-25' },
      { id: 'presto', richiestaSenzaPagamento: true, status: 'richiesta-sito', scadeIl: ts(ORA + 2 * 3600e3), dataInizio: '2026-10-25' },
      { id: 'scaduta', richiestaSenzaPagamento: true, status: 'scaduta', scadeIl: ts(ORA - 3600e3), dataInizio: '2026-10-20' },
      { id: 'vecchia', richiestaSenzaPagamento: true, status: 'scaduta', dataInizio: '2026-10-01' },
      { id: 'confermata', richiestaSenzaPagamento: true, status: 'attiva' },
      { id: 'nel-cestino', richiestaSenzaPagamento: true, status: 'richiesta-sito', eliminato: true },
    ];
    const r = richiesteDaGestire(elenco, ORA, '2026-10-17');
    expect(r.map((x) => x.prenotazione.id)).toEqual(['presto', 'tardi', 'scaduta']);
    expect(r[2].scaduta).toBe(true);
  });
});

describe('tempoRimasto', () => {
  it('dice quanto manca, urgente sotto le 3 ore', () => {
    expect(tempoRimasto(ORA + 21 * 3600e3 + 5, ORA)).toEqual({ testo: 'Scade tra 21 ore', urgente: false });
    expect(tempoRimasto(ORA + 2 * 3600e3, ORA)).toEqual({ testo: 'Scade tra 2 ore', urgente: true });
    expect(tempoRimasto(ORA + 40 * 60e3, ORA)).toEqual({ testo: 'Scade tra 40 minuti', urgente: true });
    expect(tempoRimasto(ORA - 1, ORA).testo).toBe('Scaduta');
  });
});

describe('sceltaRichiesta', () => {
  it('protezione ed extra senza prezzi', () => {
    expect(sceltaRichiesta({ protezione: { tipo: 'totale', prezzo: 72 }, optional: [{ nome: 'Seggiolino', quantita: 2, totale: 48 }, { nome: 'Catene', quantita: 0 }] }))
      .toBe('Protezione totale · Seggiolino × 2');
    expect(sceltaRichiesta({})).toBe('');
  });
});

describe('leggiPrezzo', () => {
  it('accetta numeri con la virgola o il punto, rifiuta il resto', () => {
    expect(leggiPrezzo('135')).toBe(135);
    expect(leggiPrezzo('99,50')).toBe(99.5);
    expect(leggiPrezzo('1.200')).toBe(1200);
    expect(leggiPrezzo('99.5')).toBe(99.5);
    expect(leggiPrezzo('135 €')).toBe(135);
    expect(leggiPrezzo('1.200,50')).toBe(1200.5);
    expect(leggiPrezzo('0')).toBe(0);
    expect(leggiPrezzo('')).toBeNull();
    expect(leggiPrezzo('-3')).toBeNull();
    expect(leggiPrezzo('abc')).toBeNull();
  });
});
