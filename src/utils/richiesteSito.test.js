import {
  richiesteDaGestire, tempoRimasto, sceltaRichiesta, leggiPrezzo, ORE_PREVENTIVO, ORE_PREVENTIVO_DEFAULT, scadenzaPreventivo, preventivoInviato,
  contaRichieste, filtraRichieste, testoNumeroMenu, titoloConRichieste, richiesteNuove, avvisoNuoveRichieste,
} from './richiesteSito';

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

describe('preventivo con link', () => {
  test('validita: 12, 24 o 48 ore, 24 di partenza', () => {
    expect(ORE_PREVENTIVO).toEqual([12, 24, 48]);
    expect(ORE_PREVENTIVO_DEFAULT).toBe(24);
  });
  test('scadenza scritta con giorno e ora italiani', () => {
    const t = scadenzaPreventivo(24, Date.UTC(2026, 9, 28, 13, 30)); // 28/10 14:30 a Roma
    expect(t).toMatch(/29 ottobre alle 14:30/);
  });
  test('preventivo inviato: importo solo se la richiesta nasce da un preventivo', () => {
    expect(preventivoInviato({ daPreventivo: true, preventivo: { totale: 285 } })).toBe(285);
    expect(preventivoInviato({ preventivo: { totale: 285 } })).toBeNull();
    expect(preventivoInviato({})).toBeNull();
  });
});

describe('tante richieste: conta e filtra', () => {
  const ora = 1_000_000_000_000;
  const r = (id, cliente, telefono, oreRimaste, scaduta = false) => ({
    prenotazione: { id, cliente, telefono }, scadeMs: ora + oreRimaste * 3600e3, scaduta,
  });
  const elenco = [r('a', 'Anna Verdi', '333 111 2222', 1), r('b', 'Marco Neri', '333 999 0000', 10), r('c', 'Luca Bianchi', '320 555 1234', -1, true)];

  test('conta urgenti (entro 3 ore, non scadute) e scadute', () => {
    expect(contaRichieste(elenco, ora)).toEqual({ urgenti: 1, scadute: 1 });
  });
  test('filtra per urgenza', () => {
    expect(filtraRichieste(elenco, 'urgenti', '', ora).map((x) => x.prenotazione.id)).toEqual(['a']);
    expect(filtraRichieste(elenco, 'scadute', '', ora).map((x) => x.prenotazione.id)).toEqual(['c']);
    expect(filtraRichieste(elenco, 'tutte', '', ora)).toHaveLength(3);
  });
  test('cerca per nome o per telefono, anche con spazi', () => {
    expect(filtraRichieste(elenco, 'tutte', 'neri', ora).map((x) => x.prenotazione.id)).toEqual(['b']);
    expect(filtraRichieste(elenco, 'tutte', '555 12', ora).map((x) => x.prenotazione.id)).toEqual(['c']);
    expect(filtraRichieste(elenco, 'tutte', 'zzz', ora)).toHaveLength(0);
  });
  test('ricerca e filtro insieme', () => {
    expect(filtraRichieste(elenco, 'urgenti', 'neri', ora)).toHaveLength(0);
  });
});

describe('segnale delle richieste', () => {
  test('numero nel menu: «99+» oltre 99', () => {
    expect(testoNumeroMenu(4)).toBe('4');
    expect(testoNumeroMenu(99)).toBe('99');
    expect(testoNumeroMenu(100)).toBe('99+');
  });
  test('titolo della scheda con il numero solo se ci sono richieste', () => {
    expect(titoloConRichieste('Gestionale Auto', 0)).toBe('Gestionale Auto');
    expect(titoloConRichieste('Gestionale Auto', 3)).toBe('(3) Gestionale Auto');
  });
  test('richieste nuove e testo dell\'avviso', () => {
    const r = (id, cliente) => ({ prenotazione: { id, cliente, categoria: 'Camper', dataInizio: '2026-10-31' } });
    const elenco = [r('a', 'Anna'), r('b', 'Giulia'), r('c', 'Paolo')];
    const nuove = richiesteNuove(elenco, new Set(['a', 'b']));
    expect(nuove.map((x) => x.prenotazione.id)).toEqual(['c']);
    expect(avvisoNuoveRichieste(nuove)).toEqual({ titolo: 'Nuova richiesta dal sito', dettaglio: 'Paolo · Camper · dal 31/10' });
    expect(avvisoNuoveRichieste(elenco).titolo).toBe('3 nuove richieste dal sito');
    expect(avvisoNuoveRichieste([])).toBeNull();
  });
});
