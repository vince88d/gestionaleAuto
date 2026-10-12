import { bozzaEmail, testoRiepilogo, componiTesto, LIMITE_TESTO } from './emailRiepilogo';

const azienda = { nome: 'Formia Rent', telefono: '0771 000000', email: 'info@formiarent.it' };
const consegnata = {
  cliente: 'Mario Rossi', emailCliente: 'mario@example.it', veicolo: 'Fiat Panda', targa: 'GH123AB',
  dataInizio: '2026-10-12', dataFine: '2026-10-15', oraInizio: '09:00', oraFine: '09:00', prezzoTotale: 180,
  protezione: { tipo: 'totale', prezzo: 36, cauzione: 300 }, cauzioneBloccata: true,
  schedaVeicolo: {
    kmIniziali: '45318', carburante: '3/4', danni: 'Graffio portiera destra',
    dotazione: { voci: ['Cric', 'Cavo di ricarica'], presenti: ['Cric'], impostata: true, chiaviConsegnate: 2 },
  },
};

test('consegna: destinatario, oggetto e testo in blocchi con titolo ed elenchi', () => {
  const b = bozzaEmail({ fase: 'consegna', prenotazione: consegnata, azienda });
  expect(b.to).toBe('mario@example.it');
  expect(b.subject).toBe('Verbale di consegna - Fiat Panda GH123AB');
  expect(b.body).toBe([
    'Gentile Mario Rossi,',
    '',
    'Le confermiamo la consegna del veicolo Fiat Panda (GH123AB).',
    '',
    'IL NOLEGGIO',
    '• Consegna: 12/10/2026 alle 9:00',
    '• Riconsegna prevista: entro 15/10/2026 alle 9:00',
    '• Totale noleggio: 180,00 €',
    '',
    "STATO DELL'AUTO",
    '• Chilometri: 45.318 km',
    '• Carburante: 3/4',
    '• Chiavi consegnate: 2',
    '• Danni già presenti: Graffio portiera destra',
    '• Dotazione mancante: Cavo di ricarica',
    '',
    'PROTEZIONE E CAUZIONE',
    '• Protezione: Totale',
    '• Cauzione: 300,00 € (bloccata sulla carta)',
    '',
    'In allegato trova il verbale di consegna.',
    '',
    'Cordiali saluti',
    'Formia Rent',
    'Tel. 0771 000000 · info@formiarent.it',
  ].join('\n'));
});

test('consegna: contratto allegato, firma non apposta e osservazioni in un blocco a parte', () => {
  const { body } = bozzaEmail({
    fase: 'consegna', conContratto: true, azienda,
    prenotazione: { ...consegnata, schedaVeicolo: { ...consegnata.schedaVeicolo, firma: { stato: 'rifiuta', osservazioni: 'Contesta il graffio', registrataIl: '2026-10-12T09:05:00' } } },
  });
  expect(body).toContain('FIRMA DEL VERBALE\nFirma non apposta: il cliente ha rifiutato di firmare. Registrato il 12/10/2026 alle 09:05.\nOsservazioni del cliente: Contesta il graffio');
  expect(body).toContain('In allegato trova il verbale di consegna.\nIn allegato anche il contratto di noleggio.');
});

test('senza email del cliente il destinatario resta vuoto; senza danni lo dice; senza protezione il blocco sparisce', () => {
  const { to, body } = bozzaEmail({ fase: 'consegna', prenotazione: { ...consegnata, emailCliente: '', protezione: undefined, schedaVeicolo: { danni: 'Nessuno' } }, azienda });
  expect(to).toBe('');
  expect(body).toContain('• Danni già presenti: nessuno segnato');
  expect(body).not.toContain('PROTEZIONE E CAUZIONE');
});

const rientrata = {
  ...consegnata, descrizioneDanno: 'Ammaccatura paraurti',
  rientro: {
    dataRientro: '2026-10-15', oraRientro: '11:30', km: 45702, kmConsegna: 45318, carburante: '1/2', carburanteConsegna: '3/4',
    chiaviConsegnate: 2, chiaviTornate: 2, dotazioneNonTornata: ['Triangolo'], extraNonTornati: [],
    addebiti: [{ nome: 'Ritardo: 1 giorno in più', importo: 25 }, { nome: 'Rifornimento', importo: 20 }],
    totaleAddebiti: 45, cauzione: { importo: 300, trattenuta: 45, sbloccata: 255, restano: 0 }, restanoDaPagare: 0,
  },
};

test('rientro: blocchi IL RIENTRO, ADDEBITI e CAUZIONE', () => {
  const b = bozzaEmail({ fase: 'rientro', prenotazione: rientrata, azienda });
  expect(b.subject).toBe('Verbale di rientro - Fiat Panda GH123AB');
  expect(b.body).toBe([
    'Gentile Mario Rossi,',
    '',
    'Le confermiamo il rientro del veicolo Fiat Panda (GH123AB).',
    '',
    'IL RIENTRO',
    '• Rientrato: 15/10/2026 alle 11:30',
    '• Chilometri: 45.318 → 45.702 (384 km percorsi)',
    '• Carburante: 3/4 → 1/2',
    '• Chiavi restituite: 2 su 2',
    '• Non tornato: Triangolo',
    '• Danni nuovi: Ammaccatura paraurti',
    '',
    'ADDEBITI',
    '• Ritardo: 1 giorno in più: 25,00 €',
    '• Rifornimento: 20,00 €',
    'Totale addebiti: 45,00 €',
    '',
    'CAUZIONE',
    '• Cauzione: 300,00 €',
    '• Trattenuti: 45,00 €',
    '• Sbloccati: 255,00 €',
    '',
    'In allegato trova il verbale di rientro.',
    '',
    'Cordiali saluti',
    'Formia Rent',
    'Tel. 0771 000000 · info@formiarent.it',
  ].join('\n'));
});

test('rientro senza addebiti: lo dice; senza cauzione e con addebiti: restano da pagare', () => {
  const senza = { ...rientrata, rientro: { ...rientrata.rientro, addebiti: [], totaleAddebiti: 0, cauzione: null } };
  const b1 = bozzaEmail({ fase: 'rientro', prenotazione: senza, azienda }).body;
  expect(b1).toContain('ADDEBITI\nNessun addebito.');
  expect(b1).not.toContain('PAGAMENTO');
  const conDebito = { ...rientrata, rientro: { ...rientrata.rientro, cauzione: null, restanoDaPagare: 45 } };
  expect(bozzaEmail({ fase: 'rientro', prenotazione: conDebito, azienda }).body).toContain('PAGAMENTO\nRestano da pagare: 45,00 €');
});

test('testo da copiare: senza «in allegato»', () => {
  const t = testoRiepilogo({ fase: 'rientro', prenotazione: rientrata, azienda });
  expect(t).not.toContain('In allegato');
  expect(t).toContain('IL RIENTRO');
  expect(t.endsWith('Cordiali saluti\nFormia Rent\nTel. 0771 000000 · info@formiarent.it')).toBe(true);
});

test('testo troppo lungo: si tolgono le voci facoltative, dall\'ultima', () => {
  const addebiti = Array.from({ length: 40 }, (_, i) => ({ nome: `Voce numero ${i + 1} con un nome abbastanza lungo`, importo: 10 }));
  const lungo = { ...rientrata, rientro: { ...rientrata.rientro, addebiti, totaleAddebiti: 400 } };
  const { body } = bozzaEmail({ fase: 'rientro', prenotazione: lungo, azienda });
  expect(encodeURIComponent(body).length).toBeLessThanOrEqual(LIMITE_TESTO);
  expect(body).toContain('Totale addebiti: 400,00 €');
  expect(body).toContain('In allegato trova il verbale di rientro.');
});

test('componiTesto: blocchi vuoti scartati, righe semplici senza punto elenco', () => {
  const t = componiTesto([{ titolo: 'VUOTO', voci: [] }, { titolo: 'A', voci: [{ t: 'uno', opz: false }, { t: 'due', semplice: true }] }], ['ciao']);
  expect(t).toBe('A\n• uno\ndue\n\nciao');
});
