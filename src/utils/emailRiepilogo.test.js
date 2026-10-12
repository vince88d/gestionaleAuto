import { bozzaEmail, componiTesto, LIMITE_TESTO } from './emailRiepilogo';

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

test('consegna: destinatario, oggetto e riepilogo', () => {
  const b = bozzaEmail({ fase: 'consegna', prenotazione: consegnata, azienda });
  expect(b.to).toBe('mario@example.it');
  expect(b.subject).toBe('Verbale di consegna - Fiat Panda GH123AB');
  expect(b.body).toContain('Gentile Mario Rossi,');
  expect(b.body).toContain('Consegna: 12/10/2026 alle 9:00');
  expect(b.body).toContain('Riconsegna prevista: entro 15/10/2026 alle 9:00');
  expect(b.body).toContain('Chilometri alla consegna: 45.318 km');
  expect(b.body).toContain('Carburante: 3/4');
  expect(b.body).toContain('Danni già presenti: Graffio portiera destra');
  expect(b.body).toContain('Dotazione mancante: Cavo di ricarica');
  expect(b.body).toContain('Cauzione 300,00 € (bloccata sulla carta)');
  expect(b.body).toContain('In allegato trova il verbale di consegna.');
  expect(b.body.endsWith('Formia Rent\nTel. 0771 000000 · info@formiarent.it')).toBe(true);
});

test('consegna: contratto allegato, firma non apposta e osservazioni', () => {
  const b = bozzaEmail({
    fase: 'consegna', conContratto: true, azienda,
    prenotazione: { ...consegnata, schedaVeicolo: { ...consegnata.schedaVeicolo, firma: { stato: 'rifiuta', osservazioni: 'Contesta il graffio', registrataIl: '2026-10-12T09:05:00' } } },
  });
  expect(b.body).toContain('Firma non apposta: il cliente ha rifiutato di firmare.');
  expect(b.body).toContain('Osservazioni del cliente: Contesta il graffio');
  expect(b.body).toContain('In allegato anche il contratto di noleggio.');
});

test('senza email del cliente il destinatario resta vuoto, senza danni lo dice', () => {
  const b = bozzaEmail({ fase: 'consegna', prenotazione: { ...consegnata, emailCliente: '', schedaVeicolo: { danni: 'Nessuno' } }, azienda });
  expect(b.to).toBe('');
  expect(b.body).toContain('Danni già presenti: nessuno segnato');
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

test('rientro: km, carburante, danni, addebiti e cauzione', () => {
  const b = bozzaEmail({ fase: 'rientro', prenotazione: rientrata, azienda });
  expect(b.subject).toBe('Verbale di rientro - Fiat Panda GH123AB');
  expect(b.body).toContain('Rientrato: 15/10/2026 alle 11:30');
  expect(b.body).toContain('Chilometri: 45.318 → 45.702 (384 km percorsi)');
  expect(b.body).toContain('Carburante: 3/4 → 1/2');
  expect(b.body).toContain('Non tornato: Triangolo');
  expect(b.body).toContain('Danni nuovi: Ammaccatura paraurti');
  expect(b.body).toContain('- Rifornimento: 20,00 €');
  expect(b.body).toContain('Totale addebiti: 45,00 €');
  expect(b.body).toContain('Cauzione: 300,00 € · trattenuti 45,00 € · sbloccati 255,00 €');
  expect(b.body).toContain('In allegato trova il verbale di rientro.');
});

test('rientro senza addebiti: lo dice; senza cauzione e con addebiti: restano da pagare', () => {
  const senza = { ...rientrata, rientro: { ...rientrata.rientro, addebiti: [], totaleAddebiti: 0, cauzione: null } };
  expect(bozzaEmail({ fase: 'rientro', prenotazione: senza, azienda }).body).toContain('Addebiti: nessuno');
  const conDebito = { ...rientrata, rientro: { ...rientrata.rientro, cauzione: null, restanoDaPagare: 45 } };
  expect(bozzaEmail({ fase: 'rientro', prenotazione: conDebito, azienda }).body).toContain('Restano da pagare: 45,00 €');
});

test('testo troppo lungo: si tolgono le righe facoltative, dall\'ultima', () => {
  const addebiti = Array.from({ length: 40 }, (_, i) => ({ nome: `Voce numero ${i + 1} con un nome abbastanza lungo`, importo: 10 }));
  const lungo = { ...rientrata, rientro: { ...rientrata.rientro, addebiti, totaleAddebiti: 400 } };
  const { body } = bozzaEmail({ fase: 'rientro', prenotazione: lungo, azienda });
  expect(encodeURIComponent(body).length).toBeLessThanOrEqual(LIMITE_TESTO);
  expect(body).toContain('Totale addebiti: 400,00 €'); // non facoltativa
  expect(body).toContain('In allegato trova il verbale di rientro.');
});

test('componiTesto: righe vuote scartate e chiusura in fondo', () => {
  expect(componiTesto([null, { t: 'a', opz: false }], ['', 'ciao'])).toBe('a\n\nciao');
});
