import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SceltaAutoModal from './SceltaAutoModal';

const prenotazione = {
  id: 'p1', origine: 'sito', status: 'attiva', categoria: 'Furgone', cliente: 'Mario Rossi',
  dataInizio: '2026-10-10', oraInizio: '16:00', dataFine: '2026-10-12', oraFine: '16:00',
};
const ducato = { marca: 'Fiat', modello: 'Ducato', targa: 'AB123TR', categoria: 'Furgone', km: 84300 };
const transit = { marca: 'Ford', modello: 'Transit', targa: 'CD456EF', categoria: 'Furgone' };

test('nessuna auto libera: lo dice e non si puo\' confermare', () => {
  render(<SceltaAutoModal prenotazione={prenotazione} veicoliLiberi={[]} onClose={jest.fn()} onConferma={jest.fn()} />);
  expect(screen.getByRole('alert').textContent).toMatch(/Nessuna auto «Furgone» è libera/);
  expect(screen.queryByRole('button', { name: /Scegli/ })).toBeNull();
});

test('ritiro oggi: "Scegli e consegna ora" passa l\'auto scelta e consegna=true', async () => {
  const onConferma = jest.fn().mockResolvedValue();
  render(<SceltaAutoModal prenotazione={prenotazione} veicoliLiberi={[ducato, transit]} consegnaSubito onClose={jest.fn()} onConferma={onConferma} />);
  const principale = screen.getByRole('button', { name: 'Scegli e consegna ora' });
  expect(principale.disabled).toBe(true); // prima si sceglie l'auto
  fireEvent.click(screen.getByRole('radio', { name: /CD456EF/ }));
  fireEvent.click(principale);
  await waitFor(() => expect(onConferma).toHaveBeenCalledWith({ veicolo: transit, consegna: true }));
  expect(screen.getByRole('button', { name: 'Solo scegli' })).toBeTruthy();
});

test('ritiro in un altro giorno, una sola auto: gia\' scelta, solo "Scegli questa auto"', async () => {
  const onConferma = jest.fn().mockResolvedValue();
  render(<SceltaAutoModal prenotazione={prenotazione} veicoliLiberi={[ducato]} onClose={jest.fn()} onConferma={onConferma} />);
  expect(screen.queryByRole('button', { name: /consegna ora/ })).toBeNull();
  expect(screen.getByText('84.300 km')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Scegli questa auto' }));
  await waitFor(() => expect(onConferma).toHaveBeenCalledWith({ veicolo: ducato, consegna: false }));
});

describe('cambio auto (neopatentato con auto non adatta)', () => {
  const neopat = { ...prenotazione, origine: undefined, categoria: 'Berlina', rilascioPatente: '2025-03-14', dataInizio: '2026-10-19', dataFine: '2026-10-22' };
  const tipo = { marca: 'Fiat', modello: 'Tipo', targa: 'BA123CD', categoria: 'Berlina', potenzaKw: 74, taraKg: 1200 };
  const bmw = { marca: 'BMW', modello: '320d', targa: 'CD456EF', categoria: 'Berlina', potenzaKw: 140, taraKg: 1500 };

  test('titolo di cambio e l\'auto adatta si sceglie', async () => {
    const onConferma = jest.fn().mockResolvedValue();
    render(<SceltaAutoModal cambio categoria="Berlina" prenotazione={neopat} veicoliLiberi={[tipo, bmw]} onClose={jest.fn()} onConferma={onConferma} onModifica={jest.fn()} />);
    expect(screen.getByText(/Scegli un'altra auto per/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: /CD456EF/ }).disabled).toBe(true); // BMW oltre i limiti
    fireEvent.click(screen.getByRole('button', { name: 'Scegli questa auto' }));
    await waitFor(() => expect(onConferma).toHaveBeenCalledWith({ veicolo: tipo, consegna: false }));
  });

  test('nessuna auto adatta: lo dice e manda a «Modifica la prenotazione»', () => {
    const onModifica = jest.fn();
    render(<SceltaAutoModal cambio categoria="Berlina" prenotazione={neopat} veicoliLiberi={[bmw]} onClose={jest.fn()} onConferma={jest.fn()} onModifica={onModifica} />);
    expect(screen.getByText(/Nessuna auto «Berlina» adatta a questo cliente/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Modifica la prenotazione' }));
    expect(onModifica).toHaveBeenCalled();
  });

  test('nessun\'altra auto libera: messaggio di cambio con «Modifica la prenotazione»', () => {
    render(<SceltaAutoModal cambio categoria="Berlina" prenotazione={neopat} veicoliLiberi={[]} onClose={jest.fn()} onConferma={jest.fn()} onModifica={jest.fn()} />);
    expect(screen.getByRole('alert').textContent).toMatch(/Nessun'altra auto «Berlina» è libera/);
    expect(screen.getByRole('button', { name: 'Modifica la prenotazione' })).toBeTruthy();
  });
});
