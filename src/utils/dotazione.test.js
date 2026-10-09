import {
  VOCI_BASE, DOCUMENTI, CATENE, normalizzaVoci, dotazioneVeicolo, chiaviVeicolo, elettricaOIbrida, vociDaScegliere,
  inStagioneCatene, avvisoCatene, dotazioneIniziale, riassuntoDotazione, dotazioneDaSalvare,
} from './dotazione';

test('voci pulite, senza doppioni ne\' vuote', () => {
  expect(normalizzaVoci([' Cric ', 'cric', '', 'Adattatore  Schuko'])).toEqual(['Cric', 'Adattatore Schuko']);
  expect(normalizzaVoci(null)).toEqual([]);
});

test('dotazione del veicolo: null se mai impostata, anche vuota se impostata', () => {
  expect(dotazioneVeicolo({})).toBeNull();
  expect(dotazioneVeicolo({ dotazione: [] })).toEqual([]);
  expect(chiaviVeicolo({ chiavi: 2 })).toBe(2);
  expect(chiaviVeicolo({ chiavi: '3' })).toBeNull();
  expect(elettricaOIbrida({ carburante: 'Elettrico' })).toBe(true);
  expect(elettricaOIbrida({ carburante: 'Benzina' })).toBe(false);
});

test('voci da scegliere: base piu\' quelle aggiunte', () => {
  expect(vociDaScegliere(['Cric', 'Tappetini'])).toEqual([...VOCI_BASE, 'Tappetini']);
});

test('stagione delle catene: 15 novembre - 15 aprile', () => {
  expect(inStagioneCatene('2026-11-15')).toBe(true);
  expect(inStagioneCatene('2026-01-10')).toBe(true);
  expect(inStagioneCatene('2026-04-15')).toBe(true);
  expect(inStagioneCatene('2026-04-16')).toBe(false);
  expect(inStagioneCatene('2026-11-14')).toBe(false);
  expect(inStagioneCatene('')).toBe(false);
});

test('avviso catene solo senza gomme invernali e senza catene a bordo', () => {
  expect(avvisoCatene({ dotazione: ['Cric'] }, '2026-12-10')).toBe(true);
  expect(avvisoCatene({ dotazione: ['Cric', CATENE] }, '2026-12-10')).toBe(false);
  expect(avvisoCatene({ gommeInvernali: true }, '2026-12-10')).toBe(false);
  expect(avvisoCatene({}, '2026-07-10')).toBe(false);
});

test('consegna: dotazione dell\'auto gia\' spuntata, o lista base vuota da salvare', () => {
  expect(dotazioneIniziale({ dotazione: [DOCUMENTI, 'Cric'], chiavi: 2 })).toEqual({
    voci: [DOCUMENTI, 'Cric'], presenti: [DOCUMENTI, 'Cric'], impostata: true, chiaviConsegnate: 2, note: '', salvaComeDotazione: false,
  });
  const senza = dotazioneIniziale({});
  expect(senza).toMatchObject({ voci: VOCI_BASE, presenti: [], impostata: false, chiaviConsegnate: null, salvaComeDotazione: true });
});

test('riassunto: presenti e mancanti (solo se la dotazione era impostata)', () => {
  expect(riassuntoDotazione({ dotazione: { voci: ['Cric', CATENE], presenti: ['Cric'], impostata: true, chiaviConsegnate: 2, note: ' cavo domani ' } }))
    .toEqual({ presenti: ['Cric'], mancanti: [CATENE], chiaviConsegnate: 2, note: 'cavo domani' });
  expect(riassuntoDotazione({ dotazione: { voci: VOCI_BASE, presenti: ['Cric'], impostata: false } }).mancanti).toEqual([]);
});

test('consegne di prima con gli accessori: solo quelli presenti, con i nomi giusti', () => {
  expect(riassuntoDotazione({ accessori: { cric: true, ruotaScorta: true, triangolo: false, altro: 'Seggiolino' } }))
    .toEqual({ presenti: ['Cric', 'Ruota di scorta', 'Seggiolino'], mancanti: [], chiaviConsegnate: null, note: '' });
  expect(riassuntoDotazione({}).presenti).toEqual([]);
});

test('salva come dotazione solo per auto che non l\'avevano e se richiesto', () => {
  expect(dotazioneDaSalvare({ dotazione: { impostata: false, salvaComeDotazione: true, presenti: ['Cric'], chiaviConsegnate: 1 } }))
    .toEqual({ dotazione: ['Cric'], chiavi: 1 });
  expect(dotazioneDaSalvare({ dotazione: { impostata: false, salvaComeDotazione: false, presenti: ['Cric'] } })).toBeNull();
  expect(dotazioneDaSalvare({ dotazione: { impostata: true, salvaComeDotazione: true, presenti: ['Cric'] } })).toBeNull();
  expect(dotazioneDaSalvare({})).toBeNull();
});
