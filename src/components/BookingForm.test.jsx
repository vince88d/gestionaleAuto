import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BookingForm from './BookingForm';

jest.mock('react-redux', () => ({ useDispatch: () => jest.fn() }));
// Il calendario delle date non serve qui (e date-fns/locale non si carica in jest).
jest.mock('date-fns/locale', () => ({ it: {} }));
jest.mock('react-datepicker', () => ({ selected, placeholderText }) => (
  <input readOnly placeholder={placeholderText} value={selected ? selected.toISOString().slice(0, 10) : ''} />
));
jest.mock('../lib/firestoreClienti', () => ({
  creaCliente: jest.fn(),
  messaggioErroreCliente: () => 'errore',
  normalizzaCodiceFiscale: (cf) => String(cf || '').trim().toUpperCase(),
}));
jest.mock('../lib/firestorePrenotazioni', () => ({
  STATI_PRENOTAZIONE_NON_CONFERMATE: ['richiesta-sito', 'scaduta', 'pagamento-fallito'],
}));

const veicoli = [
  { id: 'v1', marca: 'Fiat', modello: 'Panda', targa: 'ABC004', categoria: 'Utilitaria', prezzo: 35 },
  { id: 'v2', marca: 'Fiat', modello: 'Ducato', targa: 'AB123TR', categoria: 'Furgone', prezzo: 70 },
];
const clienti = [
  { id: 'c1', nome: 'Mario', cognome: 'Rossi', cellulare: '333 1111111', email: 'mario@rossi.it', codiceFiscale: 'RSSMRA80A01H501U', patente: 'AB12' },
];
// Una prenotazione che occupa il Ducato in quei giorni.
const prenotazioni = [
  { id: 'p9', targa: 'AB123TR', status: 'attiva', dataInizio: '2099-03-12', dataFine: '2099-03-14' },
];

const apri = (initialValues = { dataInizio: '2099-03-10' }) => {
  const onSubmit = jest.fn();
  render(
    <BookingForm
      onSubmit={onSubmit}
      onAnnulla={jest.fn()}
      initialValues={initialValues}
      availableVehicles={veicoli}
      veicoli={veicoli}
      clienti={clienti}
      prenotazioni={prenotazioni}
    />,
  );
  return onSubmit;
};

test('tre passi in ordine: quando, quale auto, chi (cliente nuovo con nome e telefono)', () => {
  const onSubmit = apri();
  // 1. Durata rapida dal giorno arrivato dal calendario.
  fireEvent.click(screen.getByRole('button', { name: '1 settimana' }));
  expect(screen.getAllByText('7 giorni').length).toBeGreaterThan(0);

  // 2. Il Ducato e' occupato in quelle date: non si vede, la Panda si'.
  expect(screen.queryByRole('radio', { name: /Ducato/ })).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: /Panda/ }));
  expect(screen.getByText('€ 245 in tutto')).toBeInTheDocument();

  // 3. Cliente nuovo: bastano nome e telefono.
  fireEvent.click(screen.getByRole('button', { name: /cliente nuovo/ }));
  fireEvent.change(screen.getByLabelText('Nome e cognome'), { target: { value: '  Luca   Neri ' } });
  fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '333 2222222' } });
  fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    dataInizio: '2099-03-10', dataFine: '2099-03-17', targa: 'ABC004', veicolo: 'Panda', prezzoGiornaliero: '35',
    cliente: 'Luca Neri', telefono: '333 2222222', codiceFiscale: '', patente: '',
  }));
});

test('cliente gia\' in anagrafica: si cerca e porta con se\' contatti e documenti', () => {
  const onSubmit = apri({ dataInizio: '2099-03-10', dataFine: '2099-03-11', targa: 'ABC004' });
  fireEvent.change(screen.getByPlaceholderText(/Rossi/), { target: { value: 'ross' } });
  fireEvent.click(screen.getByRole('button', { name: /Mario Rossi/ }));
  expect(screen.getByText('Documenti completi')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    cliente: 'Mario Rossi', telefono: '333 1111111', emailCliente: 'mario@rossi.it',
    codiceFiscale: 'RSSMRA80A01H501U', patente: 'AB12', prezzoGiornaliero: '35',
  }));
});

test('se manca qualcosa non salva e dice cosa manca', () => {
  const onSubmit = apri({});
  fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText(/Manca ancora: giorno di uscita, giorno di rientro, auto, cliente/)).toBeInTheDocument();
});
