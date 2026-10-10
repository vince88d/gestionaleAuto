import { calcolaGiorniNoleggio } from './giorniNoleggio';

describe('calcolaGiorniNoleggio (giorno = 24 ore dal ritiro)', () => {
  test.each([
    ['2026-10-10', '2026-10-11', 1],
    ['2026-10-10', '2026-10-12', 2], // non 3: il giorno di riconsegna non si paga a parte
    ['2026-10-10', '2026-10-17', 7], // una settimana
    ['2026-10-10', '2026-10-10', 1], // stesso giorno: minimo 1 giorno
  ])('%s -> %s = %i giorni', (inizio, fine, atteso) => {
    expect(calcolaGiorniNoleggio(inizio, fine)).toBe(atteso);
  });

  test('attraversa il cambio ora legale senza perdere o aggiungere giorni', () => {
    // in Italia l'ora solare torna il 2026-10-25
    expect(calcolaGiorniNoleggio('2026-10-24', '2026-10-27')).toBe(3);
    expect(calcolaGiorniNoleggio('2026-03-28', '2026-03-31')).toBe(3);
  });

  test('date mancanti, non valide o invertite valgono 0 giorni (form ancora vuoto)', () => {
    expect(calcolaGiorniNoleggio('', '')).toBe(0);
    expect(calcolaGiorniNoleggio('2026-10-10', '')).toBe(0);
    expect(calcolaGiorniNoleggio('2026-10-12', '2026-10-10')).toBe(0);
  });
});

// Stessi casi del sito (formiarent src/lib/orari.test.ts e functions/test/orari.test.mjs).
describe('calcolaGiorniNoleggio con l\'ora e la tolleranza', () => {
  test.each([
    ['09:00', '09:00', 29, 3],
    ['09:00', '09:29', 29, 3], // dentro la tolleranza
    ['09:00', '09:30', 29, 4], // oltre: un giorno in piu'
    ['09:00', '11:00', 29, 4],
    ['15:00', '09:00', 29, 3], // rientro prima dell'ora del ritiro
    ['09:00', '09:01', 0, 4], // senza tolleranza
  ])('12/10 alle %s -> 15/10 alle %s, tolleranza %i = %i giorni', (oi, of, t, atteso) => {
    expect(calcolaGiorniNoleggio('2026-10-12', '2026-10-15', oi, of, t)).toBe(atteso);
  });

  test('stesso giorno: almeno 1 giorno', () => {
    expect(calcolaGiorniNoleggio('2026-10-12', '2026-10-12', '09:00', '18:00', 29)).toBe(1);
  });

  test('con una sola ora (o nessuna) conta la data', () => {
    expect(calcolaGiorniNoleggio('2026-10-12', '2026-10-15', '09:00', '', 29)).toBe(3);
    expect(calcolaGiorniNoleggio('2026-10-12T00:00:00', '2026-10-15T00:00:00')).toBe(3);
  });

  test('il cambio dell\'ora legale non cambia il conto', () => {
    expect(calcolaGiorniNoleggio('2026-10-24', '2026-10-27', '09:00', '09:20', 29)).toBe(3);
  });
});
