import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VehicleForm from './VehicleForm';

const base = {
  marca: 'Fiat', modello: 'Ducato', targa: 'AD123XY', categoria: 'Furgone', anno: '', km: '', porte: '',
  colore: '', carburante: '', cambio: '', note: '', immagine: 'https://x/foto.webp',
  scadenze: { assicurazione: '', bollo: '', revisione: '' },
};

const apri = (extra = {}) => {
  const props = {
    formData: base, onChange: jest.fn(), onClose: jest.fn(), onSubmit: jest.fn((e) => e.preventDefault()),
    onImageSelect: jest.fn(), isEditing: true, setFormData: jest.fn(), categorie: ['City Car', 'Furgone'], ...extra,
  };
  render(<VehicleForm {...props} />);
  return props;
};

test('in modifica mostra titolo, veicolo e avviso sul cambio di targa', () => {
  apri();
  expect(screen.getByRole('heading', { name: 'Modifica veicolo' })).toBeInTheDocument();
  expect(screen.getByText('Fiat Ducato · AD123XY')).toBeInTheDocument();
  expect(screen.getByText('Se la cambi, si aggiornano anche le sue prenotazioni.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Salva modifiche' })).toBeInTheDocument();
});

test('la targa si scrive maiuscola e senza spazi', () => {
  const { onChange } = apri();
  fireEvent.change(screen.getByLabelText(/Targa/), { target: { value: 'ab 12-3cd' } });
  expect(onChange).toHaveBeenCalledWith({ target: { name: 'targa', value: 'AB123CD' } });
});

test('gli errori compaiono sotto i campi', () => {
  apri({ errori: { targa: 'Questa targa è già di Citroen C3.', marca: 'Inserisci la marca.' } });
  expect(screen.getByText('Questa targa è già di Citroen C3.')).toBeInTheDocument();
  expect(screen.getByText('Inserisci la marca.')).toBeInTheDocument();
  expect(screen.getByText('Controlla i campi segnati in rosso.')).toBeInTheDocument();
  expect(screen.getByLabelText(/Targa/)).toHaveAttribute('aria-invalid', 'true');
});

test('la foto si puo\' togliere; durante il salvataggio i pulsanti sono bloccati', () => {
  const { setFormData } = apri({ salvando: true });
  fireEvent.click(screen.getByText('Togli foto'));
  expect(setFormData).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Salvataggio…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Annulla' })).toBeDisabled();
});

describe('dotazione a bordo', () => {
  // setFormData vero: riceve una funzione (prev) => nuovo, come useState.
  const conStato = (iniziali, extra = {}) => {
    let dati = { ...base, ...iniziali };
    const { rerender } = render(<VehicleForm formData={dati} onChange={jest.fn()} onClose={jest.fn()} onSubmit={jest.fn()}
      onImageSelect={jest.fn()} isEditing setFormData={(f) => { dati = f(dati); rerender(<VehicleForm formData={dati} onChange={jest.fn()} onClose={jest.fn()} onSubmit={jest.fn()} onImageSelect={jest.fn()} isEditing setFormData={() => {}} categorie={[]} {...extra} />); }}
      categorie={[]} {...extra} />);
    return () => dati;
  };

  test('si spuntano le voci, se ne aggiungono di nuove, si scelgono le chiavi', () => {
    const dati = conStato({ dotazione: ['Cric'], chiavi: 2 });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Triangolo' }));
    expect(dati().dotazione).toEqual(['Cric', 'Triangolo']);
  });

  test('voce nuova con Invio e chiavi', () => {
    const dati = conStato({ dotazione: ['Cric'], chiavi: 2 });
    fireEvent.change(screen.getByLabelText('Altra voce della dotazione'), { target: { value: 'Tappetini' } });
    fireEvent.keyDown(screen.getByLabelText('Altra voce della dotazione'), { key: 'Enter' });
    expect(dati().dotazione).toEqual(['Cric', 'Tappetini']);
  });

  test('chiavi e gomme invernali', () => {
    const dati = conStato({ dotazione: [], chiavi: 2 });
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    expect(dati().chiavi).toBe(1);
  });

  test('auto elettrica senza cavo: avviso; veicolo mai impostato: avviso', () => {
    conStato({ dotazione: ['Cric'], carburante: 'Elettrico' }, { dotazioneNonImpostata: true });
    expect(screen.getByText(/controlla che ci sia il/)).toBeInTheDocument();
    expect(screen.getByText(/Dotazione non ancora impostata/)).toBeInTheDocument();
  });
});
