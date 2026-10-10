import React from 'react';
import { render, screen } from '@testing-library/react';
import RientroDettagli from './RientroDettagli';

test('niente per i noleggi senza rientro completo', () => {
  const { container } = render(<RientroDettagli prenotazione={{ status: 'completata' }} />);
  expect(container).toBeEmptyDOMElement();
});

test('mostra rientro, addebiti e cauzione', () => {
  render(<RientroDettagli prenotazione={{
    cliente: 'Mario Rossi', veicolo: 'Panda', targa: 'AA111AA', dataInizio: '2026-10-12', dataFine: '2026-10-15',
    rientro: {
      dataRientro: '2026-10-15', oraRientro: '09:00', km: 48400, kmConsegna: 48318, carburante: 'Pieno', carburanteConsegna: 'Pieno',
      dotazioneNonTornata: [], extraNonTornati: [], addebiti: [{ id: 'pulizia', nome: 'Pulizia straordinaria', importo: 30 }],
      totaleAddebiti: 30, cauzione: { importo: 500, trattenuta: 30, sbloccata: 470, restano: 0 }, restanoDaPagare: 0,
    },
  }} />);
  expect(screen.getByText('Rientro')).toBeInTheDocument();
  expect(screen.getByText('48.318 -> 48.400 (82 km)')).toBeInTheDocument();
  expect(screen.getByText('Pulizia straordinaria')).toBeInTheDocument();
  expect(screen.getByText('Sbloccata')).toBeInTheDocument();
});
