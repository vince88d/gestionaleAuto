import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Tariffe from './Tariffe';
import { ascoltaVeicoli } from '../lib/firestoreVeicoli';
import { ascoltaTariffe, writeTariffe } from '../lib/firestoreTariffe';
import { ascoltaCategorie } from '../lib/firestoreCategorie';

// Nessun accesso a Firestore: veicoli, tariffe e categorie sono finti,
// "trasmessi" come farebbe onSnapshot chiamando subito la callback coi dati
// di ogni test.
jest.mock('../lib/firestoreVeicoli', () => ({ ascoltaVeicoli: jest.fn() }));
jest.mock('../lib/firestoreTariffe', () => ({ ascoltaTariffe: jest.fn(), writeTariffe: jest.fn() }));
jest.mock('../lib/firestoreCategorie', () => ({ ascoltaCategorie: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const flotta = [
  { id: '1', categoria: 'City Car', prezzo: 30 },
  { id: '2', categoria: 'City Car', prezzo: 25 },
  { id: '3', categoria: 'SUV', prezzo: 35 },
];

// Simula ascoltaVeicoli/ascoltaTariffe/ascoltaCategorie: chiama subito onDati
// coi dati dati, e tiene la callback per mandare un secondo aggiornamento nel
// test (onSnapshot).
function finteVeicoli(veicoli) {
  let onDati;
  ascoltaVeicoli.mockImplementation((cb) => { onDati = cb; cb(veicoli); return () => {}; });
  return (nuovi) => onDati(nuovi);
}
function finteTariffe(tariffe) {
  let onDati;
  ascoltaTariffe.mockImplementation((cb) => { onDati = cb; cb(tariffe); return () => {}; });
  return (nuove) => onDati(nuove);
}
function finteCategorie(elenco) {
  let onDati;
  ascoltaCategorie.mockImplementation((cb) => { onDati = cb; cb(elenco); return () => {}; });
  return (nuovo) => onDati(nuovo);
}

beforeEach(() => {
  jest.clearAllMocks();
  writeTariffe.mockResolvedValue(true);
  // Di default l'elenco categorie coincide con quelle già sui veicoli: i test
  // esistenti non devono accorgersi della nuova fonte dati.
  finteCategorie(['City Car', 'SUV']);
});

const campo = (categoria) => screen.getByLabelText(`Prezzo al giorno ${categoria}`);
const salva = async () => {
  fireEvent.click(screen.getByRole('button', { name: /salva tariffe/i }));
  fireEvent.click(await screen.findByRole('button', { name: /salva e pubblica/i }));
};

test('la prima volta i campi partono dal prezzo più basso delle auto di ogni categoria', async () => {
  finteVeicoli(flotta);
  finteTariffe({});
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('25'));
  expect(campo('SUV').value).toBe('35');
  expect(screen.getByText(/non hai ancora salvato nessuna tariffa/i)).toBeInTheDocument();
});

test('se c\'è già una tariffa, mostra quella e non il suggerimento', async () => {
  finteVeicoli(flotta);
  finteTariffe({ 'City Car': 28 });
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('28'));
  expect(campo('SUV').value).toBe('35');
  expect(screen.getByText('In uso')).toBeInTheDocument();
});

test('salva i prezzi scritti, accettando la virgola, dopo la conferma', async () => {
  finteVeicoli(flotta);
  finteTariffe({});
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('25'));

  fireEvent.change(campo('City Car'), { target: { value: '26,50' } });
  fireEvent.change(campo('SUV'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: /salva tariffe/i }));

  // La conferma mostra vecchio → nuovo prima di scrivere davvero.
  expect(await screen.findByText(/City Car: nessuna tariffa → 26,5 €/)).toBeInTheDocument();
  expect(writeTariffe).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: /salva e pubblica/i }));
  await waitFor(() => expect(writeTariffe).toHaveBeenCalledWith({ 'City Car': 26.5 }));
});

test('un prezzo non valido non apre la conferma', async () => {
  finteVeicoli(flotta);
  finteTariffe({});
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('25'));

  fireEvent.change(campo('City Car'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: /salva tariffe/i }));

  expect(screen.queryByRole('button', { name: /salva e pubblica/i })).not.toBeInTheDocument();
  expect(writeTariffe).not.toHaveBeenCalled();
});

test('"Salva" è disattivato finché non cambia nulla', async () => {
  finteVeicoli(flotta);
  finteTariffe({ 'City Car': 25, SUV: 35 });
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('25'));
  expect(screen.getByRole('button', { name: /salva tariffe/i })).toBeDisabled();
});

test('un campo toccato non si aggiorna più da solo, ma segnala se un altro lo cambia nel frattempo', async () => {
  finteVeicoli(flotta);
  const aggiornaTariffe = finteTariffe({ 'City Car': 25 });
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('25'));

  fireEvent.change(campo('City Car'), { target: { value: '27' } });
  // Un'altra postazione salva un prezzo diverso mentre lo stiamo modificando.
  aggiornaTariffe({ 'City Car': 29 });

  expect(await screen.findByText('Cambiata da un altro')).toBeInTheDocument();
  expect(campo('City Car').value).toBe('27'); // resta quello scritto, non torna a 29

  fireEvent.click(screen.getByRole('button', { name: /salva tariffe/i }));
  expect(await screen.findByText(/qualcun altro l'ha cambiata nel frattempo/)).toBeInTheDocument();
});

test('"Annulla modifiche" riporta i campi toccati al valore salvato', async () => {
  finteVeicoli(flotta);
  finteTariffe({ 'City Car': 25, SUV: 35 });
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('25'));

  fireEvent.change(campo('City Car'), { target: { value: '99' } });
  fireEvent.click(screen.getByRole('button', { name: /annulla modifiche/i }));

  expect(campo('City Car').value).toBe('25');
  expect(screen.getByRole('button', { name: /salva tariffe/i })).toBeDisabled();
});

test('una categoria dell\'elenco senza ancora veicoli si vede comunque, non sembra mancante', async () => {
  finteVeicoli(flotta);
  finteTariffe({});
  finteCategorie(['City Car', 'SUV', 'Berlina']);
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('25'));

  expect(campo('Berlina')).toBeInTheDocument();
  expect(screen.getByText('Nessun veicolo')).toBeInTheDocument();
});

test('una tariffa di una categoria non più nell\'elenco si vede in fondo e si può togliere', async () => {
  finteVeicoli(flotta);
  finteTariffe({ 'City Car': 25, SUV: 35, Van: 60 });
  render(<Tariffe />);
  await waitFor(() => expect(campo('City Car').value).toBe('25'));

  expect(screen.getByText(/tariffe di categorie non più gestite/i)).toBeInTheDocument();
  expect(screen.getByText(/Van: 60 €/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /salva tariffe/i })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Rimuovi' }));
  fireEvent.change(campo('SUV'), { target: { value: '40' } });
  await salva();

  await waitFor(() => expect(writeTariffe).toHaveBeenCalledWith({ 'City Car': 25, SUV: 40 }));
});
