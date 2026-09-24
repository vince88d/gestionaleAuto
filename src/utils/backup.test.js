import { serializzaValore, componiBackup, nomeFileBackup, riepilogoBackup } from './backup';

const timestamp = (iso) => ({ toDate: () => new Date(iso) });

describe('serializzaValore', () => {
  it('converte le date di Firestore anche dentro oggetti e liste', () => {
    expect(serializzaValore({
      creata: timestamp('2026-09-24T08:00:00.000Z'),
      danni: [{ il: timestamp('2026-01-02T00:00:00.000Z'), nota: 'graffio' }],
      km: 1200,
      nulla: null,
    })).toEqual({
      creata: '2026-09-24T08:00:00.000Z',
      danni: [{ il: '2026-01-02T00:00:00.000Z', nota: 'graffio' }],
      km: 1200,
      nulla: null,
    });
  });
});

describe('componiBackup', () => {
  it('mette conteggi, data e dati serializzati', () => {
    const backup = componiBackup({
      collezioni: { veicoli: [{ id: 'AB123CD' }], prenotazioni: [], clienti: [{ id: 'x' }, { id: 'y' }] },
      impostazioni: { tariffe: { prezziGiorno: { SUV: 50 }, aggiornatoIl: timestamp('2026-09-01T00:00:00.000Z') } },
      creatoIl: new Date('2026-09-24T10:00:00.000Z'),
      creatoDa: 'staff@x.it',
    });
    expect(backup).toMatchObject({
      tipo: 'backup-gestionale-noleggio',
      versione: 1,
      creatoIl: '2026-09-24T10:00:00.000Z',
      creatoDa: 'staff@x.it',
      conteggi: { veicoli: 1, prenotazioni: 0, clienti: 2 },
    });
    expect(backup.impostazioni.tariffe.aggiornatoIl).toBe('2026-09-01T00:00:00.000Z');
    expect(riepilogoBackup(backup)).toBe('1 veicoli, 0 prenotazioni, 2 clienti');
  });
});

describe('nomeFileBackup', () => {
  it('usa la data locale', () => {
    expect(nomeFileBackup(new Date(2026, 8, 4, 23, 30))).toBe('backup-gestionale-2026-09-04.json');
  });
});
