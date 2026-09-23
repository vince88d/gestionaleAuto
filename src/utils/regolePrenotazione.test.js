import { controllaPrenotazione, puoConcludere, daConcludereInBlocco, senzaUndefined, pagataSulSito } from './regolePrenotazione';

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

describe('concludere', () => {
  const prenotazioni = [
    { id: 'a', status: 'attiva', targa: 'AA111AA', dataFine: '2026-09-22' },
    { id: 'b', status: 'attiva', targa: 'BB222BB', dataFine: '2026-09-23' },
    { id: 'c', status: 'attiva', targa: '', origine: 'sito', dataFine: '2026-09-20' },
    { id: 'd', status: 'completata', targa: 'CC333CC', dataFine: '2026-09-10' },
  ];
  test('solo noleggi attivi con veicolo assegnato', () => {
    expect(prenotazioni.map(puoConcludere)).toEqual([true, true, false, false]);
  });
  test('in blocco solo quelli finiti da ieri o prima', () => {
    expect(daConcludereInBlocco(prenotazioni, OGGI).map((p) => p.id)).toEqual(['a']);
  });
});

describe('senzaUndefined', () => {
  test('toglie i campi undefined anche annidati', () => {
    expect(senzaUndefined({ a: 1, b: undefined, c: { d: undefined, e: [1, { f: undefined }] } }))
      .toEqual({ a: 1, c: { e: [1, {}] } });
  });
});
