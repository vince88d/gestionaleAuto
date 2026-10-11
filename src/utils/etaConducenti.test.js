import {
  normalizzaEtaConducenti, chiedeEta, etaSenzaSupplemento, testoSpuntaEta, etaSelezionabili,
  valutaEta, supplementoGiovane, testoSupplemento, etaConducentiPerForm, validaEtaConducenti,
  preparaEtaConducenti, ETA_CONDUCENTI_DI_PARTENZA, opzioniEtaGestionale,
  etaDaCodiceFiscale, controlloEtaConsegna,
} from './etaConducenti';

// Esempio del mockup: 18-20 anni +25 €/giorno, 21-24 +15 €/giorno, tetto 300 €, massimo 70 anni.
const ESEMPIO = {
  attivo: true, etaMinima: 18, etaMassima: 70,
  fasce: [{ finoA: 24, euroGiorno: 15 }, { finoA: 20, euroGiorno: 25 }],
  massimo: 300,
};

describe('normalizzaEtaConducenti', () => {
  test('senza documento: spento, maggiorenni, nessun limite', () => {
    expect(normalizzaEtaConducenti(undefined)).toEqual(ETA_CONDUCENTI_DI_PARTENZA);
  });
  test('fasce ordinate per eta\'', () => {
    expect(normalizzaEtaConducenti(ESEMPIO).fasce).toEqual([{ finoA: 20, euroGiorno: 25 }, { finoA: 24, euroGiorno: 15 }]);
  });
  test('valori sbagliati scartati: minima sotto 18, massima sotto la minima, fasce fuori dai limiti, doppie, senza importo', () => {
    const n = normalizzaEtaConducenti({
      attivo: true, etaMinima: 16, etaMassima: 17,
      fasce: [{ finoA: 17, euroGiorno: 10 }, { finoA: 21, euroGiorno: '12,50' }, { finoA: 21, euroGiorno: 5 }, { finoA: 22, euroGiorno: 0 }, { finoA: 'x', euroGiorno: 5 }],
      massimo: -3,
    });
    expect(n).toEqual({ attivo: true, etaMinima: 18, etaMassima: null, fasce: [{ finoA: 21, euroGiorno: 12.5 }], massimo: null });
  });
  test('una fascia che arriva all\'eta\' massima non vale (nessuno resterebbe senza supplemento)', () => {
    expect(normalizzaEtaConducenti({ ...ESEMPIO, fasce: [{ finoA: 70, euroGiorno: 5 }] }).fasce).toEqual([]);
  });
});

describe('cosa vede il cliente sul sito', () => {
  test('spunta: eta\' senza supplemento', () => {
    expect(etaSenzaSupplemento(ESEMPIO)).toEqual({ da: 25, a: 70 });
    expect(testoSpuntaEta(ESEMPIO)).toBe('Età del conducente compresa tra 25 - 70');
  });
  test('senza eta\' massima', () => {
    expect(testoSpuntaEta({ ...ESEMPIO, etaMassima: null })).toBe('Età del conducente di almeno 25 anni');
  });
  test('supplemento spento: la spunta parte dall\'eta\' minima', () => {
    expect(testoSpuntaEta({ ...ESEMPIO, attivo: false })).toBe('Età del conducente compresa tra 18 - 70');
  });
  test('elenco delle eta\': da minima a massima, poi «Oltre»', () => {
    const { eta, oltre } = etaSelezionabili(ESEMPIO);
    expect(eta[0]).toBe(18);
    expect(eta[eta.length - 1]).toBe(70);
    expect(eta).toHaveLength(53);
    expect(oltre).toBe(70);
    expect(etaSelezionabili({ etaMinima: 21 }).oltre).toBeNull();
    expect(etaSelezionabili({ etaMinima: 21 }).eta.slice(-1)[0]).toBe(99);
  });
  test('si chiede l\'eta\' solo se c\'e\' una regola', () => {
    expect(chiedeEta(undefined)).toBe(false);
    expect(chiedeEta({ attivo: false, fasce: [{ finoA: 24, euroGiorno: 15 }] })).toBe(false);
    expect(chiedeEta(ESEMPIO)).toBe(true);
    expect(chiedeEta({ etaMassima: 75 })).toBe(true);
    expect(chiedeEta({ etaMinima: 21 })).toBe(true);
  });
});

describe('valutaEta', () => {
  test('fascia giusta per ogni eta\' (fino a N compresi)', () => {
    expect(valutaEta(ESEMPIO, 18).euroGiorno).toBe(25);
    expect(valutaEta(ESEMPIO, 20).euroGiorno).toBe(25);
    expect(valutaEta(ESEMPIO, 21).euroGiorno).toBe(15);
    expect(valutaEta(ESEMPIO, 24).euroGiorno).toBe(15);
    expect(valutaEta(ESEMPIO, 25)).toEqual({ ammessa: true, motivo: null, euroGiorno: 0 });
    expect(valutaEta(ESEMPIO, 70).euroGiorno).toBe(0);
  });
  test('fuori dai limiti', () => {
    expect(valutaEta(ESEMPIO, 17).motivo).toBe('sotto');
    expect(valutaEta(ESEMPIO, 71).motivo).toBe('oltre');
    expect(valutaEta(ESEMPIO, '22').euroGiorno).toBe(15);
    expect(valutaEta(ESEMPIO, 'abc').motivo).toBe('eta');
    expect(valutaEta(ESEMPIO, 22.5).motivo).toBe('eta');
  });
  test('supplemento spento: nessun importo, ma i limiti restano', () => {
    expect(valutaEta({ ...ESEMPIO, attivo: false }, 19)).toEqual({ ammessa: true, motivo: null, euroGiorno: 0 });
    expect(valutaEta({ ...ESEMPIO, attivo: false }, 80).motivo).toBe('oltre');
  });
});

describe('supplementoGiovane', () => {
  test('euro al giorno x giorni', () => {
    expect(supplementoGiovane(ESEMPIO, 22, 3)).toEqual({ eta: 22, euroGiorno: 15, giorni: 3, importo: 45, alMassimo: false });
  });
  test('non oltre il tetto', () => {
    expect(supplementoGiovane(ESEMPIO, 19, 14)).toEqual({ eta: 19, euroGiorno: 25, giorni: 14, importo: 300, alMassimo: true });
    expect(supplementoGiovane(ESEMPIO, 19, 12).alMassimo).toBe(false); // 300 esatti: non serve il tetto
  });
  test('senza tetto', () => {
    expect(supplementoGiovane({ ...ESEMPIO, massimo: null }, 19, 14).importo).toBe(350);
  });
  test('niente supplemento: eta\' senza fascia, non indicata, non ammessa', () => {
    expect(supplementoGiovane(ESEMPIO, 30, 3)).toBeNull();
    expect(supplementoGiovane(ESEMPIO, null, 3)).toBeNull();
    expect(supplementoGiovane(ESEMPIO, '', 3)).toBeNull();
    expect(supplementoGiovane(ESEMPIO, 17, 3)).toBeNull();
    expect(supplementoGiovane({ ...ESEMPIO, attivo: false }, 19, 3)).toBeNull();
  });
  test('almeno un giorno', () => {
    expect(supplementoGiovane(ESEMPIO, 22, 0).importo).toBe(15);
  });
  test('testo della riga', () => {
    expect(testoSupplemento(supplementoGiovane(ESEMPIO, 22, 3))).toBe('Giovane conducente · 22 anni · 15 € × 3 giorni');
    expect(testoSupplemento(supplementoGiovane(ESEMPIO, 22, 1))).toBe('Giovane conducente · 22 anni · 15 € × 1 giorno');
    expect(testoSupplemento(supplementoGiovane(ESEMPIO, 19, 20))).toBe('Giovane conducente · 19 anni · massimo 300 €');
    expect(testoSupplemento(null)).toBe('');
  });
});

describe('form delle Impostazioni', () => {
  const formOk = {
    attivo: true, etaMinima: '18', conMassima: true, etaMassima: '70',
    fasce: [{ finoA: '20', euroGiorno: '25,00' }, { finoA: '24', euroGiorno: '15' }],
    conMassimo: true, massimo: '300,00',
  };

  test('dai dati salvati al form e ritorno', () => {
    const form = etaConducentiPerForm(ESEMPIO);
    expect(form).toEqual({ ...formOk, fasce: [{ finoA: '20', euroGiorno: '25,00' }, { finoA: '24', euroGiorno: '15,00' }] });
    expect(validaEtaConducenti(form)).toEqual({});
    expect(preparaEtaConducenti(form)).toEqual(normalizzaEtaConducenti(ESEMPIO));
  });
  test('primo uso: spento, una fascia da compilare, senza eta\' massima', () => {
    const form = etaConducentiPerForm(undefined);
    expect(form.attivo).toBe(false);
    expect(form.conMassima).toBe(false);
    expect(form.fasce).toEqual([{ finoA: '24', euroGiorno: '' }]);
    expect(validaEtaConducenti(form)).toEqual({}); // spento: le fasce non contano
  });
  test('errori', () => {
    expect(validaEtaConducenti({ ...formOk, etaMinima: '16' }).etaMinima).toBeTruthy();
    expect(validaEtaConducenti({ ...formOk, etaMassima: '18' }).etaMassima).toMatch(/più dell'età minima/);
    expect(validaEtaConducenti({ ...formOk, fasce: [] }).fasce).toBeTruthy();
    expect(validaEtaConducenti({ ...formOk, fasce: [{ finoA: '70', euroGiorno: '5' }] })['fasce.0.finoA']).toMatch(/meno dell'età massima/);
    expect(validaEtaConducenti({ ...formOk, fasce: [{ finoA: '20', euroGiorno: '5' }, { finoA: '20', euroGiorno: '3' }] })['fasce.1.finoA']).toMatch(/già una fascia/);
    expect(validaEtaConducenti({ ...formOk, fasce: [{ finoA: '20', euroGiorno: '' }] })['fasce.0.euroGiorno']).toBeTruthy();
    expect(validaEtaConducenti({ ...formOk, fasce: [{ finoA: '20', euroGiorno: '0' }] })['fasce.0.euroGiorno']).toBeTruthy();
    expect(validaEtaConducenti({ ...formOk, massimo: '' }).massimo).toBeTruthy();
    expect(validaEtaConducenti({ ...formOk, conMassimo: false, massimo: '' })).toEqual({});
    expect(validaEtaConducenti({ ...formOk, conMassima: false, etaMassima: '' })).toEqual({});
  });
  test('spento: si salvano comunque le fasce scritte', () => {
    const salvato = preparaEtaConducenti({ ...formOk, attivo: false });
    expect(salvato.attivo).toBe(false);
    expect(salvato.fasce).toHaveLength(2);
    expect(supplementoGiovane(salvato, 19, 3)).toBeNull();
  });
});

describe('opzioniEtaGestionale', () => {
  test('fascia senza supplemento, eta\' con supplemento, oltre il massimo', () => {
    const o = opzioniEtaGestionale(ESEMPIO);
    expect(o[0]).toEqual({ valore: '', testo: 'Dai 25 ai 70 anni (nessun supplemento)' });
    expect(o[1]).toEqual({ valore: '18', testo: '18 anni (+25 € al giorno)' });
    expect(o[5]).toEqual({ valore: '22', testo: '22 anni (+15 € al giorno)' });
    expect(o).toHaveLength(1 + 7 + 1);
    expect(o[o.length - 1]).toEqual({ valore: 'oltre', testo: 'Oltre 70 anni' });
  });
  test('eta\' gia\' salvata fuori elenco e nessuna eta\' massima', () => {
    const o = opzioniEtaGestionale({ ...ESEMPIO, etaMassima: null }, 30);
    expect(o[0].testo).toBe('25 anni o più (nessun supplemento)');
    expect(o[o.length - 1]).toEqual({ valore: '30', testo: '30 anni' });
  });
});

describe('etaDaCodiceFiscale', () => {
  test('uomo e donna, prima e dopo il compleanno', () => {
    // RSSMRA04C15H501? : 15 marzo 2004
    expect(etaDaCodiceFiscale('RSSMRA04C15H501X', '2026-03-14')).toBe(21);
    expect(etaDaCodiceFiscale('RSSMRA04C15H501X', '2026-03-15')).toBe(22);
    // donna: giorno + 40
    expect(etaDaCodiceFiscale('BNCLRA80A55H501X', '2026-10-11')).toBe(46);
  });
  test('omocodia e secolo', () => {
    expect(etaDaCodiceFiscale('RSSMRAL4C15H501X', '2026-10-11')).toBe(22); // L = 0 nell'omocodia
    expect(etaDaCodiceFiscale('RSSMRAQ4C15H501X', '2026-10-11')).toBe(82); // Q = 4: 1944
    expect(etaDaCodiceFiscale('rssmra30a01h501x', '2026-10-11')).toBe(96);
  });
  test('codice non leggibile', () => {
    expect(etaDaCodiceFiscale('', '2026-10-11')).toBeNull();
    expect(etaDaCodiceFiscale('RSSMRA04Z15H501X', '2026-10-11')).toBeNull();
    expect(etaDaCodiceFiscale('RSSMRA04C35H501X', '2026-10-11')).toBeNull();
  });
});

describe('controlloEtaConsegna', () => {
  const OGGI = '2026-10-11';
  const CF22 = 'RSSMRA04C15H501X'; // 22 anni
  const CF30 = 'RSSMRA96C15H501X'; // 30 anni
  const pren = (etaConducente, giorni = 3) => ({
    etaConducente, giovaneConducente: supplementoGiovane(ESEMPIO, etaConducente, giorni),
  });

  test('senza regole e senza eta\': niente', () => {
    expect(controlloEtaConsegna({ prenotazione: {}, etaConducenti: undefined, codiceFiscale: CF22, oggi: OGGI })).toBeNull();
  });
  test('codice fiscale che torna: niente avviso', () => {
    expect(controlloEtaConsegna({ prenotazione: pren(22), etaConducenti: ESEMPIO, codiceFiscale: CF22, oggi: OGGI })).toBeNull();
    expect(controlloEtaConsegna({ prenotazione: pren(null), etaConducenti: ESEMPIO, codiceFiscale: CF30, oggi: OGGI })).toBeNull();
  });
  test('ha dichiarato la fascia senza supplemento ma ha 22 anni', () => {
    const r = controlloEtaConsegna({ prenotazione: pren(null), etaConducenti: ESEMPIO, codiceFiscale: CF22, oggi: OGGI });
    expect(r.livello).toBe('attenzione');
    expect(r.testo).toMatch(/ha 22 anni: il supplemento giusto è 15 € al giorno/);
    expect(r.testo).toMatch(/«Modifica»/);
  });
  test('pagata sul sito: differenza al banco', () => {
    const r = controlloEtaConsegna({ prenotazione: pren(19), etaConducenti: ESEMPIO, codiceFiscale: CF22, oggi: OGGI, pagataSulSito: true });
    expect(r.testo).toMatch(/ma ha dichiarato 19: il supplemento giusto è 15 € al giorno \(ne paga 25 €\)/);
    expect(r.testo).toMatch(/differenza al banco/);
  });
  test('senza codice fiscale: ricorda la patente', () => {
    expect(controlloEtaConsegna({ prenotazione: pren(22), etaConducenti: ESEMPIO, codiceFiscale: '', oggi: OGGI }))
      .toEqual({ livello: 'info', testo: 'Il cliente ha dichiarato 22 anni (supplemento 45 €). Controlla la data di nascita sulla patente: se non corrisponde, correggi l\'età nella prenotazione prima di consegnare.' });
    expect(controlloEtaConsegna({ prenotazione: pren(null), etaConducenti: ESEMPIO, codiceFiscale: '', oggi: OGGI }).testo)
      .toMatch(/un'età tra 25 e 70 anni/);
  });
  test('troppo giovane o oltre il massimo', () => {
    expect(controlloEtaConsegna({ prenotazione: pren(null), etaConducenti: { ...ESEMPIO, etaMinima: 23 }, codiceFiscale: CF22, oggi: OGGI }).livello).toBe('errore');
    expect(controlloEtaConsegna({ prenotazione: pren(null), etaConducenti: { ...ESEMPIO, etaMassima: 28 }, codiceFiscale: CF30, oggi: OGGI }).livello).toBe('attenzione');
  });
});
