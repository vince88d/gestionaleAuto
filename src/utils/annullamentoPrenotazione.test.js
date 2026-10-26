import { testoAnnullamento } from './annullamentoPrenotazione';

test('dice che l\'auto torna libera e che la prenotazione va nel Cestino', () => {
  const t = testoAnnullamento({ cliente: 'Luca Neri', veicolo: 'Fiat Panda', targa: 'GH123AB', dataInizio: '2026-10-26', dataFine: '2026-10-29' });
  expect(t).toContain('Prenotazione di Luca Neri.');
  expect(t).toContain('Fiat Panda (GH123AB) torna libera dal 26/10/2026 al 29/10/2026.');
  expect(t).toContain('Cestino');
  expect(t).toContain('6 mesi');
});

test('senza auto assegnata (solo categoria)', () => {
  expect(testoAnnullamento({ cliente: 'Anna', categoria: 'Utilitaria', dataInizio: '2026-10-26', dataFine: '2026-10-29' })).toContain("L'auto torna libera dal");
});

test('senza prenotazione, testo vuoto', () => {
  expect(testoAnnullamento(null)).toBe('');
});
