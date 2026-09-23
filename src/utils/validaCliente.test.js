import { preparaCliente, clientePerForm, validaCliente, prenotazioniDelCliente } from './validaCliente';

jest.mock('../components/firebase', () => ({ db: {} }));

const base = { nome: 'Mario', cognome: 'Rossi', codiceFiscale: 'rssmra80a01h501u', patente: 'ab123', email: 'mario@example.it' };

describe('preparaCliente', () => {
  test('codice fiscale e patente in maiuscolo, spazi tolti, niente indice', () => {
    const c = preparaCliente({ ...base, nome: ' Mario ', index: 3, tipoDocumento: 'CI' });
    expect(c).toEqual(expect.objectContaining({ nome: 'Mario', codiceFiscale: 'RSSMRA80A01H501U', patente: 'AB123', tipoDocumento: 'CI', tipoDocumentoAltro: '' }));
    expect(c.index).toBeUndefined();
  });
  test('"Altro" diventa il tipo scritto a mano, e torna "Altro" nel form', () => {
    const c = preparaCliente({ ...base, tipoDocumento: 'Altro', tipoDocumentoAltro: 'Tessera ordine' });
    expect(c.tipoDocumento).toBe('Tessera ordine');
    expect(clientePerForm(c)).toEqual(expect.objectContaining({ tipoDocumento: 'Altro', tipoDocumentoAltro: 'Tessera ordine' }));
  });
});

describe('validaCliente', () => {
  test('cliente completo: nessun errore', () => {
    expect(validaCliente(preparaCliente(base))).toEqual({});
  });
  test('campi obbligatori e formato', () => {
    const e = validaCliente({ codiceFiscale: 'ABC', email: 'no' });
    expect(Object.keys(e).sort()).toEqual(['codiceFiscale', 'cognome', 'email', 'nome', 'patente']);
  });
  test('codice fiscale gia\' di un altro cliente; non se e\' lo stesso', () => {
    const altri = [{ id: 'RSSMRA80A01H501U', codiceFiscale: 'RSSMRA80A01H501U' }];
    expect(validaCliente(preparaCliente(base), altri).codiceFiscale).toMatch(/già di un altro/);
    expect(validaCliente(preparaCliente(base), altri, 'RSSMRA80A01H501U')).toEqual({});
  });
});

test('prenotazioni del cliente senza badare alle maiuscole', () => {
  const p = [{ id: 'a', codiceFiscale: 'rssmra80a01h501u' }, { id: 'b', codiceFiscale: 'ALTRO' }, { id: 'c' }];
  expect(prenotazioniDelCliente('RSSMRA80A01H501U', p).map((x) => x.id)).toEqual(['a']);
});

describe('cercaClienti', () => {
  const { cercaClienti } = require('./validaCliente');
  const clienti = [
    { id: '1', nome: 'Mario', cognome: 'Rossi', codiceFiscale: 'RSSMRA80A01H501U', telefono: '333111' },
    { id: '2', nome: 'Maria', cognome: 'Bianchi', codiceFiscale: 'BNCMRA85B41F205X', ragioneSociale: 'Bianchi srl' },
  ];
  const prenotazioni = [{ codiceFiscale: 'rssmra80a01h501u', targa: 'AB123CD' }];
  test('piu\' parole, codice fiscale, telefono, azienda e targa noleggiata', () => {
    expect(cercaClienti(clienti, 'mario rossi').map((c) => c.id)).toEqual(['1']);
    expect(cercaClienti(clienti, 'bncmra').map((c) => c.id)).toEqual(['2']);
    expect(cercaClienti(clienti, '333').map((c) => c.id)).toEqual(['1']);
    expect(cercaClienti(clienti, 'srl').map((c) => c.id)).toEqual(['2']);
    expect(cercaClienti(clienti, 'ab123', prenotazioni).map((c) => c.id)).toEqual(['1']);
    expect(cercaClienti(clienti, '  ')).toHaveLength(2);
  });
});

describe('controllaPatente', () => {
  const { controllaPatente } = require('./validaCliente');
  const periodo = { ritiro: '2026-10-01', riconsegna: '2026-10-05' };
  test('scaduta prima del ritiro: blocca; scade durante: avviso; poi: ok', () => {
    expect(controllaPatente('2026-09-30', periodo).blocca).toMatch(/scaduta il 30\/09\/2026/);
    expect(controllaPatente('2026-10-03', periodo).avviso).toMatch(/prima della riconsegna/);
    expect(controllaPatente('2027-01-01', periodo)).toEqual({});
    expect(controllaPatente('', periodo)).toEqual({});
  });
});

test('clienteDaPrenotazione separa nome e cognome e prende la patente della consegna', () => {
  const { clienteDaPrenotazione } = require('./validaCliente');
  const c = clienteDaPrenotazione(
    { cliente: 'Anna Maria Verdi', codiceFiscale: 'vrdnmr90a41h501x', emailCliente: 'a@b.it', telefono: '333', origine: 'sito' },
    { patente: ' ab12 ', scadenzaPatente: '2030-01-01' });
  expect(c).toEqual({ nome: 'Anna', cognome: 'Maria Verdi', codiceFiscale: 'VRDNMR90A41H501X', email: 'a@b.it', telefono: '333', patente: 'AB12', scadenzaPatente: '2030-01-01', origine: 'sito' });
});
