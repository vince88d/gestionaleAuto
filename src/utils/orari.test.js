import {
  ORARI_PREDEFINITI, normalizzaOrari, validaOrari, preparaOrari, testoSettimana, testoChiusure,
  orarioDelGiorno, apertaAlle, oreSelezionabili, ORE_DEL_GIORNO, oraBreve,
} from './orari';

const copia = () => JSON.parse(JSON.stringify(ORARI_PREDEFINITI));

test('senza documento si parte dagli orari di oggi del sito', () => {
  expect(normalizzaOrari(undefined)).toEqual(ORARI_PREDEFINITI);
  expect(testoSettimana(ORARI_PREDEFINITI)).toBe('Lun–Ven 8:30–13:00 / 15:00–19:30 · Sab 9:00–13:00 / 15:30–19:00 · Dom chiuso');
});

test('normalizza: orari non validi tolti, giorno senza fasce = chiuso, chiusure in ordine', () => {
  const o = normalizzaOrari({
    settimana: { lun: { aperto: true, fasce: [{ da: '9:00', a: '13:00' }] }, mar: { aperto: true, fasce: [{ da: '09:00', a: '13:00' }] } },
    chiusure: [{ dal: '2026-12-24', al: '2026-12-26', motivo: ' Natale ' }, { dal: '2026-08-15', al: '' }, { dal: 'boh' }],
    tolleranzaMinuti: 500,
  });
  expect(o.settimana.lun).toEqual({ aperto: false, fasce: [] });
  expect(o.settimana.mar.aperto).toBe(true);
  expect(o.chiusure).toEqual([{ dal: '2026-08-15', al: '2026-08-15', motivo: '' }, { dal: '2026-12-24', al: '2026-12-26', motivo: 'Natale' }]);
  expect(o.tolleranzaMinuti).toBe(29);
});

test('valida: chiusura dopo apertura, pomeriggio dopo mattina, chiusure e tolleranza', () => {
  const f = copia();
  f.settimana.lun.fasce[0] = { da: '13:00', a: '09:00' };
  f.settimana.mar.fasce[1] = { da: '12:00', a: '19:00' };
  f.settimana.mer.fasce = [];
  f.chiusure = [{ dal: '2026-08-20', al: '2026-08-10', motivo: '' }, { dal: '', al: '', motivo: 'x' }];
  f.tolleranzaMinuti = '-1';
  const e = validaOrari(f);
  expect(e['lun.0']).toMatch(/dopo l'apertura/);
  expect(e['mar.1']).toMatch(/dopo la mattina/);
  expect(e['mer.0']).toMatch(/almeno un orario/);
  expect(e['chiusura.0']).toMatch(/prima dell'inizio/);
  expect(e['chiusura.1']).toMatch(/Scegli il giorno/);
  expect(e.tolleranza).toBeTruthy();
  expect(validaOrari(copia())).toEqual({});
});

test('prepara: un giorno solo di chiusura ha la fine uguale all\'inizio', () => {
  const f = copia();
  f.chiusure = [{ dal: '2026-08-15', al: '', motivo: 'Ferragosto' }];
  f.tolleranzaMinuti = '59';
  const o = preparaOrari(f);
  expect(o.chiusure[0].al).toBe('2026-08-15');
  expect(o.tolleranzaMinuti).toBe(59);
  expect(testoChiusure(o)).toBe('il 15/08 (Ferragosto)');
});

test('testo: giorni di fila con gli stessi orari si uniscono', () => {
  const o = copia();
  o.settimana.mer = { aperto: false, fasce: [] };
  expect(testoSettimana(o)).toBe('Lun–Mar 8:30–13:00 / 15:00–19:30 · Mer chiuso · Gio–Ven 8:30–13:00 / 15:00–19:30 · Sab 9:00–13:00 / 15:30–19:00 · Dom chiuso');
});

test('orario di un giorno: settimana, domenica, chiusura straordinaria', () => {
  const o = copia();
  o.chiusure = [{ dal: '2026-12-24', al: '2026-12-26', motivo: 'Natale' }];
  expect(orarioDelGiorno(o, '2026-10-12').fasce).toHaveLength(2); // lunedi'
  expect(orarioDelGiorno(o, '2026-10-11')).toEqual({ chiuso: true, motivo: '', fasce: [] }); // domenica
  expect(orarioDelGiorno(o, '2026-12-25')).toEqual({ chiuso: true, motivo: 'Natale', fasce: [] });
  expect(orarioDelGiorno(o, '')).toBeNull();
});

test('aperta alle: dentro le fasce, estremi compresi', () => {
  const o = copia();
  expect(apertaAlle(o, '2026-10-12', '08:30')).toBe(true);
  expect(apertaAlle(o, '2026-10-12', '13:00')).toBe(true);
  expect(apertaAlle(o, '2026-10-12', '14:00')).toBe(false);
  expect(apertaAlle(o, '2026-10-11', '10:00')).toBe(false);
});

test('ore selezionabili ogni 30 minuti dentro le fasce', () => {
  const o = copia();
  expect(oreSelezionabili(o, '2026-10-17')).toEqual([ // sabato 9-13 / 15:30-19
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00',
    '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00',
  ]);
  expect(oreSelezionabili(o, '2026-10-12')[0]).toBe('08:30');
  expect(oreSelezionabili(o, '2026-10-11')).toEqual([]);
  expect(ORE_DEL_GIORNO).toHaveLength(48);
  expect(oraBreve('08:30')).toBe('8:30');
});
