import {
  ORARI_PREDEFINITI, normalizzaOrari, validaOrari, preparaOrari, testoSettimana, testoChiusure,
  orarioDelGiorno, apertaAlle, oreSelezionabili, ORE_DEL_GIORNO, oraBreve,
  oraPredefinita, oraProposta, avvisoFuoriOrario, avvisoGiornoInPiu,
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

describe('avvisi di Nuova prenotazione', () => {
  const o = normalizzaOrari({ ...JSON.parse(JSON.stringify(ORARI_PREDEFINITI)), chiusure: [{ dal: '2026-12-25', al: '2026-12-26', motivo: 'Natale' }] });

  test('ora proposta: 9:00, o la prima d\'apertura', () => {
    expect(oraProposta(o, '2026-10-12')).toBe('09:00');
    expect(oraProposta(o, '2026-10-11')).toBe('09:00'); // domenica chiusa
    expect(oraPredefinita(['15:00', '15:30'])).toBe('15:00');
  });

  test('fuori orario e giorni chiusi', () => {
    expect(avvisoFuoriOrario(o, '2026-10-15', '09:00')).toBeNull();
    expect(avvisoFuoriOrario(o, '2026-10-15', '20:00')).toBe('Giovedì 15 alle 20:00 la sede è chiusa (aperta 8:30–13:00 / 15:00–19:30).');
    expect(avvisoFuoriOrario(o, '2026-10-11', '10:00')).toBe('Domenica 11 alle 10:00 la sede è chiusa tutto il giorno.');
    expect(avvisoFuoriOrario(o, '2026-12-25', '10:00')).toBe('Venerdì 25 alle 10:00 la sede è chiusa (Natale).');
  });

  test('giorno in piu\' oltre la tolleranza', () => {
    const d = { dataInizio: '2026-10-12', dataFine: '2026-10-15', oraInizio: '09:00' };
    expect(avvisoGiornoInPiu({ ...d, oraFine: '09:29' }, 29)).toBeNull();
    expect(avvisoGiornoInPiu({ ...d, oraFine: '20:00' }, 29)).toEqual({
      giorni: 4,
      senza: 3,
      testo: 'Il rientro è 11 ore oltre i 3 giorni: si contano 4 giorni (rientrando entro le 9:29 sarebbero 3).',
    });
    expect(avvisoGiornoInPiu({ ...d, oraFine: '10:30' }, 29).testo).toMatch(/^Il rientro è 1 ora e 30 minuti oltre/);
    expect(avvisoGiornoInPiu({ ...d, dataFine: '2026-10-12', oraFine: '18:00' }, 29)).toBeNull(); // stesso giorno
  });
});
