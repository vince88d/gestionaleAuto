import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import Categorie from './Categorie';
import { ascoltaVeicoli } from '../lib/firestoreVeicoli';
import { ascoltaTariffe } from '../lib/firestoreTariffe';
import {
  ascoltaCategorie, writeCategorie, rinominaCategoriaOvunque, rimuoviTariffaCategoria,
} from '../lib/firestoreCategorie';

// Nessun accesso a Firestore/Redux: tutto finto, "trasmesso" come farebbe
// onSnapshot chiamando subito la callback coi dati di ogni test.
jest.mock('../lib/firestoreVeicoli', () => ({ ascoltaVeicoli: jest.fn() }));
jest.mock('../lib/firestoreTariffe', () => ({ ascoltaTariffe: jest.fn() }));
jest.mock('../lib/firestoreCategorie', () => ({
  ascoltaCategorie: jest.fn(),
  writeCategorie: jest.fn(),
  rinominaCategoriaOvunque: jest.fn(),
  rimuoviTariffaCategoria: jest.fn(),
}));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

let mockStatoFinto;
jest.mock('react-redux', () => ({ useSelector: (selettore) => selettore(mockStatoFinto) }));

function finteVeicoli(veicoli) {
  let onDati;
  ascoltaVeicoli.mockImplementation((cb) => { onDati = cb; cb(veicoli); return () => {}; });
  return (nuovi) => onDati(nuovi);
}
function finteCategorie(elenco) {
  let onDati;
  ascoltaCategorie.mockImplementation((cb) => { onDati = cb; cb(elenco); return () => {}; });
  return (nuovo) => onDati(nuovo);
}
function finteTariffe(tariffe) {
  ascoltaTariffe.mockImplementation((cb) => { cb(tariffe); return () => {}; });
}

const riga = (testo) => screen.getAllByRole('row').find((r) => within(r).queryByText(testo));

beforeEach(() => {
  jest.clearAllMocks();
  mockStatoFinto = { prenotazioni: [] };
  writeCategorie.mockResolvedValue(true);
  rinominaCategoriaOvunque.mockResolvedValue(true);
  rimuoviTariffaCategoria.mockResolvedValue(false);
  finteTariffe({});
});

test('elenca le categorie col numero di veicoli di ciascuna', async () => {
  finteVeicoli([{ id: '1', categoria: 'City Car' }, { id: '2', categoria: 'City Car' }, { id: '3', categoria: 'SUV' }]);
  finteCategorie(['City Car', 'SUV', 'Berlina']);
  render(<Categorie />);

  await screen.findByText('City Car');
  expect(riga('City Car').textContent).toContain('2');
  expect(riga('Berlina').textContent).toContain('0');
});

test('aggiunge una categoria nuova, ma non un doppione', async () => {
  finteVeicoli([]);
  finteCategorie(['City Car']);
  render(<Categorie />);
  await screen.findByText('City Car');

  fireEvent.change(screen.getByLabelText('Nuova categoria'), { target: { value: 'city car' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
  expect(writeCategorie).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Nuova categoria'), { target: { value: 'Furgone' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
  await waitFor(() => expect(writeCategorie).toHaveBeenCalledWith(['City Car', 'Furgone']));
});

test('non si può eliminare una categoria con veicoli', async () => {
  finteVeicoli([{ id: '1', categoria: 'SUV' }]);
  finteCategorie(['SUV']);
  render(<Categorie />);
  await screen.findByText('SUV');
  expect(within(riga('SUV')).getByRole('button', { name: 'Elimina' })).toBeDisabled();
});

test('eliminare una categoria senza veicoli ma con tariffa lo dice nella conferma', async () => {
  finteVeicoli([]);
  finteCategorie(['Berlina']);
  finteTariffe({ Berlina: 45 });
  render(<Categorie />);
  await screen.findByText('Berlina');

  fireEvent.click(within(riga('Berlina')).getByRole('button', { name: 'Elimina' }));
  expect(await screen.findByText(/toglie anche la tariffa salvata \(45 €/)).toBeInTheDocument();

  const bottoniElimina = screen.getAllByRole('button', { name: 'Elimina' });
  fireEvent.click(bottoniElimina[bottoniElimina.length - 1]); // il bottone della conferma, non della riga
  await waitFor(() => expect(rimuoviTariffaCategoria).toHaveBeenCalledWith('Berlina'));
  expect(writeCategorie).toHaveBeenCalledWith([]);
});

test('eliminare una categoria senza veicoli né tariffa non promette effetti che non ci sono', async () => {
  finteVeicoli([]);
  finteCategorie(['Berlina']);
  render(<Categorie />);
  await screen.findByText('Berlina');

  fireEvent.click(within(riga('Berlina')).getByRole('button', { name: 'Elimina' }));
  expect(await screen.findByText(/nessun veicolo la usa, quindi non ci sono altri effetti/i)).toBeInTheDocument();
});

test('rinominare mostra quanti veicoli e prenotazioni coinvolge, prima di scrivere', async () => {
  finteVeicoli([{ id: '1', categoria: 'SUV' }, { id: '2', categoria: 'SUV' }]);
  finteCategorie(['SUV']);
  mockStatoFinto = { prenotazioni: [{ id: 'p1', categoria: 'SUV' }] };
  render(<Categorie />);
  await screen.findByText('SUV');

  fireEvent.click(within(riga('SUV')).getByRole('button', { name: 'Rinomina' }));
  fireEvent.change(screen.getByLabelText('Nuovo nome per SUV'), { target: { value: 'SUV Grande' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

  expect(await screen.findByText(/aggiorna 2 veicoli e 1 prenotazione che usano "suv"/i)).toBeInTheDocument();
  expect(rinominaCategoriaOvunque).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Rinomina' }));
  await waitFor(() => expect(rinominaCategoriaOvunque).toHaveBeenCalledWith('SUV', 'SUV Grande', ['SUV Grande']));
});

test('rinominare in un nome già presente è rifiutato subito, senza conferma', async () => {
  finteVeicoli([]);
  finteCategorie(['SUV', 'Berlina']);
  render(<Categorie />);
  await screen.findByText('SUV');

  fireEvent.click(within(riga('SUV')).getByRole('button', { name: 'Rinomina' }));
  fireEvent.change(screen.getByLabelText('Nuovo nome per SUV'), { target: { value: 'Berlina' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

  expect(rinominaCategoriaOvunque).not.toHaveBeenCalled();
  expect(screen.queryByText('Rinominare la categoria?')).not.toBeInTheDocument();
});
