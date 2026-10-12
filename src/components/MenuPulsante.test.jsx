import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MenuPulsante from './MenuPulsante';

const sezioni = [{ titolo: 'Scarica', voci: [{ etichetta: 'Uno', onClick: jest.fn() }] }];

// Misure finte: il contenitore (.pz) va da 100 a 900, il pulsante e' dove lo si dice.
function conMisure(leftPulsante) {
  const rect = (left, width) => ({ left, right: left + width, top: 0, bottom: 0, width, height: 0 });
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function misura() {
    if (this.classList?.contains('pz')) return rect(100, 800);
    return rect(leftPulsante, 140);
  });
}

afterEach(() => jest.restoreAllMocks());

function monta() {
  return render(<div className="pz"><MenuPulsante etichetta="Invia" sezioni={sezioni} /></div>);
}

test('pulsante a sinistra: il menu si apre sotto di lui, senza spostamenti', () => {
  conMisure(120);
  monta();
  fireEvent.click(screen.getByRole('button', { name: /invia/i }));
  expect(screen.getByRole('menu')).toHaveStyle({ left: '0px', width: '310px' });
});

test('pulsante vicino al bordo destro: il menu si sposta a sinistra e resta dentro la finestra', () => {
  conMisure(800); // 800 + 310 supera il bordo destro (900)
  monta();
  fireEvent.click(screen.getByRole('button', { name: /invia/i }));
  // x = min(800, 900 - 310 - 8) = 582 -> 582 - 800 = -218
  expect(screen.getByRole('menu')).toHaveStyle({ left: '-218px' });
});

test('chiude con Esc e clic fuori, e le voci disattivate non si cliccano', () => {
  conMisure(120);
  render(<div className="pz"><p>fuori</p><MenuPulsante etichetta="Invia" sezioni={[{ voci: [{ etichetta: 'Uno', disattiva: true, onClick: jest.fn() }] }]} /></div>);
  fireEvent.click(screen.getByRole('button', { name: /invia/i }));
  expect(screen.getByRole('menuitem', { name: /uno/i })).toBeDisabled();
  fireEvent.mouseDown(screen.getByText('fuori'));
  expect(screen.queryByRole('menu')).toBeNull();
});
