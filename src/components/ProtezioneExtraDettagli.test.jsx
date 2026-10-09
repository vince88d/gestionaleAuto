import React from 'react';
import { render, screen } from '@testing-library/react';
import ProtezioneExtraDettagli from './ProtezioneExtraDettagli';

test('mostra protezione, franchigie, cauzione, coperture ed extra', () => {
  render(<ProtezioneExtraDettagli prenotazione={{
    protezione: { tipo: 'totale', prezzo: 36, danni: 0, furto: 300, cauzione: 200, copre: { cristalli: true, gomme: true, sottoscocca: false } },
    optional: [{ id: 's', nome: 'Seggiolino', quantita: 1, totale: 24 }, { id: 'x', nome: 'Zero', quantita: 0, totale: 0 }],
  }} />);
  expect(screen.getByText('Totale · 36,00 €')).toBeInTheDocument();
  expect(screen.getByText('200 €')).toBeInTheDocument();
  expect(screen.getByText('Cristalli, gomme')).toBeInTheDocument();
  expect(screen.getByText('Seggiolino × 1 · 24,00 €')).toBeInTheDocument();
  expect(screen.queryByText(/Zero/)).toBeNull();
});

test('prenotazione di prima, senza protezione ne\' extra: niente', () => {
  const { container } = render(<ProtezioneExtraDettagli prenotazione={{ cliente: 'Mario' }} />);
  expect(container).toBeEmptyDOMElement();
});
