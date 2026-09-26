import {
  setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, doc, getDocs, writeBatch, query, where, collection,
} from 'firebase/firestore';
import { salvaVeicolo, eliminaVeicolo, ripristinaVeicolo, sospendiVeicolo, riattivaVeicolo } from './firestoreVeicoli';
import { spostaFotoDanniSuStorage } from './storageFoto';

jest.mock('../components/firebase', () => ({ db: {}, auth: { currentUser: { email: 'staff@test.it' } } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), getDocs: jest.fn(), writeBatch: jest.fn(),
  doc: jest.fn(), setDoc: jest.fn(), updateDoc: jest.fn(), deleteDoc: jest.fn(), deleteField: jest.fn(),
  serverTimestamp: jest.fn(), query: jest.fn(), where: jest.fn(),
}));
jest.mock('./firestoreTariffe', () => ({ readTariffe: jest.fn() }));
jest.mock('./storageFoto', () => ({ spostaFotoDanniSuStorage: jest.fn() }));

// Create React App azzera i mock prima di ogni test (resetMocks): le
// implementazioni vanno rimesse qui.
beforeEach(() => {
  doc.mockImplementation((_db, collezione, id) => `${collezione}/${id}`);
  setDoc.mockResolvedValue();
  updateDoc.mockResolvedValue();
  deleteDoc.mockResolvedValue();
  deleteField.mockReturnValue('DELETE_FIELD');
  serverTimestamp.mockReturnValue('SERVER_TIMESTAMP');
  spostaFotoDanniSuStorage.mockImplementation(async (danni) =>
    danni.map((d) => (d.immagine?.startsWith('data:') ? { ...d, immagine: 'https://storage/danno.webp' } : d)));
});

describe('salvaVeicolo', () => {
  test('scrive solo il documento di quel veicolo, senza id e senza la tariffa', async () => {
    await salvaVeicolo({ id: 'v1', modello: 'C3', prezzo: 40, prezzoVeicolo: 30, danni: [] });
    expect(doc).toHaveBeenCalledWith({}, 'veicoli', 'v1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [riferimento, dati] = setDoc.mock.calls[0];
    expect(riferimento).toBe('veicoli/v1');
    expect(dati).toEqual({ modello: 'C3', prezzo: 30, danni: [] });
    // Nessun campo undefined: Firestore rifiuterebbe tutto il salvataggio.
    expect(Object.values(dati)).not.toContain(undefined);
  });

  test('sposta su Storage le foto dei danni incorporate e restituisce gli indirizzi', async () => {
    const salvato = await salvaVeicolo({
      id: 'v1',
      danni: [{ descrizione: 'graffio', immagine: 'data:image/jpeg;base64,AAAA' }],
      storicoRiparazioni: [{ descrizione: 'ok', immagine: 'https://storage/vecchia.webp' }],
    });
    expect(spostaFotoDanniSuStorage).toHaveBeenCalledTimes(2); // danni e storico
    expect(salvato.danni[0].immagine).toBe('https://storage/danno.webp');
    expect(setDoc.mock.calls[0][1].danni[0].immagine).toBe('https://storage/danno.webp');
    expect(salvato.storicoRiparazioni[0].immagine).toBe('https://storage/vecchia.webp');
  });
});

describe('salvaVeicolo con cambio di targa', () => {
  test('veicolo e prenotazioni della vecchia targa in un\'unica scrittura', async () => {
    const batch = { set: jest.fn(), update: jest.fn(), commit: jest.fn().mockResolvedValue() };
    writeBatch.mockReturnValue(batch);
    collection.mockReturnValue('prenotazioni');
    where.mockReturnValue('targa==VECCHIA');
    query.mockReturnValue('query');
    getDocs.mockResolvedValue({ forEach: (fn) => [{ ref: 'prenotazioni/p1' }, { ref: 'prenotazioni/p2' }].forEach(fn) });

    await salvaVeicolo({ id: 'v1', targa: 'NUOVA11', danni: [] }, { targaPrecedente: 'VECCHIA' });

    expect(where).toHaveBeenCalledWith('targa', '==', 'VECCHIA');
    expect(batch.set).toHaveBeenCalledWith('veicoli/v1', { targa: 'NUOVA11', danni: [] });
    expect(batch.update).toHaveBeenCalledWith('prenotazioni/p1', { targa: 'NUOVA11' });
    expect(batch.update).toHaveBeenCalledWith('prenotazioni/p2', { targa: 'NUOVA11' });
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(setDoc).not.toHaveBeenCalled();
  });

  test('stessa targa: nessuna prenotazione toccata', async () => {
    await salvaVeicolo({ id: 'v1', targa: 'UGUALE1' }, { targaPrecedente: 'UGUALE1' });
    expect(getDocs).not.toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalledTimes(1);
  });
});

describe('eliminaVeicolo', () => {
  test('non cancella il documento: lo marca eliminato (soft delete)', async () => {
    await eliminaVeicolo('v9');
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalledWith('veicoli/v9', {
      eliminato: true,
      eliminatoDa: 'staff@test.it',
      eliminatoIl: 'SERVER_TIMESTAMP',
    });
  });
});

describe('ripristinaVeicolo', () => {
  test('toglie i campi di eliminazione', async () => {
    await ripristinaVeicolo('v9');
    expect(updateDoc).toHaveBeenCalledWith('veicoli/v9', {
      eliminato: 'DELETE_FIELD',
      eliminatoDa: 'DELETE_FIELD',
      eliminatoIl: 'DELETE_FIELD',
    });
  });
});

describe('sospendiVeicolo / riattivaVeicolo', () => {
  test('sospendere aggiorna solo i campi della sospensione, con il motivo', async () => {
    await sospendiVeicolo('v1', '  incidente  ');
    expect(updateDoc).toHaveBeenCalledWith('veicoli/v1', {
      sospeso: true, sospesoDa: 'staff@test.it', sospesoIl: expect.any(String), sospesoMotivo: 'incidente',
    });
    expect(setDoc).not.toHaveBeenCalled();
  });

  test('senza motivo non scrive il campo', async () => {
    await sospendiVeicolo('v1');
    expect(updateDoc.mock.calls[0][1]).not.toHaveProperty('sospesoMotivo');
  });

  test('riattivare toglie tutti i campi della sospensione', async () => {
    await riattivaVeicolo('v1');
    expect(updateDoc).toHaveBeenCalledWith('veicoli/v1', {
      sospeso: 'DELETE_FIELD', sospesoMotivo: 'DELETE_FIELD', sospesoDa: 'DELETE_FIELD', sospesoIl: 'DELETE_FIELD',
    });
  });
});
