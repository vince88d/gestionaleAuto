import { doc, updateDoc } from 'firebase/firestore';
import { isPrenotazioneVisibile, isPagataOnline, segnaDannoPrenotazioneRiparato } from './firestorePrenotazioni';

// Niente connessione a Firebase nei test: qui servono solo le funzioni pure.
jest.mock('../components/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), getDocs: jest.fn(), doc: jest.fn(), writeBatch: jest.fn(),
  setDoc: jest.fn(), updateDoc: jest.fn(),
}));
jest.mock('./firestoreClienti', () => ({ readClienti: jest.fn(), writeClienti: jest.fn() }));

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
