import { normalizzaCopiaCartacea, TESTO_PRESA_VISIONE, FRASE_VERBALE } from './copiaCartacea';

describe('copia cartacea dei documenti', () => {
  test('attiva solo con la presa visione registrata', () => {
    expect(normalizzaCopiaCartacea(undefined).attiva).toBe(false);
    expect(normalizzaCopiaCartacea({ attiva: true }).attiva).toBe(false);
    expect(normalizzaCopiaCartacea({ attiva: true, presaVisioneDa: 'a@b.it', presaVisioneIl: '2026-10-30T10:00:00.000Z' }))
      .toEqual({ attiva: true, presaVisioneDa: 'a@b.it', presaVisioneIl: '2026-10-30T10:00:00.000Z' });
    expect(normalizzaCopiaCartacea({ attiva: false, presaVisioneIl: '2026-10-30T10:00:00.000Z' }).attiva).toBe(false);
  });
  test('i testi non promettono validità di legge', () => {
    expect(TESTO_PRESA_VISIONE).toMatch(/non verifica/);
    expect(FRASE_VERBALE).toBe('Copie dei documenti conservate in formato cartaceo');
  });
});
