import {
  kwPerTonnellata, idoneitaNeopatentati, neopatentatoFinoAl, statoPatente, testoDurataPatente, controlloAbbinamento, limitiPer,
} from './neopatentati';

const panda = { carburante: 'Benzina', potenzaKw: 66, taraKg: 1050 };
const potente = { carburante: 'Diesel', potenzaKw: 110, taraKg: 1300 };

describe('neopatentati', () => {
  test('kW per tonnellata', () => {
    expect(kwPerTonnellata(66, 1050)).toBe(62.9);
    expect(kwPerTonnellata('66', '1.050')).not.toBeNull();
    expect(kwPerTonnellata('', 1050)).toBeNull();
    expect(kwPerTonnellata(66, 0)).toBeNull();
  });

  test('limiti di legge: 75 kW/t e 105 kW per tutte le alimentazioni', () => {
    ['Benzina', 'Diesel', 'Elettrico', 'Ibrido', 'GPL'].forEach((a) => expect(limitiPer(a)).toEqual({ kwPerTonnellata: 75, kwMax: 105 }));
  });

  test('auto adatta, non adatta, da verificare', () => {
    expect(idoneitaNeopatentati(panda).esito).toBe('si');
    const no = idoneitaNeopatentati(potente);
    expect(no.esito).toBe('no');
    expect(no.motivo).toMatch(/84,6 kW\/t, oltre il limite di 75/);
    expect(no.motivo).toMatch(/110 kW, oltre il limite di 105/);
    expect(idoneitaNeopatentati({ carburante: 'Benzina', potenzaKw: 66 }).esito).toBe('nd');
  });

  test('basta un solo limite superato', () => {
    // 100 kW su 1500 kg = 66,7 kW/t (ok) ma 110 kW supera i 105
    expect(idoneitaNeopatentati({ potenzaKw: 110, taraKg: 1800 }).esito).toBe('no');
    // 80 kW su 1000 kg = 80 kW/t supera 75 anche se sotto i 105 kW
    expect(idoneitaNeopatentati({ potenzaKw: 80, taraKg: 1000 }).esito).toBe('no');
    // esattamente sul limite e' consentito
    expect(idoneitaNeopatentati({ potenzaKw: 75, taraKg: 1000 }).esito).toBe('si');
  });

  test('fine dei 3 anni', () => {
    expect(neopatentatoFinoAl('2025-03-14')).toBe('2028-03-14');
    expect(neopatentatoFinoAl('2024-12-14')).toBe('2027-12-14');
    expect(neopatentatoFinoAl('')).toBeNull();
  });

  test('stato della patente al ritiro', () => {
    expect(statoPatente('2025-03-14', '2026-10-20')).toEqual({ neopatentato: true, finoAl: '2028-03-14' });
    expect(statoPatente('2025-03-14', '2028-03-14').neopatentato).toBe(false);
    expect(statoPatente('2025-03-14', '2028-03-13').neopatentato).toBe(true);
    // patente prima del 14/12/2024: il vecchio anno di limiti e' scaduto
    expect(statoPatente('2024-06-01', '2026-10-20').neopatentato).toBe(false);
    expect(statoPatente('', '2026-10-20').neopatentato).toBeNull();
  });

  test('durata scritta', () => {
    expect(testoDurataPatente('2025-03-14', '2026-10-20')).toBe('1 anno e 7 mesi');
    expect(testoDurataPatente('2026-10-01', '2026-10-20')).toBe('meno di un mese');
  });

  test('abbinamento patente + veicolo', () => {
    const ritiro = '2026-10-20';
    expect(controlloAbbinamento({ veicolo: panda, rilascio: '2025-03-14', ritiro }).ok).toBe(true);
    const no = controlloAbbinamento({ veicolo: potente, rilascio: '2025-03-14', ritiro });
    expect(no.ok).toBe(false);
    expect(no.messaggio).toMatch(/fino al 14\/03\/2028/);
    expect(controlloAbbinamento({ veicolo: { carburante: 'Benzina' }, rilascio: '2025-03-14', ritiro }).ok).toBe(false);
    // non neopatentato: tutte le auto vanno bene
    expect(controlloAbbinamento({ veicolo: potente, rilascio: '2019-01-01', ritiro }).ok).toBe(true);
    // senza data di rilascio non si blocca nulla
    expect(controlloAbbinamento({ veicolo: potente, rilascio: '', ritiro }).ok).toBe(true);
  });
});
