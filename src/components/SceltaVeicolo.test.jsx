import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SceltaVeicolo from './SceltaVeicolo';
import { controlloAbbinamento } from '../utils/neopatentati';

const panda = { targa: 'AB123CD', marca: 'Fiat', modello: 'Panda', categoria: 'City Car', carburante: 'Benzina', potenzaKw: 66, taraKg: 1050 };
const potente = { targa: 'EF456GH', marca: 'Alfa', modello: 'Giulietta', categoria: 'City Car', carburante: 'Diesel', potenzaKw: 110, taraKg: 1300 };

const motivoNonAdatta = (v) => {
  const c = controlloAbbinamento({ veicolo: v, rilascio: '2025-03-14', ritiro: '2026-10-20' });
  return c.ok ? '' : c.messaggio;
};

test('a un neopatentato le auto troppo potenti non si propongono e si possono mostrare con il motivo', () => {
  render(<SceltaVeicolo veicoli={[panda, potente]} inizio="2026-10-20" fine="2026-10-22" motivoNonAdatta={motivoNonAdatta} onScegli={() => {}} />);
  expect(screen.getByText(/Panda/)).toBeInTheDocument();
  expect(screen.queryByText(/Giulietta/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Mostra anche i 1 non disponibili/ }));
  const giulietta = screen.getByRole('radio', { name: /Giulietta/ });
  expect(giulietta).toBeDisabled();
  expect(screen.getByText(/oltre il limite di 75/)).toBeInTheDocument();
});

test('senza limiti da rispettare tutte le auto si scelgono', () => {
  render(<SceltaVeicolo veicoli={[panda, potente]} inizio="2026-10-20" fine="2026-10-22" onScegli={() => {}} />);
  expect(screen.getByRole('radio', { name: /Giulietta/ })).toBeEnabled();
});
