import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Clock } from 'lucide-react';
import SezioneImpostazioni from './SezioneImpostazioni';

function Prova({ iniziale = false, stato = null }) {
  const [aperta, setAperta] = useState(iniziale);
  return (
    <SezioneImpostazioni Icona={Clock} titolo="Orari della sede" riassunto="Lun-Ven 9-18" descrizione="Il sito li mostra ai clienti." stato={stato} aperta={aperta} onToggle={() => setAperta((a) => !a)}>
      <input aria-label="Campo di prova" defaultValue="scritto" />
    </SezioneImpostazioni>
  );
}

test('chiusa: titolo e riassunto, contenuto nascosto; il pulsante dice che e\' chiusa', () => {
  render(<Prova />);
  const pulsante = screen.getByRole('button', { name: /Orari della sede/ });
  expect(pulsante).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('Lun-Ven 9-18')).toBeInTheDocument();
  expect(screen.getByLabelText('Campo di prova', { selector: 'input' })).not.toBeVisible();
});

test('si apre e si richiude col pulsante (clic o tastiera); da aperta il riassunto lascia posto alla descrizione', () => {
  render(<Prova />);
  const pulsante = screen.getByRole('button', { name: /Orari della sede/ });
  fireEvent.click(pulsante);
  expect(pulsante).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('region', { name: /Orari della sede/ })).toBeVisible();
  expect(screen.queryByText('Lun-Ven 9-18')).toBeNull();
  expect(screen.getByText('Il sito li mostra ai clienti.')).toBeInTheDocument();
  fireEvent.click(pulsante);
  expect(pulsante).toHaveAttribute('aria-expanded', 'false');
});

test('quello che si e\' scritto non si perde richiudendo', () => {
  render(<Prova iniziale />);
  const campo = screen.getByLabelText('Campo di prova');
  fireEvent.change(campo, { target: { value: 'nuovo testo' } });
  fireEvent.click(screen.getByRole('button', { name: /Orari della sede/ }));
  fireEvent.click(screen.getByRole('button', { name: /Orari della sede/ }));
  expect(screen.getByLabelText('Campo di prova')).toHaveValue('nuovo testo');
});

test('lo stato resta visibile anche da chiusa', () => {
  render(<Prova stato={{ testo: 'Modifiche non salvate', tono: 'attenzione' }} />);
  expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument();
});
