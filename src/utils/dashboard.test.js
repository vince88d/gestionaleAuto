import { riepilogoDashboard, serieUltimi12Mesi, prezzoPrenotazione, veicoliLiberiNelPeriodo } from './dashboard';

jest.mock('../lib/firestorePrenotazioni', () => ({
  STATI_PRENOTAZIONE_NON_CONFERMATE: ['richiesta-sito', 'scaduta', 'pagamento-fallito'],
}));

const OGGI = '2026-09-23';
const veicoli = [
  { id: 'v1', marca: 'Fiat', modello: 'Ducato', targa: 'AD123XY', categoria: 'Furgone',
    scadenze: { assicurazione: '2027-04-11', bollo: '2026-10-05', revisione: '2026-09-18' },
    danni: [{ descrizione: 'graffio', daRiparare: true }, { descrizione: 'vecchio', daRiparare: false }] },
  { id: 'v2', marca: 'Citroen', modello: 'C3', targa: 'EF456GH', categoria: 'City Car', scadenze: { assicurazione: '2026-10-13' } },
  { id: 'v3', marca: 'Fiat', modello: 'Panda', targa: 'GH789IJ', categoria: 'City Car' },
  { id: 'v4', marca: 'Jeep', modello: 'Renegade', targa: 'KL012MN', categoria: 'SUV' },
];
const prenotazioni = [
  { id: 'p1', targa: 'EF456GH', status: 'attiva', dataInizio: '2026-09-21', dataFine: '2026-09-23', prezzoTotale: 105 },
  { id: 'p2', targa: 'AD123XY', status: 'attiva', dataInizio: '2026-09-23', dataFine: '2026-09-26', prezzoTotale: 340 },
  { id: 'p3', targa: '', origine: 'sito', categoria: 'SUV', status: 'attiva', dataInizio: '2026-09-23', dataFine: '2026-09-25', totale: 240 },
  { id: 'p4', targa: 'GH789IJ', status: 'completata', dataInizio: '2026-08-14', dataFine: '2026-08-18', prezzoTotale: 150, daRiparare: true, descrizioneDanno: 'specchietto' },
  { id: 'p5', targa: 'GH789IJ', status: 'completata', dataInizio: '2025-08-10', dataFine: '2025-08-12', prezzoTotale: 999 },
  { id: 'p6', targa: 'GH789IJ', status: 'attiva', dataInizio: '2026-10-02', dataFine: '2026-10-04', prezzoTotale: 90 },
];

describe('riepilogoDashboard', () => {
  const r = riepilogoDashboard({ veicoli, prenotazioni, holds: [], oggi: OGGI });

  test('flotta e liberi oggi (anche la categoria piena per il sito conta)', () => {
    expect(r.flotta).toBe(4);
    // Ducato e C3 occupati per targa, la Renegade (unico SUV) e' presa dalla richiesta del sito non assegnata.
    expect(r.liberiOggi.map((v) => v.id)).toEqual(['v3']);
  });

  test('in corso, in arrivo, ritiri e riconsegne di oggi', () => {
    expect(r.inCorso.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(r.inArrivo.map((p) => p.id)).toEqual(['p6']);
    expect(r.ritiriOggi.map((p) => p.id)).toEqual(['p2', 'p3']);
    expect(r.riconsegneOggi.map((p) => p.id)).toEqual(['p1']);
  });

  test('incasso del mese conta anche le richieste del sito (campo totale)', () => {
    expect(r.incassoMese).toBe(105 + 340 + 240);
  });

  test('da assegnare, danni e scadenze in ordine di urgenza', () => {
    expect(r.daAssegnare.map((p) => p.id)).toEqual(['p3']);
    expect(r.danniDaRiparare.map((d) => [d.veicolo.id, d.descrizione, d.origine])).toEqual([
      ['v1', 'graffio', 'veicolo'],
      ['v3', 'specchietto', 'riconsegna'],
    ]);
    expect(r.scadenze.map((s) => [s.nome, s.giorni])).toEqual([
      ['Revisione', -5], ['Bollo', 12], ['Assicurazione', 20],
    ]);
  });
});

describe('serieUltimi12Mesi', () => {
  test('12 mesi fino a quello in corso, senza mescolare gli anni', () => {
    const serie = serieUltimi12Mesi(prenotazioni, OGGI);
    expect(serie).toHaveLength(12);
    expect(serie[0].chiave).toBe('2025-10');
    expect(serie[11].chiave).toBe('2026-09');
    expect(serie.find((m) => m.chiave === '2026-08')).toMatchObject({ prenotazioni: 1, incasso: 150 });
    expect(serie[11]).toMatchObject({ prenotazioni: 3, incasso: 685 });
    // Il noleggio dell'agosto 2025 e' fuori dagli ultimi 12 mesi.
    expect(serie.reduce((t, m) => t + m.incasso, 0)).toBe(150 + 685);
  });
});

describe('prezzoPrenotazione e veicoliLiberiNelPeriodo', () => {
  test('prezzo da prezzoTotale o, per il sito, da totale', () => {
    expect(prezzoPrenotazione({ prezzoTotale: '120.5' })).toBe(120.5);
    expect(prezzoPrenotazione({ prezzoTotale: '', totale: 80 })).toBe(80);
    expect(prezzoPrenotazione({})).toBe(0);
  });

  test('ricerca per periodo: esclude chi ha prenotazioni sovrapposte', () => {
    const liberi = veicoliLiberiNelPeriodo(veicoli, '2026-10-01', '2026-10-03', prenotazioni, []);
    expect(liberi.map((v) => v.id)).toEqual(['v1', 'v2', 'v4']);
  });
});

describe('auto sospese nella dashboard', () => {
  const conSospeso = veicoli.map((v) => (v.id === 'v3' ? { ...v, sospeso: true } : v));
  const r = riepilogoDashboard({ veicoli: conSospeso, prenotazioni, holds: [], oggi: OGGI });

  test('le prenotazioni ancora da onorare su un\'auto sospesa vanno riassegnate', () => {
    expect(r.suVeicoloSospeso.map((p) => p.id)).toEqual(['p6']);
  });

  test('un\'auto sospesa non e mai libera oggi', () => {
    expect(r.liberiOggi.map((v) => v.id)).toEqual([]);
  });

  test('senza sospesi non c\'e niente da riassegnare', () => {
    expect(riepilogoDashboard({ veicoli, prenotazioni, holds: [], oggi: OGGI }).suVeicoloSospeso).toEqual([]);
  });
});
