import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AspettoDocumenti from './AspettoDocumenti';
import { preparaLogo } from '../utils/logoAzienda';

jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../utils/logoAzienda', () => ({
  ...jest.requireActual('../utils/logoAzienda'),
  preparaLogo: jest.fn(),
}));

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const azienda = { nome: 'Formia Rent', indirizzo: 'Via Lungomare 12', partitaIva: '01234567890' };
const apri = (dati = azienda, onSalva = jest.fn().mockResolvedValue(true)) => {
  render(<AspettoDocumenti dati={dati} onSalva={onSalva} />);
  return onSalva;
};
const salva = () => screen.getByRole('button', { name: 'Salva' });
const anteprima = () => screen.getByTestId('anteprima-verbale');

beforeEach(() => { preparaLogo.mockReset(); });

test('senza logo ne\' colore: iniziali, colore di base e Salva spento', () => {
  apri();
  expect(screen.getByText('nessun logo')).toBeInTheDocument();
  expect(anteprima()).toHaveTextContent('FR');
  expect(anteprima()).toHaveTextContent('Formia Rent');
  expect(anteprima().style.getPropertyValue('--asp-acc')).toBe('#222222');
  expect(screen.getByRole('radio', { name: 'Colore Nero' })).toBeChecked();
  expect(salva()).toBeDisabled();
});

test('scegliendo un colore cambia l\'anteprima e si salva il codice', async () => {
  const onSalva = apri();
  fireEvent.click(screen.getByRole('radio', { name: 'Colore Rosso scuro' }));
  expect(screen.getByRole('radio', { name: 'Colore Rosso scuro' })).toBeChecked();
  expect(anteprima().style.getPropertyValue('--asp-acc')).toBe('#8b2e2e');
  expect(screen.getByText('Si legge bene')).toBeInTheDocument();
  fireEvent.click(salva());
  await waitFor(() => expect(onSalva).toHaveBeenCalledWith({ logo: '', coloreAccento: '#8b2e2e' }));
});

test('«Colore di base» torna al colore di serie (si salva vuoto)', async () => {
  const onSalva = apri({ ...azienda, coloreAccento: '#8b2e2e' });
  fireEvent.click(screen.getByRole('button', { name: 'Colore di base' }));
  expect(anteprima().style.getPropertyValue('--asp-acc')).toBe('#222222');
  fireEvent.click(salva());
  await waitFor(() => expect(onSalva).toHaveBeenCalledWith({ logo: '', coloreAccento: '' }));
});

test('un colore troppo chiaro lo dice e nell\'anteprima si usa quello di base', () => {
  apri();
  fireEvent.change(screen.getByLabelText('Colore, codice esadecimale'), { target: { value: '#ffff00' } });
  expect(screen.getByText('Troppo chiaro')).toBeInTheDocument();
  expect(anteprima().style.getPropertyValue('--asp-acc')).toBe('#222222');
});

test('un codice colore sbagliato non si salva', () => {
  apri();
  fireEvent.change(screen.getByLabelText('Colore, codice esadecimale'), { target: { value: '#12' } });
  expect(screen.getByRole('alert')).toHaveTextContent('Scrivi 6 caratteri');
  expect(salva()).toBeDisabled();
});

test('carica un logo: anteprima, dettagli e salvataggio', async () => {
  preparaLogo.mockResolvedValue({ logo: PNG, larghezza: 320, altezza: 90, kb: 18 });
  const onSalva = apri();
  const file = new File(['x'], 'formia-rent-logo.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Scegli il file del logo'), { target: { files: [file] } });
  expect(await screen.findByAltText('Logo dell\'azienda')).toHaveAttribute('src', PNG);
  expect(screen.getByText('formia-rent-logo.png · 320 × 90 px · 18 KB')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Cambia logo/ })).toBeInTheDocument();
  expect(anteprima().querySelector('img.asp-doc-logo')).toHaveAttribute('src', PNG);
  fireEvent.click(salva());
  await waitFor(() => expect(onSalva).toHaveBeenCalledWith({ logo: PNG, coloreAccento: '' }));
});

test('un file che non va: messaggio chiaro e niente cambia', async () => {
  preparaLogo.mockRejectedValue(new Error('tipo-non-valido'));
  apri();
  fireEvent.change(screen.getByLabelText('Scegli il file del logo'), { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Scegli un file PNG, JPG, WebP o SVG.');
  expect(salva()).toBeDisabled();
});

test('logo gia\' salvato: «Togli» lo toglie e si salva vuoto', async () => {
  const onSalva = apri({ ...azienda, logo: PNG });
  expect(screen.getByAltText('Logo dell\'azienda')).toBeInTheDocument();
  expect(screen.getByText('1 × 1 px · 1 KB')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Togli/ }));
  expect(screen.getByText('nessun logo')).toBeInTheDocument();
  fireEvent.click(salva());
  await waitFor(() => expect(onSalva).toHaveBeenCalledWith({ logo: '', coloreAccento: '' }));
});

test('«Annulla modifiche» riporta com\'era', () => {
  apri();
  fireEvent.click(screen.getByRole('radio', { name: 'Colore Verde' }));
  fireEvent.click(screen.getByRole('button', { name: 'Annulla modifiche' }));
  expect(screen.getByRole('radio', { name: 'Colore Nero' })).toBeChecked();
  expect(salva()).toBeDisabled();
});
