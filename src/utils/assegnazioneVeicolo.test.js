import { daAssegnare, veicoliLiberiPerPrenotazione } from './assegnazioneVeicolo';

// Evita di caricare Firebase: qui serve solo l'elenco degli stati non confermati.
jest.mock('../lib/firestorePrenotazioni', () => ({
  STATI_PRENOTAZIONE_NON_CONFERMATE: ['richiesta-sito', 'scaduta', 'pagamento-fallito'],
}));

const veicoli = [
  { id: 'v1', targa: 'AA111AA', modello: 'Panda', categoria: 'City Car' },
  { id: 'v2', targa: 'BB222BB', modello: 'Twingo', categoria: 'City Car' },
  { id: 'v3', targa: 'CC333CC', modello: 'Qashqai', categoria: 'SUV' },
  { id: 'v4', targa: '', modello: 'Senza targa', categoria: 'City Car' },
];

const richiesta = {
  id: 'p-sito', origine: 'sito', status: 'attiva', categoria: 'City Car',
  dataInizio: '2026-10-10', dataFine: '2026-10-15', targa: '',
};

describe('daAssegnare', () => {
  test('vero solo per prenotazioni del sito pagate e senza targa', () => {
    expect(daAssegnare(richiesta)).toBe(true);
    expect(daAssegnare({ ...richiesta, targa: 'AA111AA' })).toBe(false);
    expect(daAssegnare({ ...richiesta, status: 'richiesta-sito' })).toBe(false);
    expect(daAssegnare({ ...richiesta, status: 'annullata' })).toBe(false);
    expect(daAssegnare({ ...richiesta, origine: undefined })).toBe(false);
    expect(daAssegnare(undefined)).toBe(false);
  });
});

describe('veicoliLiberiPerPrenotazione', () => {
  const liberi = (prenotazioni) =>
    veicoliLiberiPerPrenotazione(richiesta, veicoli, prenotazioni).map((v) => v.targa);

  test('propone solo veicoli della stessa categoria e con targa', () => {
    expect(liberi([])).toEqual(['AA111AA', 'BB222BB']);
  });

  test('esclude un veicolo con una prenotazione sovrapposta', () => {
    const p = { id: 'x', targa: 'AA111AA', status: 'attiva', dataInizio: '2026-10-14', dataFine: '2026-10-20' };
    expect(liberi([p])).toEqual(['BB222BB']);
  });

  test('un giorno in comune basta a occupare il veicolo (estremi inclusi)', () => {
    const p = { id: 'x', targa: 'AA111AA', status: 'attiva', dataInizio: '2026-10-15', dataFine: '2026-10-18' };
    expect(liberi([p])).toEqual(['BB222BB']);
  });

  test('un veicolo prenotato subito prima o subito dopo resta libero', () => {
    const prima = { id: 'x', targa: 'AA111AA', status: 'attiva', dataInizio: '2026-10-01', dataFine: '2026-10-09' };
    const dopo = { id: 'y', targa: 'BB222BB', status: 'attiva', dataInizio: '2026-10-16', dataFine: '2026-10-20' };
    expect(liberi([prima, dopo])).toEqual(['AA111AA', 'BB222BB']);
  });

  test('ignora prenotazioni annullate o non confermate', () => {
    const base = { targa: 'AA111AA', dataInizio: '2026-10-10', dataFine: '2026-10-15' };
    expect(liberi([
      { id: 'a', ...base, status: 'annullata' },
      { id: 'b', ...base, status: 'scaduta' },
      { id: 'c', ...base, status: 'richiesta-sito' },
    ])).toEqual(['AA111AA', 'BB222BB']);
  });

  test('una prenotazione conclusa libera il veicolo dal rientro effettivo', () => {
    const conclusa = {
      id: 'x', targa: 'AA111AA', status: 'completata',
      dataInizio: '2026-10-01', dataFine: '2026-10-20', dataRientroEffettiva: '2026-10-05T10:00:00.000Z',
    };
    expect(liberi([conclusa])).toEqual(['AA111AA', 'BB222BB']);
  });

  test('nessun veicolo libero se tutta la categoria è occupata', () => {
    const occupa = (targa) => ({ id: targa, targa, status: 'attiva', dataInizio: '2026-10-11', dataFine: '2026-10-12' });
    expect(liberi([occupa('AA111AA'), occupa('BB222BB')])).toEqual([]);
  });
});

describe('veicoli sospesi', () => {
  test('non si propongono per assegnare una prenotazione del sito', () => {
    const conSospeso = veicoli.map((v) => (v.id === 'v1' ? { ...v, sospeso: true } : v));
    const liberi = veicoliLiberiPerPrenotazione(richiesta, conSospeso, []);
    expect(liberi.map((v) => v.targa)).toEqual(['BB222BB']);
  });
});
