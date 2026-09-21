import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Tariffe from './Tariffe';
import { readVeicoli } from '../lib/firestoreVeicoli';
import { readTariffe, writeTariffe } from '../lib/firestoreTariffe';

// Nessun accesso a Firestore: veicoli e tariffe sono finti.
jest.mock('../lib/firestoreVeicoli', () => ({ readVeicoli: jest.fn() }));
jest.mock('../lib/firestoreTariffe', () => ({ readTariffe: jest.fn(), writeTariffe: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const flotta = [
  { id: '1', categoria: 'City Car', prezzo: 30 },
  { id: '2', categoria: 'City Car', prezzo: 25 },
  { id: '3', categoria: 'SUV', prezzo: 35 },
];

beforeEach(() => {
  jest.clearAllMocks();
  readVeicoli.mockResolvedValue(flotta);
  writeTariffe.mockResolvedValue(true);
});

const campo = (categoria) => screen.getByLabelText(`Prezzo al giorno ${categoria}`);

test('la prima volta i campi partono dal prezzo più basso delle auto di ogni categoria', async () => {
  readTariffe.mockResolvedValue({});
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('25'));
  expect(campo('SUV').value).toBe('35');
  expect(screen.getByText(/non hai ancora salvato nessuna tariffa/i)).toBeInTheDocument();
});

test('se c\'è già una tariffa, mostra quella e non il suggerimento', async () => {
  readTariffe.mockResolvedValue({ 'City Car': 28 });
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('28'));
  expect(campo('SUV').value).toBe('35');
  expect(screen.getByText('In uso')).toBeInTheDocument();
});

test('salva i prezzi scritti, accettando la virgola, e toglie quelli lasciati vuoti', async () => {
  readTariffe.mockResolvedValue({});
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('25'));

  fireEvent.change(campo('City Car'), { target: { value: '26,50' } });
  fireEvent.change(campo('SUV'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: /salva tariffe/i }));

  await waitFor(() => expect(writeTariffe).toHaveBeenCalledWith({ 'City Car': 26.5 }));
});

test('un prezzo non valido non viene salvato', async () => {
  readTariffe.mockResolvedValue({});
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('25'));

  fireEvent.change(campo('City Car'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: /salva tariffe/i }));

  expect(writeTariffe).not.toHaveBeenCalled();
});

test('"Salva" è disattivato finché non cambia nulla', async () => {
  readTariffe.mockResolvedValue({ 'City Car': 25, SUV: 35 });
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('25'));
  expect(screen.getByRole('button', { name: /salva tariffe/i })).toBeDisabled();
});
