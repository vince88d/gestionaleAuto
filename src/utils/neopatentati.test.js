import {
  kwPerTonnellata, fonteRapporto, idoneitaNeopatentati, neopatentatoFinoAl, statoPatente, testoDurataPatente, controlloAbbinamento, limitiPer, massaPerRapporto, NOTA_TARA, eElettricaOIbrida, AVVISO_CONTROLLO, registroControllo, LIMITI_NEOPATENTATI, statoVelocita, testoVelocita,
} from './neopatentati';

const panda = { carburante: 'Benzina', potenzaKw: 66, taraKg: 1050 };
const potente = { carburante: 'Diesel', potenzaKw: 110, taraKg: 1300 };

describe('neopatentati', () => {
  test('kW per tonnellata', () => {
    // campo G (senza conducente): si aggiungono 75 kg. Esempio ACI: 55 kW e 1050 kg = 48,9 kW/t
    expect(kwPerTonnellata(55, 1050)).toBe(48.9);
    expect(kwPerTonnellata(66, 1050, 'G')).toBe(58.7); // 66 / 1,125
    // campo G.1 (massa in ordine di marcia, con conducente): niente da aggiungere
    expect(kwPerTonnellata(66, 1050, 'G1')).toBe(62.9);
    expect(kwPerTonnellata('66', '1.050')).not.toBeNull();
    expect(kwPerTonnellata('', 1050)).toBeNull();
    expect(kwPerTonnellata(66, 0)).toBeNull();
  });

  test('torna col «rapporto potenza/tara» stampato a pag. 3 di tre libretti veri (massa a vuoto + 75 kg)', () => {
    // Range Rover: 183 kW, massa a vuoto 2430 kg, libretto 73,054
    expect(kwPerTonnellata(183, 2430, 'G')).toBe(73.1);
    // Mercedes X-Class: 190 kW, 2265 kg, libretto 81,197
    expect(kwPerTonnellata(190, 2265, 'G')).toBe(81.2);
    // VW Polo: 51 kW, 992 kg, libretto 47,798
    expect(kwPerTonnellata(51, 992, 'G')).toBe(47.8);
  });

  describe('rapporto copiato dal libretto (facciata 3)', () => {
    test('se c\'e\', vale quello e non serve la massa a vuoto', () => {
      expect(kwPerTonnellata(110, '', 'G', 66.465)).toBe(66.5);
      expect(fonteRapporto({ potenzaKw: 110, rapportoLibretto: 66.465 })).toBe('libretto');
    });
    test('ha la precedenza sul calcolo, anche se potenza e massa a vuoto ci sono', () => {
      const v = { potenzaKw: 51, taraKg: 992, taraCampo: 'G', rapportoLibretto: 80 };
      expect(idoneitaNeopatentati(v)).toMatchObject({ esito: 'no', fonte: 'libretto' });
      expect(idoneitaNeopatentati({ ...v, rapportoLibretto: '' })).toMatchObject({ esito: 'si', fonte: 'calcolato' });
    });
    test('Audi Q3: rapporto nei limiti ma 110 kW oltre il tetto di 105 kW per le autovetture', () => {
      const r = idoneitaNeopatentati({ tipoVeicolo: 'autovettura', potenzaKw: 110, rapportoLibretto: 66.465 });
      expect(r.esito).toBe('no');
      expect(r.motivo).toMatch(/110 kW, oltre il limite di 105/);
      expect(r.motivo).not.toMatch(/kW\/t/);
    });
    test('limite sul valore stampato: 75 passa, 75,001 no', () => {
      expect(idoneitaNeopatentati({ tipoVeicolo: 'furgone', potenzaKw: 60, rapportoLibretto: 75 }).esito).toBe('si');
      expect(idoneitaNeopatentati({ tipoVeicolo: 'furgone', potenzaKw: 60, rapportoLibretto: 75.001 }).esito).toBe('no');
    });
    test('furgone: col rapporto basta, la potenza non e\' obbligatoria; autovettura senza potenza e\' da verificare', () => {
      expect(idoneitaNeopatentati({ tipoVeicolo: 'furgone', rapportoLibretto: 70 }).esito).toBe('si');
      const r = idoneitaNeopatentati({ tipoVeicolo: 'autovettura', rapportoLibretto: 70 });
      expect(r.esito).toBe('nd');
      expect(r.motivo).toMatch(/potenza/);
    });
    test('senza rapporto e senza massa a vuoto: da verificare, dice cosa scrivere', () => {
      const r = idoneitaNeopatentati({ tipoVeicolo: 'autovettura', potenzaKw: 80 });
      expect(r.esito).toBe('nd');
      expect(r.motivo).toMatch(/rapporto potenza\/tara del libretto/);
    });
    test('il registro dice che il rapporto e\' dal libretto, senza massa usata', () => {
      const r = registroControllo({ veicolo: { targa: 'AB123CD', potenzaKw: 190, taraKg: 2265, rapportoLibretto: 81.197 }, rilascio: '2025-03-14', ritiro: '2026-10-20', adesso: new Date('2026-10-20T10:00:00Z') });
      expect(r.veicolo).toMatchObject({ fonteRapporto: 'libretto', rapportoLibretto: 81.197, massaUsataKg: null, kwPerTonnellata: 81.197 });
      expect(r.esito).toBe('no');
    });
  });

  test('peso usato per il rapporto: G aggiunge 75 kg, G.1 no, senza scelta vale G', () => {
    expect(massaPerRapporto(1050, 'G')).toEqual({ kg: 1125, tara: 1050, aggiunti: 75 });
    expect(massaPerRapporto(1050, undefined)).toEqual({ kg: 1125, tara: 1050, aggiunti: 75 });
    expect(massaPerRapporto(1050, 'qualcosa')).toEqual({ kg: 1125, tara: 1050, aggiunti: 75 });
    expect(massaPerRapporto(1050, 'G1')).toEqual({ kg: 1050, tara: 1050, aggiunti: 0 });
    expect(massaPerRapporto('', 'G')).toBeNull();
    expect(NOTA_TARA).toMatch(/75 kg convenzionali/);
  });

  test('limiti di legge: 75 kW/t e 105 kW per tutte le alimentazioni', () => {
    ['Benzina', 'Diesel', 'Elettrico', 'Ibrido', 'GPL'].forEach((a) => expect(limitiPer(a)).toEqual({ kwPerTonnellata: 75, kwMax: 105 }));
  });

  test('auto adatta, non adatta, da verificare', () => {
    expect(idoneitaNeopatentati(panda).esito).toBe('si');
    const no = idoneitaNeopatentati(potente);
    expect(no.esito).toBe('no');
    expect(no.motivo).toMatch(/80 kW\/t, oltre il limite di 75/); // 110 / 1,375
    expect(no.motivo).toMatch(/110 kW, oltre il limite di 105/);
    expect(idoneitaNeopatentati({ carburante: 'Benzina', potenzaKw: 66 }).esito).toBe('nd');
  });

  test('basta un solo limite superato', () => {
    // 100 kW su 1500 kg = 66,7 kW/t (ok) ma 110 kW supera i 105
    expect(idoneitaNeopatentati({ potenzaKw: 110, taraKg: 1800 }).esito).toBe('no');
    // 80 kW su 1000 kg = 80 kW/t supera 75 anche se sotto i 105 kW
    expect(idoneitaNeopatentati({ potenzaKw: 80, taraKg: 1000, taraCampo: 'G1' }).esito).toBe('no');
    // lo stesso peso scritto nel campo G: 80 / 1,075 = 74,4 kW/t, consentito
    expect(idoneitaNeopatentati({ potenzaKw: 80, taraKg: 1000, taraCampo: 'G' }).esito).toBe('si');
    // esattamente sul limite e' consentito
    expect(idoneitaNeopatentati({ potenzaKw: 75, taraKg: 1000, taraCampo: 'G1' }).esito).toBe('si');
  });

  test('il confronto e\' sul valore esatto, non arrotondato', () => {
    // 88 kW / 1173 kg = 75,02 kW/t: oltre il limite anche se arrotondato fa 75,0
    const poco = idoneitaNeopatentati({ potenzaKw: 88, taraKg: 1173, taraCampo: 'G1' });
    expect(poco.esito).toBe('no');
    expect(poco.motivo).toMatch(/75,03 kW\/t, oltre il limite di 75/);
    // 90 kW / 1200 kg = 75 esatti: consentito (nessun errore di virgola mobile)
    expect(idoneitaNeopatentati({ potenzaKw: 90, taraKg: 1200, taraCampo: 'G1' }).esito).toBe('si');
    // con il campo G il peso e' 75 kg in piu': 90 kW su 1125 + 75 kg = 75 esatti
    expect(idoneitaNeopatentati({ potenzaKw: 90, taraKg: 1125, taraCampo: 'G' }).esito).toBe('si');
    expect(idoneitaNeopatentati({ potenzaKw: 90.1, taraKg: 1125, taraCampo: 'G' }).esito).toBe('no');
    // 105 kW (con peso alto) consentito, 105,1 no
    expect(idoneitaNeopatentati({ potenzaKw: 105, taraKg: 1400 }).esito).toBe('si');
    expect(idoneitaNeopatentati({ potenzaKw: 105.1, taraKg: 1500 }).esito).toBe('no');
    // appena sotto il limite
    expect(idoneitaNeopatentati({ potenzaKw: 101, taraKg: 1347, taraCampo: 'G1' }).esito).toBe('si');
  });

  test('avvisi: elettriche e ibride riconosciute, testo fisso presente', () => {
    ['Elettrico', 'Ibrido', 'Ibrida plug-in', 'Hybrid'].forEach((a) => expect(eElettricaOIbrida(a)).toBe(true));
    ['Benzina', 'Diesel', 'GPL', '', undefined].forEach((a) => expect(eElettricaOIbrida(a)).toBe(false));
    expect(AVVISO_CONTROLLO).toMatch(/resta del noleggiatore/);
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

describe('registro del controllo', () => {
  const adesso = new Date('2026-10-20T09:30:00Z');
  test('neopatentato con auto oltre i limiti: dati, esito e versione della regola', () => {
    const r = registroControllo({ veicolo: { targa: 'AB123CD', carburante: 'Benzina', potenzaKw: 88, taraKg: 1173, taraCampo: 'G1' }, rilascio: '2025-03-14', ritiro: '2026-10-20', operatore: 'staff@example.com', adesso });
    expect(r.esito).toBe('no');
    expect(r.neopatentato).toBe(true);
    expect(r.finoAl).toBe('2028-03-14');
    expect(r.controllatoDa).toBe('staff@example.com');
    expect(r.controllatoIl).toBe('2026-10-20T09:30:00.000Z');
    expect(r.veicolo).toMatchObject({ targa: 'AB123CD', potenzaKw: 88, taraKg: 1173, taraCampo: 'G1', massaUsataKg: 1173, kwPerTonnellata: 75.02, limiti: { kwPerTonnellata: 75, kwMax: 105 } });
    expect(r.versioneRegola).toMatchObject({ aggiornatoAl: LIMITI_NEOPATENTATI.aggiornatoAl, anni: 3 });
  });
  test('con il campo G il registro dice con quale peso e stato calcolato', () => {
    const r = registroControllo({ veicolo: { targa: 'X', potenzaKw: 55, taraKg: 1050, taraCampo: 'G' }, rilascio: '2025-03-14', ritiro: '2026-10-20', adesso });
    expect(r.veicolo).toMatchObject({ taraKg: 1050, taraCampo: 'G', massaUsataKg: 1125, kwPerTonnellata: 48.89 });
    expect(r.esito).toBe('si');
  });
  test('non neopatentato, data mancante, dati mancanti', () => {
    expect(registroControllo({ veicolo: panda, rilascio: '2019-01-01', ritiro: '2026-10-20', adesso }).esito).toBe('non-applicabile');
    expect(registroControllo({ veicolo: panda, rilascio: '', ritiro: '2026-10-20', adesso }).esito).toBe('data-patente-mancante');
    expect(registroControllo({ veicolo: { targa: 'X' }, rilascio: '2025-03-14', ritiro: '2026-10-20', adesso }).esito).toBe('nd');
  });
});

describe('tipo di veicolo', () => {
  const potenteKw = { potenzaKw: 110, taraKg: 1800 }; // 61 kW/t ma 110 kW
  test('autovettura e camper: anche il limite dei 105 kW; senza tipo vale autovettura', () => {
    expect(idoneitaNeopatentati({ ...potenteKw, tipoVeicolo: 'autovettura' }).esito).toBe('no');
    expect(idoneitaNeopatentati({ ...potenteKw, tipoVeicolo: 'camper' }).esito).toBe('no');
    expect(idoneitaNeopatentati({ ...potenteKw }).esito).toBe('no');
  });
  test('furgone: solo 75 kW/t, nessun limite in kW', () => {
    const f = idoneitaNeopatentati({ ...potenteKw, tipoVeicolo: 'furgone' });
    expect(f.esito).toBe('si');
    expect(f.limiti.kwMax).toBeNull();
    expect(f.motivo).not.toMatch(/105/);
    expect(idoneitaNeopatentati({ potenzaKw: 90, taraKg: 1000, tipoVeicolo: 'furgone' }).esito).toBe('no');
  });
  test('moto e imbarcazione: non soggetti, anche senza potenza e tara', () => {
    ['moto', 'imbarcazione'].forEach((tipoVeicolo) => {
      const r = idoneitaNeopatentati({ tipoVeicolo });
      expect(r.esito).toBe('si');
      expect(r.soggetto).toBe(false);
    });
    expect(controlloAbbinamento({ veicolo: { tipoVeicolo: 'imbarcazione' }, rilascio: '2025-03-14', ritiro: '2026-10-20' }).ok).toBe(true);
  });
  test('il registro ricorda il tipo', () => {
    expect(registroControllo({ veicolo: { tipoVeicolo: 'furgone', potenzaKw: 70, taraKg: 1500 }, rilascio: '2025-03-14', ritiro: '2026-10-20' }).veicolo.tipoVeicolo).toBe('furgone');
  });
});

describe('limiti di velocita', () => {
  test('valgono 3 anni per tutte le patenti, anche prima del 14/12/2024', () => {
    expect(statoVelocita('2024-03-01', '2026-10-20')).toEqual({ soggetto: true, finoAl: '2027-03-01' });
    expect(statoVelocita('2025-03-14', '2026-10-20').soggetto).toBe(true);
    // la potenza invece non riguarda le patenti prima del 14/12/2024
    expect(statoPatente('2024-03-01', '2026-10-20').neopatentato).toBe(false);
  });
  test('scaduti, o data mancante', () => {
    expect(statoVelocita('2023-10-20', '2026-10-20').soggetto).toBe(false);
    expect(statoVelocita('2023-10-21', '2026-10-20').soggetto).toBe(true);
    expect(statoVelocita('', '2026-10-20').soggetto).toBeNull();
  });
  test('testo e registro', () => {
    expect(testoVelocita('2027-03-01')).toMatch(/Fino al 01\/03\/2027.*100 km\/h.*90 km\/h/);
    expect(registroControllo({ veicolo: panda, rilascio: '2024-03-01', ritiro: '2026-10-20' }).limiteVelocita).toEqual({ soggetto: true, finoAl: '2027-03-01' });
  });
});
