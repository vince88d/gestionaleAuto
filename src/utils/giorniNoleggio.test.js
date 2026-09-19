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
