import { autoDaCambiare, categoriaPrenotazione } from './cambioAuto';

const panda = { targa: 'AA111AA', categoria: 'Utilitaria', potenzaKw: 51, taraKg: 1015 };
const giulia = { targa: 'AB222BB', categoria: 'Berlina', potenzaKw: 147, taraKg: 1500 };
const ypsilon = { targa: 'AG777GG', categoria: 'Utilitaria' }; // senza potenza e tara
const veicoli = [panda, giulia, ypsilon];
const base = { status: 'attiva', dataInizio: '2026-10-19', dataFine: '2026-10-22', rilascioPatente: '2025-03-14' };

describe('auto da cambiare', () => {
  test('neopatentato con auto oltre i limiti: da cambiare', () => {
    const r = autoDaCambiare({ ...base, targa: 'AB222BB' }, veicoli, '2026-10-19');
    expect(r.esito).toBe('no');
    expect(r.messaggio).toMatch(/oltre i limiti di legge/);
  });
  test('auto senza potenza e tara: da verificare', () => {
    expect(autoDaCambiare({ ...base, targa: 'AG777GG' }, veicoli, '2026-10-19').esito).toBe('nd');
  });
  test('auto adatta, patente vecchia, data mancante, gia\' consegnata: niente', () => {
    expect(autoDaCambiare({ ...base, targa: 'AA111AA' }, veicoli, '2026-10-19')).toBeNull();
    expect(autoDaCambiare({ ...base, targa: 'AB222BB', rilascioPatente: '2019-01-01' }, veicoli, '2026-10-19')).toBeNull();
    expect(autoDaCambiare({ ...base, targa: 'AB222BB', rilascioPatente: '' }, veicoli, '2026-10-19')).toBeNull();
    expect(autoDaCambiare({ ...base, targa: 'AB222BB', consegnataIl: '2026-10-19T08:00:00Z' }, veicoli, '2026-10-19')).toBeNull();
    expect(autoDaCambiare({ ...base, targa: 'AB222BB', status: 'annullata' }, veicoli, '2026-10-19')).toBeNull();
    expect(autoDaCambiare({ ...base, targa: '' }, veicoli, '2026-10-19')).toBeNull();
  });
  test('categoria: dalla prenotazione, altrimenti dall\'auto abbinata', () => {
    expect(categoriaPrenotazione({ categoria: 'SUV', targa: 'AA111AA' }, veicoli)).toBe('SUV');
    expect(categoriaPrenotazione({ targa: 'AB222BB' }, veicoli)).toBe('Berlina');
    expect(categoriaPrenotazione({ targa: 'XX' }, veicoli)).toBe('');
  });
});
