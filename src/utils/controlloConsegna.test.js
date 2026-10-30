import { erroriConsegna, riassuntoErrori, identitaConsegna } from './controlloConsegna';

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

test('i danni segnati senza descrizione si chiedono per ultimi', () => {
  const errori = erroriConsegna({ carburante: '1/2', km: 10, danniSenzaDescrizione: 2 });
  expect(errori.map((e) => e.campo)).toEqual(['danni']);
  expect(riassuntoErrori(errori)).toBe('Manca: descrizione dei danni');
});

describe('straniero senza codice fiscale e copia cartacea', () => {
  const base = { carburante: 'Pieno', km: '10', senzaCodiceFiscale: true };

  test('senza codice fiscale servono nascita e documento', () => {
    expect(erroriConsegna(base).map((e) => e.campo)).toEqual(['dataNascita', 'luogoNascita', 'tipoDocumento', 'documento']);
    expect(erroriConsegna({ ...base, dataNascita: '1990-05-01', luogoNascita: 'Berlino', tipoDocumento: 'Passaporto', documento: 'C01' })).toEqual([]);
    expect(erroriConsegna({ ...base, tipoDocumento: 'Altro', dataNascita: '1990-05-01', luogoNascita: 'B', documento: 'C01' }).map((e) => e.campo)).toEqual(['tipoDocumentoAltro']);
  });

  test('con la copia cartacea non bloccano codice fiscale, documento e nascita, ma la patente si', () => {
    expect(erroriConsegna({ ...base, copiaCartacea: true })).toEqual([]);
    expect(erroriConsegna({ carburante: 'Pieno', km: '10', chiediCodiceFiscale: true, codiceFiscaleValido: false, copiaCartacea: true })).toEqual([]);
    expect(erroriConsegna({ ...base, copiaCartacea: true, chiediPatente: true, patente: '' }).map((e) => e.campo)).toEqual(['patente']);
    expect(erroriConsegna({ ...base, copiaCartacea: true, chiediScadenza: true }).map((e) => e.campo)).toEqual(['scadenzaPatente']);
  });

  test('senza copia cartacea il codice fiscale mancante blocca come prima', () => {
    expect(erroriConsegna({ carburante: 'Pieno', km: '10', chiediCodiceFiscale: true, codiceFiscaleValido: false }).map((e) => e.campo)).toEqual(['codiceFiscale']);
  });

  test('identitaConsegna: vince quello scritto, poi prenotazione, poi anagrafica', () => {
    const r = identitaConsegna({
      prenotazione: { senzaCodiceFiscale: true, luogoNascita: 'Berlino' },
      cliente: { dataNascita: '1990-05-01', luogoNascita: 'Bonn' },
      documenti: { documento: 'C01' },
    });
    expect(r).toEqual(expect.objectContaining({ senzaCodiceFiscale: true, dataNascita: '1990-05-01', luogoNascita: 'Berlino', documento: 'C01', copiaCartacea: false }));
    expect(identitaConsegna({ prenotazione: { senzaCodiceFiscale: true }, documenti: { senzaCodiceFiscale: false } }).senzaCodiceFiscale).toBe(false);
  });
});
