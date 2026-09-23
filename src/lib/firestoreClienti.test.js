import { doc, runTransaction, writeBatch } from 'firebase/firestore';
import { creaCliente, aggiornaCliente, togliDanniPrenotazioneCliente, ClienteNonSalvato } from './firestoreClienti';

jest.mock('../components/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), getDocs: jest.fn(), doc: jest.fn(), writeBatch: jest.fn(), updateDoc: jest.fn(),
  deleteDoc: jest.fn(), arrayUnion: jest.fn(), onSnapshot: jest.fn(), runTransaction: jest.fn(),
}));

function transazioneCon(datiAttuali) {
  const t = {
    get: jest.fn().mockResolvedValue({ exists: () => datiAttuali !== null, data: () => datiAttuali }),
    set: jest.fn(),
    update: jest.fn(),
  };
  runTransaction.mockImplementation(async (_db, fn) => fn(t));
  return t;
}

beforeEach(() => doc.mockImplementation((_db, collezione, id) => `${collezione}/${id}`));

describe('creaCliente', () => {
  test('crea il documento con id = codice fiscale, storico e contratti vuoti', async () => {
    const t = transazioneCon(null);
    const c = await creaCliente({ nome: 'Mario', codiceFiscale: 'rssmra80a01h501u', storicoDanni: [{ x: 1 }], index: 2 });
    expect(t.set.mock.calls[0][0]).toBe('clienti/RSSMRA80A01H501U');
    expect(t.set.mock.calls[0][1]).toEqual(expect.objectContaining({ nome: 'Mario', codiceFiscale: 'RSSMRA80A01H501U', storicoDanni: [], contratti: [] }));
    expect(c.id).toBe('RSSMRA80A01H501U');
  });

  test('non sovrascrive un cliente che esiste gia\'', async () => {
    const t = transazioneCon({ nome: 'Altro' });
    await expect(creaCliente({ codiceFiscale: 'RSSMRA80A01H501U' })).rejects.toBeInstanceOf(ClienteNonSalvato);
    expect(t.set).not.toHaveBeenCalled();
  });
});

describe('aggiornaCliente', () => {
  test('aggiorna solo i campi del form e, se serve, le prenotazioni nello stesso salvataggio', async () => {
    const batch = { update: jest.fn(), commit: jest.fn().mockResolvedValue() };
    writeBatch.mockReturnValue(batch);
    await aggiornaCliente('VECCHIO', { id: 'VECCHIO', nome: 'Mario', codiceFiscale: 'nuovocf', storicoDanni: [], contratti: [] },
      { prenotazioniDaAggiornare: ['p1', 'p2'] });
    const [rif, campi] = batch.update.mock.calls[0];
    expect(rif).toBe('clienti/VECCHIO'); // l'id del documento non cambia
    expect(campi).toEqual(expect.objectContaining({ nome: 'Mario', codiceFiscale: 'NUOVOCF' }));
    expect(campi.storicoDanni).toBeUndefined();
    expect(campi.contratti).toBeUndefined();
    expect(batch.update).toHaveBeenCalledWith('prenotazioni/p1', { codiceFiscale: 'NUOVOCF' });
    expect(batch.update).toHaveBeenCalledWith('prenotazioni/p2', { codiceFiscale: 'NUOVOCF' });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});

test('togliDanniPrenotazioneCliente toglie solo le voci di quella prenotazione', async () => {
  const t = transazioneCon({ storicoDanni: [{ riferimentoPrenotazione: 'p1' }, { riferimentoPrenotazione: 'p2' }] });
  await togliDanniPrenotazioneCliente('CF', 'p1');
  expect(t.update).toHaveBeenCalledWith('clienti/CF', { storicoDanni: [{ riferimentoPrenotazione: 'p2' }] });
});
