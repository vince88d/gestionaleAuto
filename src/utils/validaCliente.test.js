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
