import { cambiaStatoRiparazione } from './danniVeicolo';

const ADESSO = '2026-09-23T10:00:00.000Z';

describe('cambiaStatoRiparazione', () => {
  test('un danno da riparare passa nello storico con la data di riparazione', () => {
    const veicolo = {
      danni: [{ descrizione: 'graffio', daRiparare: true }, { descrizione: 'ammaccatura', daRiparare: false }],
      storicoRiparazioni: [{ descrizione: 'vecchio', riparatoIn: '2026-01-01' }],
    };
    const risultato = cambiaStatoRiparazione(veicolo, 0, ADESSO);
    expect(risultato.danni).toEqual([{ descrizione: 'ammaccatura', daRiparare: false }]);
    expect(risultato.storicoRiparazioni).toEqual([
      { descrizione: 'vecchio', riparatoIn: '2026-01-01' },
      { descrizione: 'graffio', daRiparare: false, riparatoIn: ADESSO },
    ]);
  });

  test('un danno preesistente diventa da riparare senza toccare lo storico', () => {
    const storico = [{ descrizione: 'A' }, { descrizione: 'B' }];
    const veicolo = {
      danni: [{ descrizione: 'x', daRiparare: true }, { descrizione: 'preesistente', daRiparare: false }],
      storicoRiparazioni: storico,
    };
    const risultato = cambiaStatoRiparazione(veicolo, 1, ADESSO);
    expect(risultato.danni[1]).toEqual({ descrizione: 'preesistente', daRiparare: true });
    expect(risultato.danni).toHaveLength(2);
    // Prima veniva cancellata la voce B (stessa posizione del danno): non deve succedere.
    expect(risultato.storicoRiparazioni).toBe(storico);
  });

  test('senza storico lo crea', () => {
    const risultato = cambiaStatoRiparazione({ danni: [{ daRiparare: true }] }, 0, ADESSO);
    expect(risultato.storicoRiparazioni).toEqual([{ daRiparare: false, riparatoIn: ADESSO }]);
  });

  test('indice inesistente: nessun cambio', () => {
    expect(cambiaStatoRiparazione({ danni: [] }, 3)).toBeNull();
    expect(cambiaStatoRiparazione({}, 0)).toBeNull();
  });
});
