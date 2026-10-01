import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CatalogoOptional from './CatalogoOptional';
import { salvaOptional, togliOptional } from '../lib/firestoreOptional';

const catalogo = [
  { id: 'o1', nome: 'Seggiolino bambino', descrizione: '0–4 anni', modo: 'giorno', prezzo: 8, massimo: 60, maxPerNoleggio: 2, pezzi: 3, sulSito: true },
  { id: 'o2', nome: 'Navigatore', descrizione: '', modo: 'giorno', prezzo: 6, massimo: null, maxPerNoleggio: 1, pezzi: null, sulSito: false },
];

jest.mock('../lib/firestoreOptional', () => ({
  ascoltaOptional: (onDati) => { onDati(catalogo); return () => {}; },
  salvaOptional: jest.fn(async (d) => d),
  togliOptional: jest.fn(async () => {}),
}));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

test('elenco con prezzo, pezzi e se e\' sul sito', () => {
  render(<CatalogoOptional />);
  expect(screen.getByText('Seggiolino bambino')).toBeInTheDocument();
  expect(screen.getByText('8 € al giorno · massimo 60 € a noleggio')).toBeInTheDocument();
  expect(screen.getByText('senza limite')).toBeInTheDocument();
  expect(screen.getByText('Solo al banco')).toBeInTheDocument();
});

test('nuovo optional: controlla i campi, poi salva', async () => {
  render(<CatalogoOptional />);
  fireEvent.click(screen.getByRole('button', { name: /Aggiungi optional/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  expect(screen.getByText('Scrivi il nome.')).toBeInTheDocument();
  expect(salvaOptional).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Catene da neve' } });
  fireEvent.click(screen.getByLabelText('A noleggio'));
  fireEvent.change(screen.getByLabelText(/^Prezzo/), { target: { value: '25' } });
  fireEvent.change(screen.getByLabelText(/^Quanti ne avete/), { target: { value: '4' } });
  expect(screen.getByText('Qualunque durata = 25 € a pezzo.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  await waitFor(() => expect(salvaOptional).toHaveBeenCalledWith(expect.objectContaining({
    nome: 'Catene da neve', modo: 'noleggio', prezzo: '25', pezzi: '4', sulSito: true,
  })));
});

test('nome gia\' usato e "togli dall\'elenco" con conferma', async () => {
  render(<CatalogoOptional />);
  // Il seggiolino non puo' prendere il nome del navigatore.
  fireEvent.click(screen.getAllByRole('button', { name: /Modifica/ })[0]);
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'navigatore' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  expect(screen.getByText(/C'è già un optional/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: "Togli dall'elenco" }));
  fireEvent.click(screen.getAllByRole('button', { name: "Togli dall'elenco" }).pop());
  await waitFor(() => expect(togliOptional).toHaveBeenCalledWith('o1'));
});
