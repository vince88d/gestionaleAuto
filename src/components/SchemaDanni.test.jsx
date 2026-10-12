import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SchemaDanni from './SchemaDanni';

// Il disegno e' 380 x 290: lo si mostra a 380 x 290 pixel, cosi' un clic in (x, y) e' il punto (x, y).
const misura = () => {
  const svg = screen.getByTestId('sd-svg');
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 380, height: 290 });
  return svg;
};

function Prova({ iniziali = [], vecchi = [], provato = false, onCambio }) {
  const [segni, setSegni] = useState(iniziali);
  return <SchemaDanni segni={segni} vecchi={vecchi} provato={provato} onChange={(s) => { setSegni(s); onCambio?.(s); }} />;
}

test('toccando l\'auto compare un punto numerato con il campo da compilare', () => {
  const onCambio = jest.fn();
  render(<Prova onCambio={onCambio} />);
  expect(screen.getByText(/Nessun danno segnato/)).toBeInTheDocument();
  fireEvent.click(misura(), { clientX: 300, clientY: 50 });
  expect(onCambio.mock.calls[0][0][0]).toMatchObject({ vista: 'sx', x: 300, y: 50, tipo: 'Graffio', testo: '' });
  const descrizione = screen.getByLabelText('Descrizione del danno 1');
  expect(descrizione).toHaveFocus();
  fireEvent.change(descrizione, { target: { value: 'Portiera sinistra' } });
  fireEvent.change(screen.getByLabelText('Tipo del danno 1'), { target: { value: 'Ammaccatura' } });
  expect(onCambio.mock.calls.at(-1)[0][0]).toMatchObject({ tipo: 'Ammaccatura', testo: 'Portiera sinistra' });
});

test('un clic fuori dalle sagome non aggiunge nulla', () => {
  const onCambio = jest.fn();
  render(<Prova onCambio={onCambio} />);
  fireEvent.click(misura(), { clientX: 160, clientY: 140 });
  expect(onCambio).not.toHaveBeenCalled();
});

test('i danni gia\' presenti sono grigi e fissi; i nuovi continuano la numerazione', () => {
  const vecchi = [{ id: 'v', vista: 'dx', x: 260, y: 186, tipo: 'Graffio', testo: 'Portiera destra' }];
  render(<Prova vecchi={vecchi} />);
  expect(screen.getByText('Portiera destra')).toBeInTheDocument();
  expect(screen.getByText('Già presente')).toBeInTheDocument();
  expect(screen.queryByLabelText('Descrizione del danno 1')).toBeNull();
  fireEvent.click(misura(), { clientX: 75, clientY: 140 });
  expect(screen.getByLabelText('Descrizione del danno 2')).toBeInTheDocument();
});

test('con «provato» il punto senza descrizione e\' segnato come errore', () => {
  render(<Prova provato iniziali={[{ id: 'a', vista: 'alto', x: 75, y: 140, tipo: 'Graffio', testo: '' }]} />);
  expect(screen.getByLabelText('Descrizione del danno 1')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('scrivi cos’è');
});

test('«Togli» toglie il punto', () => {
  const onCambio = jest.fn();
  render(<Prova onCambio={onCambio} iniziali={[{ id: 'a', vista: 'alto', x: 75, y: 140, tipo: 'Graffio', testo: 'x' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Togli il danno 1' }));
  expect(onCambio).toHaveBeenCalledWith([]);
  expect(screen.queryByLabelText('Descrizione del danno 1')).toBeNull();
});

test('da tastiera Invio sulla vista mette il punto al centro', () => {
  const onCambio = jest.fn();
  render(<Prova onCambio={onCambio} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Lato destro: aggiungi un danno' }), { key: 'Enter' });
  expect(onCambio.mock.calls[0][0][0]).toMatchObject({ vista: 'dx' });
});

test('un vecchio danno scritto a mano resta in elenco senza punto', () => {
  render(<Prova iniziali={[{ id: 'testo', vista: null, x: 0, y: 0, tipo: 'Altro', testo: 'Graffio portiera' }]} />);
  expect(screen.getByDisplayValue('Graffio portiera')).toBeInTheDocument();
  expect(screen.getByText('Scritto a mano')).toBeInTheDocument();
});
