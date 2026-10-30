import {
  dateRapide, giorniDelNoleggio, statoPassi, validaNuovaPrenotazione, datiDaCliente, documentiCompleti,
} from './nuovaPrenotazione';

jest.mock('../lib/firestoreClienti', () => ({
  normalizzaCodiceFiscale: (cf) => String(cf || '').replace(/\s+/g, '').toUpperCase(),
}));

const OGGI = '2026-10-01';

describe('dateRapide', () => {
  test('parte dalla data scelta o da oggi', () => {
    expect(dateRapide('1g', '2026-10-03', OGGI)).toEqual({ dataInizio: '2026-10-03', dataFine: '2026-10-04' });
    expect(dateRapide('3g', '', OGGI)).toEqual({ dataInizio: OGGI, dataFine: '2026-10-04' });
    expect(dateRapide('1s', '2026-10-28', OGGI)).toEqual({ dataInizio: '2026-10-28', dataFine: '2026-11-04' });
  });

  test('un mese: fine mese non sconfina', () => {
    expect(dateRapide('1m', '2026-10-05', OGGI).dataFine).toBe('2026-11-05');
    expect(dateRapide('1m', '2027-01-31', OGGI).dataFine).toBe('2027-02-28');
  });

  test('scelta sconosciuta', () => {
    expect(dateRapide('boh', '', OGGI)).toBeNull();
  });
});

describe('statoPassi e giorni', () => {
  test('giorni come le catene: 24 ore, minimo 1', () => {
    expect(giorniDelNoleggio({ dataInizio: '2026-10-03', dataFine: '2026-10-08' })).toBe(5);
    expect(giorniDelNoleggio({ dataInizio: '2026-10-03', dataFine: '2026-10-03' })).toBe(1);
    expect(giorniDelNoleggio({ dataInizio: '2026-10-08', dataFine: '2026-10-03' })).toBe(0);
  });

  test('passo attivo: quando, poi auto, poi cliente', () => {
    expect(statoPassi({}).attivo).toBe(1);
    expect(statoPassi({ dataInizio: '2026-10-03', dataFine: '2026-10-08' }).attivo).toBe(2);
    expect(statoPassi({ dataInizio: '2026-10-03', dataFine: '2026-10-08', targa: 'AA' })).toEqual(
      { quando: true, auto: true, chi: false, attivo: 3 },
    );
  });
});

describe('validaNuovaPrenotazione', () => {
  const base = {
    dataInizio: '2026-10-03', dataFine: '2026-10-08', targa: 'ABC004', prezzoGiornaliero: '35',
    cliente: 'Vincenzo Sciarretta', telefono: '333 1234567',
  };

  test('bastano date, auto, prezzo, nome e telefono', () => {
    expect(validaNuovaPrenotazione(base)).toEqual({});
  });

  test('codice fiscale, patente ed email non obbligatori, ma se scritti vanno giusti', () => {
    expect(validaNuovaPrenotazione({ ...base, codiceFiscale: 'abc' }).codiceFiscale).toBeTruthy();
    expect(validaNuovaPrenotazione({ ...base, codiceFiscale: 'rssmra80a01h501u' })).toEqual({});
    expect(validaNuovaPrenotazione({ ...base, emailCliente: 'nonvalida' }).emailCliente).toBeTruthy();
  });

  test('serve un contatto: telefono o email', () => {
    expect(validaNuovaPrenotazione({ ...base, telefono: '' }).telefono).toBeTruthy();
    expect(validaNuovaPrenotazione({ ...base, telefono: '', emailCliente: 'a@b.it' })).toEqual({});
  });

  test('segnala cosa manca', () => {
    const errori = validaNuovaPrenotazione({});
    expect(Object.keys(errori).sort()).toEqual(['cliente', 'dataFine', 'dataInizio', 'targa']);
    expect(validaNuovaPrenotazione({ ...base, dataFine: '2026-10-01' }).dataFine).toMatch(/prima/);
    expect(validaNuovaPrenotazione({ ...base, prezzoGiornaliero: '' }).prezzoGiornaliero).toBeTruthy();
  });
});

describe('cliente dall\'anagrafica', () => {
  test('nome, contatti e documenti', () => {
    const c = { nome: 'Mario', cognome: 'Rossi', cellulare: '333', email: 'm@r.it', codiceFiscale: 'rssmra80a01h501u', patente: 'ab12' };
    expect(datiDaCliente(c)).toEqual({
      cliente: 'Mario Rossi', telefono: '333', emailCliente: 'm@r.it', codiceFiscale: 'RSSMRA80A01H501U', patente: 'AB12', rilascioPatente: '',
    });
    expect(datiDaCliente({ ...c, rilascioPatente: '2025-03-14' }).rilascioPatente).toBe('2025-03-14');
    expect(documentiCompleti(c)).toBe(true);
    expect(documentiCompleti({ ...c, patente: '' })).toBe(false);
  });
});

describe('straniero senza codice fiscale nella nuova prenotazione', () => {
  const { documentiCompleti, datiDaCliente } = require('./nuovaPrenotazione');
  test('documenti completi con nascita e documento al posto del codice fiscale', () => {
    const c = { senzaCodiceFiscale: true, patente: 'AB123', dataNascita: '1990-05-01', luogoNascita: 'Berlino', tipoDocumento: 'Passaporto', documento: 'C01' };
    expect(documentiCompleti(c)).toBe(true);
    expect(documentiCompleti({ ...c, documento: '' })).toBe(false);
    expect(documentiCompleti({ ...c, patente: '' })).toBe(false);
    expect(documentiCompleti({ patente: 'AB123' })).toBe(false);
  });
  test('scegliendo il cliente si porta dietro il codice interno e i dati dello straniero', () => {
    const d = datiDaCliente({ id: 'int-1', nome: 'Hans', cognome: 'Muller', senzaCodiceFiscale: true, dataNascita: '1990-05-01', documento: 'C01' });
    expect(d).toEqual(expect.objectContaining({ idCliente: 'int-1', senzaCodiceFiscale: true, dataNascita: '1990-05-01', documento: 'C01' }));
    expect(datiDaCliente({ id: 'RSS', nome: 'Mario', codiceFiscale: 'rss' }).senzaCodiceFiscale).toBeUndefined();
  });
});
