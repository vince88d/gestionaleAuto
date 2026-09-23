import {
  applicaTariffe, differenzeTariffe, normalizzaTariffe, perSalvataggio, prezzoCategoria, suggerisciTariffe,
  tariffeDaCampi,
} from './tariffe';

describe('normalizzaTariffe', () => {
  it('tiene solo i prezzi validi', () => {
    expect(normalizzaTariffe({ 'City Car': 25, SUV: '60', Furgone: 0, Berlina: -5, Lusso: 'abc', Cabrio: null })).toEqual({
      'City Car': 25,
      SUV: 60,
    });
  });
  it('dati assenti o di tipo sbagliato', () => {
    expect(normalizzaTariffe(undefined)).toEqual({});
    expect(normalizzaTariffe(null)).toEqual({});
    expect(normalizzaTariffe('25')).toEqual({});
  });
});

describe('prezzoCategoria (stessa regola del server)', () => {
  const auto = [{ prezzo: 30 }, { prezzo: 25 }];
  it('la tariffa ha la precedenza', () => expect(prezzoCategoria('City Car', { 'City Car': 35 }, auto)).toBe(35));
  it('senza tariffa: il prezzo più basso delle auto', () => expect(prezzoCategoria('City Car', {}, auto)).toBe(25));
  it('usa il prezzo originale del veicolo se presente', () => {
    expect(prezzoCategoria('City Car', {}, [{ prezzo: 99, prezzoVeicolo: 27 }])).toBe(27);
  });
  it('nessuna tariffa né prezzo valido: non calcolabile', () => {
    expect(prezzoCategoria('City Car', {}, [{ prezzo: '' }, {}])).toBeUndefined();
  });
  it('ignora la tariffa di un\'altra categoria', () => expect(prezzoCategoria('City Car', { SUV: 60 }, auto)).toBe(25));
});

describe('applicaTariffe e perSalvataggio', () => {
  const veicoli = [
    { id: 'a', categoria: 'City Car', prezzo: 30 },
    { id: 'b', categoria: 'SUV', prezzo: 35 },
    { id: 'c', categoria: 'Berlina' },
  ];

  it('il veicolo prende il prezzo della sua categoria e conserva quello originale', () => {
    const [a, b, c] = applicaTariffe(veicoli, { 'City Car': 25, SUV: 40 });
    expect(a).toMatchObject({ prezzo: 25, prezzoVeicolo: 30 });
    expect(b).toMatchObject({ prezzo: 40, prezzoVeicolo: 35 });
    expect(c).toBe(veicoli[2]);
  });

  it('senza tariffe i veicoli restano com\'erano', () => {
    expect(applicaTariffe(veicoli, {})).toEqual(veicoli);
    expect(applicaTariffe(veicoli, undefined)).toEqual(veicoli);
  });

  it('non modifica i dati di partenza', () => {
    applicaTariffe(veicoli, { 'City Car': 25 });
    expect(veicoli[0].prezzo).toBe(30);
  });

  it('applicare due volte non perde il prezzo originale', () => {
    const due = applicaTariffe(applicaTariffe(veicoli, { 'City Car': 25 }), { 'City Car': 28 });
    expect(due[0]).toMatchObject({ prezzo: 28, prezzoVeicolo: 30 });
  });

  it('prima di salvare torna il prezzo originale, senza campi in più', () => {
    const [a] = applicaTariffe(veicoli, { 'City Car': 25 });
    expect(perSalvataggio(a)).toEqual({ id: 'a', categoria: 'City Car', prezzo: 30 });
  });

  it('un veicolo senza prezzo non ne riceve uno alla scrittura (Firestore rifiuta undefined)', () => {
    const [c] = applicaTariffe([{ id: 'c', categoria: 'Berlina' }], { Berlina: 50 });
    expect(c).toMatchObject({ prezzo: 50, prezzoVeicolo: undefined });
    expect(perSalvataggio(c)).toEqual({ id: 'c', categoria: 'Berlina' });
  });

  it('un veicolo non toccato dalle tariffe passa invariato', () => {
    expect(perSalvataggio(veicoli[0])).toBe(veicoli[0]);
  });
});

describe('suggerisciTariffe', () => {
  it('il prezzo più basso di ogni categoria', () => {
    expect(
      suggerisciTariffe([
        { categoria: 'City Car', prezzo: 30 },
        { categoria: 'City Car', prezzo: '25' },
        { categoria: 'SUV', prezzo: 35 },
        { categoria: 'Berlina', prezzo: '' },
        { prezzo: 10 },
      ]),
    ).toEqual({ 'City Car': 25, SUV: 35 });
  });
});

describe('tariffeDaCampi', () => {
  it('converte i campi in prezzi, accettando la virgola', () => {
    expect(tariffeDaCampi({ 'City Car': '25', SUV: '39,90' })).toEqual({ prezziGiorno: { 'City Car': 25, SUV: 39.9 }, errori: [] });
  });
  it('un campo vuoto toglie la tariffa', () => {
    expect(tariffeDaCampi({ 'City Car': '', SUV: '40' })).toEqual({ prezziGiorno: { SUV: 40 }, errori: [] });
  });
  it('segnala i valori non validi', () => {
    expect(tariffeDaCampi({ 'City Car': '0', SUV: 'abc', Furgone: '-3', Berlina: '50' })).toEqual({
      prezziGiorno: { Berlina: 50 },
      errori: ['City Car', 'SUV', 'Furgone'],
    });
  });
});

describe('differenzeTariffe', () => {
  it('nessuna differenza se sono uguali', () => {
    expect(differenzeTariffe({ 'City Car': 25 }, { 'City Car': 25 })).toEqual([]);
  });
  it('segnala prezzo cambiato, nuovo e tolto, in ordine alfabetico', () => {
    expect(differenzeTariffe(
      { 'City Car': 28, Van: 60 },
      { 'City Car': 25, SUV: 35 },
    )).toEqual([
      { categoria: 'City Car', prima: 25, dopo: 28 },
      { categoria: 'SUV', prima: 35, dopo: undefined },
      { categoria: 'Van', prima: undefined, dopo: 60 },
    ]);
  });
});
