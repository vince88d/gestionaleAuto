import {
  controllaPrenotazione, puoConcludere, puoConsegnare, daConcludereInBlocco, senzaUndefined, pagataSulSito,
  eConsegnata, faseLavoro, promemoria,
} from './regolePrenotazione';

jest.mock('../lib/firestorePrenotazioni', () => ({
  STATI_PRENOTAZIONE_NON_CONFERMATE: ['richiesta-sito', 'scaduta', 'pagamento-fallito'],
}));

const OGGI = '2026-09-23';
const veicoli = [
  { id: 'v1', marca: 'Fiat', modello: 'Panda', targa: 'AA111AA', categoria: 'City Car' },
  { id: 'v2', marca: 'Citroen', modello: 'C3', targa: 'BB222BB', categoria: 'City Car' },
  { id: 'v3', marca: 'Jeep', modello: 'Renegade', targa: 'CC333CC', categoria: 'SUV' },
];
const base = { targa: 'AA111AA', dataInizio: '2026-10-01', dataFine: '2026-10-03', prezzoGiornaliero: '30' };

describe('controllaPrenotazione', () => {
  test('prenotazione nuova valida: prezzo giorni x prezzo al giorno', () => {
    expect(controllaPrenotazione({ dati: base, veicoli, prenotazioni: [], oggi: OGGI })).toEqual({ prezzoTotale: 60 });
  });

  test('date mancanti, invertite o nel passato', () => {
    expect(controllaPrenotazione({ dati: { ...base, dataFine: '' }, veicoli, oggi: OGGI }).errore).toMatch(/Inserisci/);
    expect(controllaPrenotazione({ dati: { ...base, dataFine: '2026-09-30' }, veicoli, oggi: OGGI }).errore).toMatch(/prima di quella di inizio/);
    expect(controllaPrenotazione({ dati: { ...base, dataInizio: '2026-09-18' }, veicoli, oggi: OGGI }).errore).toBe('La data di inizio è già passata.');
  });

  test('una prenotazione gia\' iniziata si puo\' modificare senza cambiare l\'inizio', () => {
    const originale = { id: 'p1', ...base, dataInizio: '2026-09-20', status: 'attiva' };
    const r = controllaPrenotazione({ dati: { ...originale, dataFine: '2026-09-25' }, originale, veicoli, prenotazioni: [originale], oggi: OGGI });
    expect(r.errore).toBeUndefined();
  });

  test('le annullate e le richieste del sito scadute non bloccano le date', () => {
    const prenotazioni = [
      { id: 'x1', targa: 'AA111AA', status: 'annullata', dataInizio: '2026-10-01', dataFine: '2026-10-05' },
      { id: 'x2', targa: 'AA111AA', status: 'scaduta', dataInizio: '2026-10-02', dataFine: '2026-10-02' },
      { id: 'x3', targa: 'AA111AA', status: 'completata', dataInizio: '2026-10-01', dataFine: '2026-10-01' },
    ];
    expect(controllaPrenotazione({ dati: base, veicoli, prenotazioni, oggi: OGGI }).errore).toBeUndefined();
  });

  test('veicolo gia\' prenotato: errore; modificando se stessa no', () => {
    const esistente = { id: 'p9', targa: 'AA111AA', status: 'attiva', dataInizio: '2026-10-02', dataFine: '2026-10-04' };
    expect(controllaPrenotazione({ dati: base, veicoli, prenotazioni: [esistente], oggi: OGGI }).errore).toMatch(/Fiat Panda \(AA111AA\) non è libero/);
    expect(controllaPrenotazione({ dati: base, originale: esistente, veicoli, prenotazioni: [esistente], oggi: OGGI }).errore).toBeUndefined();
  });

  test('categoria piena per le prenotazioni del sito non assegnate', () => {
    const sito = { id: 's1', origine: 'sito', categoria: 'SUV', targa: '', status: 'attiva', dataInizio: '2026-10-01', dataFine: '2026-10-02' };
    const r = controllaPrenotazione({ dati: { ...base, targa: 'CC333CC' }, veicoli, prenotazioni: [sito], oggi: OGGI });
    expect(r.errore).toMatch(/categoria SUV è piena/);
  });

  test('pagata sul sito: resta il prezzo pagato anche cambiando le date', () => {
    const originale = { id: 's2', origine: 'sito', paymentIntentId: 'pi_1', targa: 'BB222BB', status: 'attiva',
      dataInizio: '2026-10-10', dataFine: '2026-10-12', totale: 240 };
    const r = controllaPrenotazione({ dati: { ...originale, dataFine: '2026-10-14', prezzoGiornaliero: '' }, originale, veicoli, prenotazioni: [originale], oggi: OGGI });
    expect(r).toEqual({ prezzoTotale: 240 });
    expect(pagataSulSito(originale)).toBe(true);
  });
});

describe('consegnare e concludere', () => {
  const CONSEGNATA = { consegnataIl: '2026-09-15T09:00:00.000Z' };
  const prenotazioni = [
    { id: 'a', status: 'attiva', targa: 'AA111AA', dataFine: '2026-09-22', ...CONSEGNATA },
    { id: 'b', status: 'attiva', targa: 'BB222BB', dataFine: '2026-09-23', ...CONSEGNATA },
    { id: 'c', status: 'attiva', targa: '', origine: 'sito', dataFine: '2026-09-20' },
    { id: 'd', status: 'completata', targa: 'CC333CC', dataFine: '2026-09-10', ...CONSEGNATA },
    { id: 'e', status: 'attiva', targa: 'CC333CC', dataFine: '2026-09-21' }, // mai consegnata
  ];
  test('si conclude solo un noleggio attivo, con veicolo e gia\' consegnato', () => {
    expect(prenotazioni.map(puoConcludere)).toEqual([true, true, false, false, false]);
  });
  test('si consegna solo un noleggio attivo, con veicolo e non ancora consegnato', () => {
    expect(prenotazioni.map(puoConsegnare)).toEqual([false, false, false, false, true]);
  });
  test('in blocco solo quelli consegnati e finiti da ieri o prima', () => {
    expect(daConcludereInBlocco(prenotazioni, OGGI).map((p) => p.id)).toEqual(['a']);
  });
  test('le prenotazioni fatte col vecchio flusso (scheda gia\' compilata) valgono come consegnate', () => {
    expect(eConsegnata({ schedaVeicolo: { kmIniziali: '45000' } })).toBe(true);
    expect(eConsegnata({ schedaVeicolo: {} })).toBe(false);
    expect(eConsegnata({})).toBe(false);
  });
  test('fase di lavoro per i filtri', () => {
    expect(prenotazioni.map((p) => faseLavoro(p, OGGI))).toEqual(
      ['da-concludere', 'in-corso', 'da-consegnare', 'da-concludere', 'da-consegnare']);
  });
});

describe('promemoria sulla riga', () => {
  test('non consegnata: parla del ritiro', () => {
    expect(promemoria({ dataInizio: '2026-09-23', dataFine: '2026-09-30' }, OGGI)).toEqual({ testo: 'Ritiro oggi', livello: 'urgente' });
    expect(promemoria({ dataInizio: '2026-09-24' }, OGGI)).toEqual({ testo: 'Ritiro domani', livello: 'domani' });
    expect(promemoria({ dataInizio: '2026-10-03' }, OGGI)).toEqual({ testo: 'Ritiro tra 10 gg', livello: '' });
    expect(promemoria({ dataInizio: '2026-09-21' }, OGGI).testo).toBe('Ritiro passato da 2 gg');
  });
  test('consegnata: parla del rientro', () => {
    const p = { consegnataIl: 'x', dataInizio: '2026-09-20' };
    expect(promemoria({ ...p, dataFine: '2026-09-25' }, OGGI)).toEqual({ testo: 'Rientro tra 2 gg', livello: 'prossima' });
    expect(promemoria({ ...p, dataFine: '2026-09-22' }, OGGI)).toEqual({ testo: 'Rientro scaduto da 1 gg', livello: 'urgente' });
  });
});

describe('modificare una prenotazione gia\' consegnata', () => {
  test('non si puo\' cambiare il veicolo', () => {
    const originale = { id: 'p1', ...base, status: 'attiva', consegnataIl: 'x' };
    const r = controllaPrenotazione({ dati: { ...originale, targa: 'BB222BB' }, originale, veicoli, prenotazioni: [originale], oggi: OGGI });
    expect(r.errore).toMatch(/già stato consegnato/);
  });
});

describe('senzaUndefined', () => {
  test('toglie i campi undefined anche annidati', () => {
    expect(senzaUndefined({ a: 1, b: undefined, c: { d: undefined, e: [1, { f: undefined }] } }))
      .toEqual({ a: 1, c: { e: [1, {}] } });
  });
});

describe('scelta del veicolo nel form', () => {
  // Con import dinamico per non toccare l'elenco in cima al file.
  const { statoVeicoloNelPeriodo, giorniOccupati } = require('./regolePrenotazione');
  const panda = veicoli[0];
  const periodo = { inizio: '2026-10-01', fine: '2026-10-03', veicoli, holds: [] };

  test('annullate, pagamenti falliti o scaduti e concluse non occupano il veicolo', () => {
    const prenotazioni = ['annullata', 'scaduta', 'pagamento-fallito', 'richiesta-sito', 'completata'].map((status, i) => (
      { id: `x${i}`, targa: 'AA111AA', status, dataInizio: '2026-10-01', dataFine: '2026-10-05' }));
    expect(statoVeicoloNelPeriodo({ ...periodo, veicolo: panda, prenotazioni })).toBe('libero');
    expect(giorniOccupati({ targa: 'AA111AA', prenotazioni })).toEqual([]);
  });

  test('una prenotazione attiva sulla targa la occupa; non se e\' quella in modifica', () => {
    const prenotazioni = [{ id: 'p1', targa: 'AA111AA', status: 'attiva', dataInizio: '2026-10-02', dataFine: '2026-10-04' }];
    expect(statoVeicoloNelPeriodo({ ...periodo, veicolo: panda, prenotazioni })).toBe('occupato');
    expect(statoVeicoloNelPeriodo({ ...periodo, veicolo: panda, prenotazioni, idEscluso: 'p1' })).toBe('libero');
    expect(giorniOccupati({ targa: 'AA111AA', prenotazioni })).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
  });

  test('categoria piena per le prenotazioni del sito non ancora assegnate', () => {
    const prenotazioni = [{ id: 's1', origine: 'sito', categoria: 'SUV', targa: '', status: 'attiva', dataInizio: '2026-10-01', dataFine: '2026-10-02' }];
    expect(statoVeicoloNelPeriodo({ ...periodo, veicolo: veicoli[2], prenotazioni })).toBe('categoria-piena');
  });

  test('senza date non si sa', () => {
    expect(statoVeicoloNelPeriodo({ ...periodo, inizio: '', veicolo: panda, prenotazioni: [] })).toBe('da-verificare');
  });
});

describe('veicolo sospeso', () => {
  const { statoVeicoloNelPeriodo } = require('./regolePrenotazione');
  const veicoliSospeso = [{ ...veicoli[0], sospeso: true }, veicoli[1], veicoli[2]];

  test('non si sceglie per una prenotazione nuova', () => {
    const r = controllaPrenotazione({ dati: base, veicoli: veicoliSospeso, prenotazioni: [], oggi: OGGI });
    expect(r.errore).toMatch(/sospeso dal noleggio/);
  });

  test('non si puo cambiare una prenotazione esistente verso un veicolo sospeso', () => {
    const originale = { id: 'p1', ...base, targa: 'BB222BB', status: 'attiva' };
    const r = controllaPrenotazione({ dati: base, originale, veicoli: veicoliSospeso, prenotazioni: [originale], oggi: OGGI });
    expect(r.errore).toMatch(/sospeso dal noleggio/);
  });

  test('una prenotazione che ha gia la targa sospesa si puo ancora correggere', () => {
    const originale = { id: 'p1', ...base, status: 'attiva' };
    const dati = { ...base, dataFine: '2026-10-04' };
    const r = controllaPrenotazione({ dati, originale, veicoli: veicoliSospeso, prenotazioni: [originale], oggi: OGGI });
    expect(r).toEqual({ prezzoTotale: 90 });
  });

  test('nel form il veicolo sospeso risulta sospeso', () => {
    const periodo = { inizio: '2026-10-01', fine: '2026-10-03', veicoli: veicoliSospeso, holds: [], prenotazioni: [] };
    expect(statoVeicoloNelPeriodo({ ...periodo, veicolo: veicoliSospeso[0] })).toBe('sospeso');
    expect(statoVeicoloNelPeriodo({ ...periodo, inizio: '', veicolo: veicoliSospeso[0] })).toBe('sospeso');
  });
});
