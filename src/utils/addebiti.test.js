import {
  normalizzaAddebiti, validaAddebiti, addebitiPerForm, preparaAddebiti, ADDEBITI_DI_PARTENZA, SITO_DI_PARTENZA,
  nuovaVoce, vociLibereListino, vociPerSito,
} from './addebiti';

describe('listino penali e addebiti', () => {
  it('parte dai prezzi di partenza, senza voci libere', () => {
    expect(normalizzaAddebiti(undefined)).toEqual({ ...ADDEBITI_DI_PARTENZA, sito: SITO_DI_PARTENZA, tolte: [], voci: [] });
  });

  it('legge gli importi all\'italiana e scarta quelli sbagliati', () => {
    const n = normalizzaAddebiti({ rifornimentoQuarto: '25,50', pulizia: '-3', chiave: 'ciao', oggettoMancante: 0 });
    expect(n).toMatchObject({ rifornimentoQuarto: 25.5, pulizia: 30, chiave: 150, oggettoMancante: 0, gestioneMulta: 30 });
  });

  it('un documento salvato prima (4 prezzi) funziona: la multa parte da 30', () => {
    const n = normalizzaAddebiti({ rifornimentoQuarto: 20, pulizia: 30, chiave: 150, oggettoMancante: 15 });
    expect(n.gestioneMulta).toBe(30);
    expect(n.sito).toEqual(SITO_DI_PARTENZA);
  });

  it('quali voci mostrare sul sito: solo i booleani veri contano', () => {
    const n = normalizzaAddebiti({ sito: { pulizia: false, oggettoMancante: true, chiave: 'si' } });
    expect(n.sito.pulizia).toBe(false);
    expect(n.sito.oggettoMancante).toBe(true);
    expect(n.sito.chiave).toBe(true);
  });

  it('voci libere: senza nome si scartano, importo sbagliato = 0, modo di partenza «una volta»', () => {
    const n = normalizzaAddebiti({
      voci: [
        { id: 'a', nome: ' Fumo ', importo: '80,00', modo: 'giorno', descrizione: ' Vietato fumare ', sito: false },
        { id: 'b', nome: '', importo: 5 },
        { id: 'c', nome: 'Sabbia', importo: 'x' },
        { id: 'a', nome: 'Doppione', importo: 1 },
      ],
    });
    expect(n.voci).toEqual([
      { id: 'a', nome: 'Fumo', importo: 80, modo: 'giorno', descrizione: 'Vietato fumare', sito: false, attiva: true },
      { id: 'c', nome: 'Sabbia', importo: 0, modo: 'volta', descrizione: '', sito: true, attiva: true },
    ]);
  });

  it('valida: vuoto e non numeri sono errori, 0 va bene; le voci vogliono nome e importo', () => {
    const errori = validaAddebiti({
      rifornimentoQuarto: '', kmInPiu: '0,25', pulizia: 'x', chiave: '0', oggettoMancante: '15', gestioneMulta: '30',
      voci: [{ nome: '', importo: '10' }, { nome: 'Fumo', importo: '' }, { nome: 'Ok', importo: '5' }],
    });
    expect(Object.keys(errori).sort()).toEqual(['pulizia', 'rifornimentoQuarto', 'voci.0.nome', 'voci.1.importo']);
  });

  it('scrive le caselle del form e torna ai valori da salvare', () => {
    const f = addebitiPerForm({ rifornimentoQuarto: 20.5, voci: [{ id: 'a', nome: 'Fumo', importo: 80 }] });
    expect(f.rifornimentoQuarto).toBe('20,5');
    expect(f.voci[0].importo).toBe('80');
    expect(preparaAddebiti(f).voci[0].importo).toBe(80);
    expect(nuovaVoce()).toMatchObject({ nome: '', modo: 'volta', sito: true });
  });

  it('voci del rientro: «al giorno» moltiplica per i giorni, importo 0 non si propone', () => {
    const prezzi = normalizzaAddebiti({
      voci: [{ id: 'a', nome: 'Fumo', importo: 80 }, { id: 'b', nome: 'Seggiolino sporco', importo: 10, modo: 'giorno' }, { id: 'c', nome: 'Gratis', importo: 0 }],
    });
    const righe = vociLibereListino(prezzi, 3);
    expect(righe.map((r) => [r.id, r.importo, r.attiva, r.gruppo])).toEqual([
      ['listino:a', 80, false, 'listino'], ['listino:b', 30, false, 'listino'],
    ]);
  });

  it('per il sito: solo le voci accese e a pagamento, ritardo con la tolleranza', () => {
    const v = vociPerSito({
      sito: { pulizia: false, gestioneMulta: true, ritardo: true },
      voci: [{ id: 'a', nome: 'Fumo', importo: 80, descrizione: 'Vietato fumare' }, { id: 'b', nome: 'Nascosta', importo: 5, sito: false }],
    }, 29);
    expect(v.map((r) => `${r.nome}: ${r.testo}`)).toEqual([
      'Rifornimento: 20 € per quarto',
      'Km in più: 0,25 € per km',
      'Chiave non restituita: 150 € per chiave',
      'Gestione multa: 30 € per verbale',
      'Fumo: 80 €',
      'Ritardo nella riconsegna: oltre 29 minuti si paga un giorno in più',
    ]);
    // Importo 0 = gratis: non si mostra.
    expect(vociPerSito({ rifornimentoQuarto: 0 }, 0).some((r) => r.id === 'rifornimentoQuarto')).toBe(false);
  });
});

describe('voci tolte', () => {
  test('una voce tolta non si mostra sul sito ma tiene l\'importo', () => {
    const n = normalizzaAddebiti({ pulizia: 40, tolte: ['pulizia', 'inventata'], sito: { pulizia: true } });
    expect(n.tolte).toEqual(['pulizia']);
    expect(n.pulizia).toBe(40);
    expect(n.sito.pulizia).toBe(false);
    expect(vociPerSito(n).some((r) => r.id === 'pulizia')).toBe(false);
  });
});
