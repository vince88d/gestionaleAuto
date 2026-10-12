import { erroriConsegna, riassuntoErrori } from './controlloConsegna';

test('tutto compilato: nessun errore', () => {
  expect(erroriConsegna({ carburante: '3/4', km: '45000' })).toEqual([]);
  expect(erroriConsegna({ carburante: 'Pieno', km: 0 })).toEqual([]); // 0 km va bene
});

test('carburante e km mancanti, nell\'ordine della finestra', () => {
  const e = erroriConsegna({ carburante: '', km: '' });
  expect(e.map((x) => x.campo)).toEqual(['carburante', 'km']);
  expect(riassuntoErrori(e)).toBe('Manca: carburante e km');
});

test('documenti richiesti solo se la prenotazione non li ha', () => {
  expect(erroriConsegna({ carburante: 'Pieno', km: 1, chiediPatente: false, patente: '', chiediScadenza: false })).toEqual([]);
  const e = erroriConsegna({
    chiediCodiceFiscale: true, codiceFiscaleValido: false, chiediPatente: true, patente: '  ', chiediScadenza: true, scadenzaPatente: '',
    carburante: '', km: '',
  });
  expect(e.map((x) => x.campo)).toEqual(['codiceFiscale', 'patente', 'scadenzaPatente', 'carburante', 'km']);
  expect(riassuntoErrori(e)).toBe('Manca: codice fiscale, numero patente, scadenza patente, carburante e km');
});

test('km negativi o non numerici non vanno bene', () => {
  expect(erroriConsegna({ carburante: 'Pieno', km: '-5' }).map((x) => x.campo)).toEqual(['km']);
  expect(erroriConsegna({ carburante: 'Pieno', km: 'abc' }).map((x) => x.campo)).toEqual(['km']);
});

test('riassunto vuoto senza errori', () => {
  expect(riassuntoErrori([])).toBe('');
});
