import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VehicleDetailModal from './VehicleDetailModal';

// Il calendario non serve qui (e in jsdom non si disegna): lo sostituisce un segnaposto.
jest.mock('@fullcalendar/react', () => () => <div>calendario</div>);
jest.mock('@fullcalendar/daygrid', () => ({}));
jest.mock('@fullcalendar/core/locales/it', () => ({}));
jest.mock('react-redux', () => ({ useDispatch: () => jest.fn() }));
// react-router-dom v7 non si carica nei test di Create React App: basta useNavigate.
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('../lib/firestorePrenotazioni', () => ({
  isPrenotazioneVisibile: (p) => !['annullata', 'richiesta-sito', 'scaduta', 'pagamento-fallito'].includes(p.status),
  segnaDannoPrenotazioneRiparato: jest.fn(),
}));

const veicolo = {
  id: 'v1', marca: 'Fiat', modello: 'Ducato', targa: 'AB123CD', categoria: 'Furgone',
  anno: 2022, km: 45000, prezzo: 80, prezzoVeicolo: 70,
  scadenze: { assicurazione: '2099-01-01' },
  danni: [
    { descrizione: 'graffio paraurti', daRiparare: true, immagine: 'https://x/danno.webp' },
    { descrizione: 'ammaccatura porta', daRiparare: false },
  ],
  manutenzioni: [{ data: '2026-05-10', descrizione: 'tagliando', costo: 150 }],
};

const prenotazioni = [
  { id: 'p1', targa: 'AB123CD', status: 'attiva', dataInizio: '2099-02-01', dataFine: '2099-02-05', cliente: 'Mario Rossi' },
  { id: 'p2', targa: 'AB123CD', status: 'annullata', dataInizio: '2099-03-01', dataFine: '2099-03-05', cliente: 'Annullato' },
];

const props = {
  isOpen: true, onClose: jest.fn(), veicolo, prenotazioni, onUpdate: jest.fn(), onEdit: jest.fn(),
  onDelete: jest.fn(), onAddDamage: jest.fn(), onDeleteDamage: jest.fn(), damageModalOpen: false,
  setDamageModalOpen: jest.fn(), selectedDamagePhoto: null, setSelectedDamagePhoto: jest.fn(),
  nuovaManutenzione: { data: '', descrizione: '', costo: '' }, setNuovaManutenzione: jest.fn(),
  onAddManutenzione: jest.fn(), onDeleteManutenzione: jest.fn(), onToggleRepairStatus: jest.fn(),
  ariaHideApp: false,
};

const apri = (extra = {}) => render(<VehicleDetailModal {...props} {...extra} />);

test('intestazione con nome, targa, categoria e stato di oggi; si apre sulla Panoramica', () => {
  apri();
  expect(screen.getByRole('heading', { name: 'Fiat Ducato' })).toBeInTheDocument();
  expect(screen.getByText('AB123CD')).toBeInTheDocument();
  expect(screen.getByText('Disponibile oggi')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Panoramica' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('1 danno da riparare')).toBeInTheDocument();
  expect(screen.getByText(/tariffa Furgone/)).toBeInTheDocument();
  expect(screen.getByText('01/01/2099')).toBeInTheDocument();
});

test('le schede mostrano calendario, danni e manutenzioni', () => {
  apri();
  fireEvent.click(screen.getByRole('tab', { name: 'Calendario' }));
  expect(screen.getByText('Mario Rossi')).toBeInTheDocument();
  expect(screen.queryByText('Annullato')).toBeNull(); // le annullate non sono "prossime"

  fireEvent.click(screen.getByRole('tab', { name: /Danni/ }));
  expect(screen.getByText('graffio paraurti')).toBeInTheDocument();
  expect(screen.getByText('Preesistente')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Segna come riparato'));
  expect(props.onToggleRepairStatus).toHaveBeenCalledWith(0);

  fireEvent.click(screen.getByRole('tab', { name: /Manutenzioni/ }));
  expect(screen.getByText('tagliando')).toBeInTheDocument();
  expect(screen.getByText('10/05/2026')).toBeInTheDocument();
});

test('dalla Dashboard (modalLite) niente danni, manutenzioni, modifica ed elimina', () => {
  apri({ modalLite: true });
  expect(screen.queryByRole('tab', { name: /Danni/ })).toBeNull();
  expect(screen.queryByRole('tab', { name: /Manutenzioni/ })).toBeNull();
  expect(screen.queryByText('Modifica')).toBeNull();
  expect(screen.getByText('Nuova prenotazione')).toBeInTheDocument();
});
