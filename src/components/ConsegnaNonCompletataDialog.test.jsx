import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConsegnaNonCompletataDialog from './ConsegnaNonCompletataDialog';

const prenotazione = { cliente: 'Luca Neri', veicolo: 'Fiat Panda', targa: 'GH123AB' };
const apri = () => {
  const azioni = { onRiprendi: jest.fn(), onPiuTardi: jest.fn(), onAnnulla: jest.fn() };
  render(<ConsegnaNonCompletataDialog open prenotazione={prenotazione} {...azioni} />);
  return azioni;
};

test('dice che la prenotazione e\' salvata e l\'auto occupata', () => {
  apri();
  expect(screen.getByText(/La prenotazione di Luca Neri è già salvata e Fiat Panda \(GH123AB\) risulta occupata/)).toBeInTheDocument();
});

test('tre scelte, ognuna chiama la sua azione', () => {
  const a = apri();
  fireEvent.click(screen.getByRole('button', { name: /Riprendi la consegna/ }));
  fireEvent.click(screen.getByRole('button', { name: /Consegno più tardi/ }));
  fireEvent.click(screen.getByRole('button', { name: /Annulla anche la prenotazione/ }));
  expect(a.onRiprendi).toHaveBeenCalledTimes(1);
  expect(a.onPiuTardi).toHaveBeenCalledTimes(1);
  expect(a.onAnnulla).toHaveBeenCalledTimes(1);
});
