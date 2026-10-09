import { righeProtezioneExtra } from './pdfConsegna';

test('righe di protezione, cauzione ed extra per il PDF', () => {
  expect(righeProtezioneExtra({
    protezione: { tipo: 'totale', prezzo: 36, danni: 0, furto: 1500, cauzione: 200, copre: { cristalli: true, gomme: true } },
    cauzioneBloccata: true,
    optional: [{ nome: 'Seggiolino', quantita: 1, totale: 24 }, { nome: 'GPS', quantita: 2, totale: 30 }],
  })).toEqual([
    ['Protezione', 'Totale (36,00 EUR)'],
    ['Danni (max)', '0 EUR a carico del cliente'],
    ['Furto (max)', '1.500 EUR a carico del cliente'],
    ['Cauzione', '200 EUR - bloccata sulla carta'],
    ['Copre anche', 'Cristalli, gomme'],
    ['Extra', 'Seggiolino x 1 (24,00 EUR)'],
    ['', 'GPS x 2 (30,00 EUR)'],
  ]);
});

test('Base senza cauzione bloccata; prenotazioni di prima: nessuna riga', () => {
  expect(righeProtezioneExtra({ protezione: { tipo: 'base', prezzo: 0, cauzione: 500 } }))
    .toEqual([['Protezione', 'Base (inclusa)'], ['Cauzione', '500 EUR']]);
  expect(righeProtezioneExtra({ cliente: 'Mario' })).toEqual([]);
});

test('il PDF si genera con la sezione (nessun carattere che il font non sa scrivere)', async () => {
  const { generaRiepilogoPdf } = await import('./pdfConsegna');
  const pdf = await generaRiepilogoPdf({
    cliente: 'Mario Rossi', veicolo: 'Panda', targa: 'AA111AA', dataInizio: '2099-10-12', dataFine: '2099-10-15', prezzoTotale: 135,
    protezione: { tipo: 'totale', prezzo: 36, danni: 0, furto: 300, cauzione: 200, copre: { cristalli: true } },
    cauzioneBloccata: true,
    optional: [{ nome: 'Seggiolino bambino', quantita: 1, totale: 24 }],
  }, { carburante: 'Pieno', kmIniziali: '45000', accessori: { cric: true, altro: '' } });
  expect(pdf.length).toBeGreaterThan(1000);
  if (process.env.PDF_PROVA) require('fs').writeFileSync(process.env.PDF_PROVA, Buffer.from(pdf));
});

test('righe della dotazione: chiavi, a bordo, mancante con la nota; vecchi accessori solo se presenti', () => {
  const { righeDotazione } = require('./pdfConsegna');
  expect(righeDotazione({ dotazione: { voci: ['Cric', 'Cavo di ricarica'], presenti: ['Cric'], impostata: true, chiaviConsegnate: 2, note: 'in officina' } }))
    .toEqual([['Chiavi consegnate', '2'], ['A bordo', 'Cric'], ['Mancante', 'Cavo di ricarica (in officina)']]);
  expect(righeDotazione({ accessori: { cric: true, ruotaScorta: false, altro: '' } })).toEqual([['A bordo', 'Cric']]);
  expect(righeDotazione({})).toEqual([]);
});
