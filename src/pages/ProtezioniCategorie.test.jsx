import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ProtezioniCategorie from './ProtezioniCategorie';
import { salvaProtezioni, salvaTestiProtezioni } from '../lib/firestoreProtezioni';

const salvate = {
  perCategoria: {
    'City Car': {
      base: { danni: 1200, furto: 1500, cauzione: 500 },
      totale: { offerta: true, prezzoGiorno: 12, massimo: 120, danni: 0, furto: 300, cauzione: 200, copre: { cristalli: true } },
    },
    Furgone: { base: { danni: 2500, furto: 3000, cauzione: 1000 }, totale: { offerta: false } },
  },
  nonCopre: 'Chiavi perse',
  cauzioneTesto: '',
};

jest.mock('../lib/firestoreVeicoli', () => ({ ascoltaVeicoli: (cb) => { cb([{ id: '1', categoria: 'City Car' }]); return () => {}; } }));
jest.mock('../lib/firestoreCategorie', () => ({ ascoltaCategorie: (cb) => { cb(['City Car', 'Furgone', 'SUV']); return () => {}; } }));
jest.mock('../lib/firestoreProtezioni', () => {
  const { normalizzaProtezioni } = jest.requireActual('../utils/protezioni');
  return {
    ascoltaProtezioni: (cb) => { cb(normalizzaProtezioni(mockSalvate())); return () => {}; },
    salvaProtezioni: jest.fn(async () => {}),
    salvaTestiProtezioni: jest.fn(async () => {}),
  };
});
// eslint-disable-next-line no-unused-vars
function mockSalvate() { return salvate; }
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const riga = (testo) => screen.getAllByRole('row').find((r) => within(r).queryByText(testo));

beforeEach(() => jest.clearAllMocks());

test('elenco: Base e Totale per categoria, "Non offerta" e "Da impostare"', () => {
  render(<ProtezioniCategorie />);
  expect(riga('City Car').textContent).toContain('1.200 €');
  expect(riga('City Car').textContent).toContain('+12 € al giorno · max 120 €');
  expect(riga('Furgone').textContent).toContain('Non offerta');
  expect(riga('SUV').textContent).toContain('Da impostare');
  expect(within(riga('SUV')).getByRole('button', { name: 'Imposta' })).toBeInTheDocument();
});

test('imposta una categoria: controlla i campi, poi salva solo quella', async () => {
  render(<ProtezioniCategorie />);
  fireEvent.click(within(riga('SUV')).getByRole('button', { name: 'Imposta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  expect(screen.getAllByText('Scrivi l\'importo (anche 0).')).toHaveLength(3);
  expect(salvaProtezioni).not.toHaveBeenCalled();

  const form = screen.getByRole('form', { name: 'Protezioni SUV' });
  fireEvent.change(within(form).getByLabelText('Danni'), { target: { value: '1.800' } });
  fireEvent.change(within(form).getByLabelText('Furto'), { target: { value: '2500' } });
  fireEvent.change(within(form).getByLabelText('Cauzione'), { target: { value: '800' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  await waitFor(() => expect(salvaProtezioni).toHaveBeenCalledWith(['SUV'], expect.objectContaining({
    base: { danni: 1800, furto: 2500, cauzione: 800 },
    totale: expect.objectContaining({ offerta: false }),
  })));
});

test('la Totale non puo\' far pagare piu\' della Base', () => {
  render(<ProtezioniCategorie />);
  fireEvent.click(within(riga('City Car')).getByRole('button', { name: /Modifica/ }));
  expect(screen.getByText(/Esempio per 3 giorni: Base inclusa, Totale \+36 €/)).toBeInTheDocument();
  const cauzioni = screen.getAllByLabelText('Cauzione');
  fireEvent.change(cauzioni[1], { target: { value: '600' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  expect(screen.getByText('Non più della Base (cauzione).')).toBeInTheDocument();
  expect(salvaProtezioni).not.toHaveBeenCalled();
});

test('i testi comuni si salvano solo se cambiati', async () => {
  render(<ProtezioniCategorie />);
  const bottone = screen.getByRole('button', { name: 'Salva testi' });
  expect(bottone).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Cosa non copre nessuna protezione'), { target: { value: 'Chiavi perse, ebbrezza' } });
  fireEvent.click(bottone);
  await waitFor(() => expect(salvaTestiProtezioni).toHaveBeenCalledWith({ nonCopre: 'Chiavi perse, ebbrezza', cauzioneTesto: '' }));
});

test('copia gli stessi valori su altre categorie, avvisando se ne sostituisce', async () => {
  render(<ProtezioniCategorie />);
  fireEvent.click(within(riga('City Car')).getByRole('button', { name: /Modifica/ }));
  fireEvent.click(screen.getByRole('button', { name: /Copia questi valori su altre categorie/ }));
  fireEvent.click(screen.getByLabelText('SUV'));
  fireEvent.click(screen.getByLabelText('Furgone'));
  expect(screen.getByText(/Furgone ha già i suoi valori: salvando vengono sostituiti/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Salva su 3 categorie' }));
  await waitFor(() => expect(salvaProtezioni).toHaveBeenCalledWith(
    ['City Car', 'SUV', 'Furgone'],
    expect.objectContaining({ base: { danni: 1200, furto: 1500, cauzione: 500 } }),
  ));
});
