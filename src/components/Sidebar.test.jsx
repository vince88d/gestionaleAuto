import React from 'react';
import { render, screen } from '@testing-library/react';
import Sidebar from './Sidebar';

// react-router-dom v7 non si carica nei test di Create React App: il menu usa solo questi pezzi.
jest.mock('react-router-dom', () => ({
  NavLink: ({ to, children, className }) => <a href={to} className={typeof className === 'function' ? className({ isActive: false }) : className}>{children}</a>,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/' }),
}), { virtual: true });
jest.mock('firebase/auth', () => ({ signOut: jest.fn() }));
jest.mock('./firebase', () => ({ auth: {} }));
const mockAzienda = { dati: {} };
jest.mock('../lib/firestoreAzienda', () => ({ useAzienda: () => mockAzienda }));

function pngConMisure(l, a) {
  const byte = new Uint8Array(33);
  byte.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const v = new DataView(byte.buffer);
  v.setUint32(16, l); v.setUint32(20, a);
  return `data:image/png;base64,${Buffer.from(byte).toString('base64')}`;
}
const apri = () => render(<Sidebar collapsed={false} toggleSidebar={jest.fn()} />);

test('senza logo il menu mostra le iniziali', () => {
  mockAzienda.dati = { nome: 'Formia Rent' };
  const { container } = apri();
  expect(container.querySelector('.brand-badge').textContent).toBe('FR');
  expect(container.querySelector('.brand-badge img')).toBeNull();
});

test('un logo quasi quadrato prende il posto delle iniziali', () => {
  mockAzienda.dati = { nome: 'Formia Rent', logo: pngConMisure(120, 100) };
  const { container } = apri();
  expect(container.querySelector('.brand-badge--logo img')).toHaveAttribute('src', mockAzienda.dati.logo);
});

test('un logo largo non va nel menu: restano le iniziali', () => {
  mockAzienda.dati = { nome: 'Formia Rent', logo: pngConMisure(320, 90) };
  const { container } = apri();
  expect(container.querySelector('.brand-badge img')).toBeNull();
  expect(container.querySelector('.brand-badge').textContent).toBe('FR');
});
