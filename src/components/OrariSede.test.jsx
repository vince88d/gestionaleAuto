import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import OrariSede from './OrariSede';
import { ORARI_PREDEFINITI } from '../utils/orari';

let invia;
const mockSalva = jest.fn(() => Promise.resolve());
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../lib/firestoreOrari', () => ({
  ascoltaOrari: (onDati) => { invia = onDati; return () => {}; },
  salvaOrari: (...a) => mockSalva(...a),
}));

const copia = () => JSON.parse(JSON.stringify(ORARI_PREDEFINITI));
const apri = (dati = { orari: copia(), esiste: true }) => {
  render(<OrariSede />);
  act(() => invia(dati));
};

beforeEach(() => mockSalva.mockClear());

test('mai salvati: avviso e si puo\' salvare subito quelli di partenza', async () => {
  apri({ orari: copia(), esiste: false });
  expect(screen.getByText(/Orari non ancora salvati/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Salva orari/ }));
  await waitFor(() => expect(mockSalva).toHaveBeenCalled());
});

test('chiudere un giorno, copiare il lunedi\' e vedere l\'anteprima del sito', () => {
  apri();
  expect(screen.getByRole('button', { name: /Salva orari/ })).toBeDisabled();
  fireEvent.click(screen.getAllByRole('button', { name: 'Chiuso' })[2]); // mercoledi'
  expect(screen.getByText(/Mer chiuso/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Copia gli orari del lunedì/ }));
  expect(screen.getByText(/Lun–Ven 8:30–13:00 \/ 15:00–19:30/)).toBeInTheDocument();
  // Tornati uguali a prima: niente da salvare.
  expect(screen.getByRole('button', { name: /Salva orari/ })).toBeDisabled();
});

test('chiusura straordinaria e orario sbagliato: errore, non salva', async () => {
  apri();
  fireEvent.click(screen.getByRole('button', { name: /Aggiungi chiusura/ }));
  fireEvent.click(screen.getByRole('button', { name: /Salva orari/ }));
  expect(screen.getByText('Scegli il giorno.')).toBeInTheDocument();
  expect(mockSalva).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Dal'), { target: { value: '2026-08-15' } });
  fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Ferragosto' } });
  expect(screen.getByText(/chiuso il 15\/08 \(Ferragosto\)/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Lunedì, mattina: chiude alle'), { target: { value: '08:00' } });
  fireEvent.click(screen.getByRole('button', { name: /Salva orari/ }));
  expect(screen.getByText(/dopo l'apertura/)).toBeInTheDocument();
  expect(mockSalva).not.toHaveBeenCalled();
});

test('pomeriggio: si toglie e si rimette', () => {
  apri();
  fireEvent.click(screen.getByRole('button', { name: 'Sabato: togli il pomeriggio' }));
  expect(screen.getByText(/Sab 9:00–13:00 ·/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ Pomeriggio' }));
  expect(screen.getByLabelText('Sabato, pomeriggio: apre alle')).toBeInTheDocument();
});
