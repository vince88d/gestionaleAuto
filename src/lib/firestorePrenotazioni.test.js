import { doc, updateDoc, runTransaction, setDoc } from 'firebase/firestore';
import {
  isPrenotazioneVisibile, isPagataOnline, segnaDannoPrenotazioneRiparato,
  aggiornaPrenotazione, salvaPrenotazione, registraConsegna, PrenotazioneCambiata,
} from './firestorePrenotazioni';
import { readClienti, aggiungiContrattoCliente, creaCliente, aggiornaCampiCliente } from './firestoreClienti';

// Niente connessione a Firebase nei test: qui servono solo le funzioni pure.
jest.mock('../components/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), getDocs: jest.fn(), doc: jest.fn(), setDoc: jest.fn(),
  updateDoc: jest.fn(), deleteDoc: jest.fn(), runTransaction: jest.fn(),
}));
jest.mock('./firestoreClienti', () => ({
  readClienti: jest.fn(), aggiungiContrattoCliente: jest.fn(), creaCliente: jest.fn(), aggiornaCampiCliente: jest.fn(),
  normalizzaCodiceFiscale: (v) => (v || '').trim().toUpperCase(),
}));

describe('isPrenotazioneVisibile', () => {
  test.each([
    ['attiva', true],
    ['completata', true],
    ['annullata', false], // rimborsata o annullata: resta come storico, non nelle liste di lavoro
    ['richiesta-sito', false],
    ['scaduta', false],
    ['pagamento-fallito', false],
  ])('stato %s -> visibile: %s', (status, atteso) => {
    expect(isPrenotazioneVisibile({ status })).toBe(atteso);
  });
});

describe('isPagataOnline', () => {
  test('vera solo con un pagamento Stripe e prenotazione attiva', () => {
    expect(isPagataOnline({ paymentIntentId: 'pi_1', status: 'attiva' })).toBe(true);
    expect(isPagataOnline({ paymentIntentId: 'pi_1', status: 'annullata' })).toBe(false);
    expect(isPagataOnline({ paymentIntentId: 'pi_1', status: 'richiesta-sito' })).toBe(false);
    expect(isPagataOnline({ status: 'attiva' })).toBe(false); // creata dal gestionale
    expect(isPagataOnline(undefined)).toBe(false);
  });
});

describe('segnaDannoPrenotazioneRiparato', () => {
  test('aggiorna su Firestore solo i campi della riparazione', async () => {
    doc.mockImplementation((_db, collezione, id) => `${collezione}/${id}`);
    updateDoc.mockResolvedValue();
    const campi = await segnaDannoPrenotazioneRiparato('p1', '2026-09-23T10:00:00.000Z');
    expect(updateDoc).toHaveBeenCalledWith('prenotazioni/p1', { daRiparare: false, riparatoIn: '2026-09-23T10:00:00.000Z' });
    expect(campi).toEqual({ daRiparare: false, riparatoIn: '2026-09-23T10:00:00.000Z' });
  });
});

// Transazione finta: il documento "attuale" e' `datiAttuali` (null = non esiste).
function transazioneCon(datiAttuali) {
  const t = {
    get: jest.fn().mockResolvedValue({ exists: () => datiAttuali !== null, data: () => datiAttuali }),
    update: jest.fn(),
    set: jest.fn(),
  };
  runTransaction.mockImplementation(async (_db, fn) => fn(t));
  return t;
}

describe('aggiornaPrenotazione', () => {
  beforeEach(() => doc.mockImplementation((_db, collezione, id) => `${collezione}/${id}`));

  test('aggiorna solo i campi passati, senza undefined', async () => {
    const t = transazioneCon({ status: 'attiva' });
    await aggiornaPrenotazione('p1', { status: 'completata', note: undefined }, { statoAtteso: 'attiva' });
    expect(t.update).toHaveBeenCalledWith('prenotazioni/p1', { status: 'completata' });
  });

  test('si ferma se nel frattempo il cliente l\'ha annullata dal sito', async () => {
    const t = transazioneCon({ status: 'annullata' });
    await expect(aggiornaPrenotazione('p1', { status: 'completata' }, { statoAtteso: 'attiva' }))
      .rejects.toThrow(/annullata nel frattempo/);
    expect(t.update).not.toHaveBeenCalled();
  });

  test('si ferma se la prenotazione non esiste piu\'', async () => {
    transazioneCon(null);
    await expect(aggiornaPrenotazione('p1', {}, {})).rejects.toBeInstanceOf(PrenotazioneCambiata);
  });
});

describe('salvaPrenotazione', () => {
  beforeEach(() => {
    doc.mockImplementation((_db, collezione, id) => `${collezione}/${id}`);
    setDoc.mockResolvedValue();
  });

  test('una prenotazione nuova si crea attiva, con il suo documento', async () => {
    // In jsdom manca crypto.randomUUID (nell'app Electron c'e').
    Object.defineProperty(global, 'crypto', { value: { randomUUID: () => 'nuovo-id' }, configurable: true });
    const salvata = await salvaPrenotazione({ cliente: 'Mario Rossi', targa: 'AA111AA', prezzoTotale: 60, schedaVeicolo: { x: 1 } });
    expect(setDoc.mock.calls[0][0]).toBe('prenotazioni/nuovo-id');
    expect(setDoc.mock.calls[0][1]).toEqual(expect.objectContaining({ cliente: 'Mario Rossi', status: 'attiva' }));
    expect(setDoc.mock.calls[0][1].schedaVeicolo).toBeUndefined(); // la scheda si compila alla consegna
    expect(salvata.id).toBe('nuovo-id');
    expect(runTransaction).not.toHaveBeenCalled();
  });

  test('una modifica aggiorna solo i campi della prenotazione', async () => {
    const t = transazioneCon({ status: 'attiva' });
    const originale = { id: 'p1', status: 'attiva', schedaVeicolo: { kmIniziali: '100' }, totale: 240 };
    const salvata = await salvaPrenotazione({ ...originale, dataFine: '2026-10-05', schedaVeicolo: {} }, originale);
    expect(t.update).toHaveBeenCalledWith('prenotazioni/p1', { dataFine: '2026-10-05' });
    expect(salvata.schedaVeicolo).toEqual({ kmIniziali: '100' });
  });

  test('non salva una modifica su una prenotazione annullata nel frattempo', async () => {
    const t = transazioneCon({ status: 'annullata' });
    await expect(salvaPrenotazione({ dataFine: '2026-10-05' }, { id: 'p1', status: 'attiva' }))
      .rejects.toThrow(/annullata nel frattempo/);
    expect(t.update).not.toHaveBeenCalled();
  });
});

describe('registraConsegna', () => {
  beforeEach(() => {
    doc.mockImplementation((_db, collezione, id) => `${collezione}/${id}`);
    readClienti.mockResolvedValue([{ id: 'RSSMRA80A01H501U', codiceFiscale: 'RSSMRA80A01H501U', email: 'gia@presente.it' }]);
    aggiungiContrattoCliente.mockResolvedValue();
    creaCliente.mockImplementation(async (c) => ({ ...c, id: c.codiceFiscale }));
    aggiornaCampiCliente.mockResolvedValue();
  });

  test('salva scheda, ora di consegna e patente; il contratto va solo sul suo cliente', async () => {
    const t = transazioneCon({ status: 'attiva' });
    const scheda = { kmIniziali: '45000', carburante: 'Pieno' };
    const esito = await registraConsegna({ prenotazione: { id: 'p1', codiceFiscale: 'rssmra80a01h501u', targa: 'AA111AA', emailCliente: 'nuova@mail.it' }, scheda, patente: ' ab123 ', ip: '1.2.3.4' });
    const campi = t.update.mock.calls[0][1];
    expect(esito.campi).toEqual(campi);
    expect(campi).toEqual(expect.objectContaining({ schedaVeicolo: scheda, patente: 'AB123', ipConsegna: '1.2.3.4' }));
    expect(campi.consegnataIl).toBeTruthy();
    expect(aggiungiContrattoCliente).toHaveBeenCalledWith('RSSMRA80A01H501U', expect.objectContaining({ targa: 'AA111AA' }));
    // Cliente gia' in anagrafica: si completa solo cio' che manca (la patente), l'email resta.
    expect(aggiornaCampiCliente).toHaveBeenCalledWith('RSSMRA80A01H501U', { patente: 'AB123' });
    expect(esito.cliente).toBe('aggiornato');
    expect(creaCliente).not.toHaveBeenCalled();
  });

  test('cliente del sito non in anagrafica: alla consegna viene creato', async () => {
    transazioneCon({ status: 'attiva' });
    const esito = await registraConsegna({
      prenotazione: { id: 'p2', origine: 'sito', cliente: 'Anna Verdi', codiceFiscale: 'vrdnna90a41h501x', emailCliente: 'a@b.it', telefono: '333', targa: 'BB222BB' },
      scheda: {}, patente: 'xy99', scadenzaPatente: '2030-05-01',
    });
    expect(creaCliente).toHaveBeenCalledWith(expect.objectContaining({
      nome: 'Anna', cognome: 'Verdi', codiceFiscale: 'VRDNNA90A41H501X', email: 'a@b.it', patente: 'XY99', scadenzaPatente: '2030-05-01', origine: 'sito',
    }));
    expect(aggiungiContrattoCliente).toHaveBeenCalledWith('VRDNNA90A41H501X', expect.objectContaining({ targa: 'BB222BB' }));
    expect(esito.cliente).toBe('creato');
  });

  test('non consegna una prenotazione annullata nel frattempo', async () => {
    const t = transazioneCon({ status: 'annullata' });
    await expect(registraConsegna({ prenotazione: { id: 'p1' }, scheda: {} })).rejects.toThrow(/annullata nel frattempo/);
    expect(t.update).not.toHaveBeenCalled();
    expect(aggiungiContrattoCliente).not.toHaveBeenCalled();
  });
});
