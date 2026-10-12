import { PDFDocument } from 'pdf-lib';
import { vociProtezioneExtra, generaRiepilogoPdf } from './pdfConsegna';

test('voci di protezione, cauzione ed extra per la tabella del PDF', () => {
  const { righe, cauzione } = vociProtezioneExtra({
    protezione: { tipo: 'totale', prezzo: 36, danni: 0, furto: 1500, cauzione: 200, copre: { cristalli: true, gomme: true } },
    cauzioneBloccata: true,
    optional: [{ nome: 'Seggiolino', quantita: 1, totale: 24 }, { nome: 'GPS', quantita: 2, totale: 30 }],
  });
  expect(righe).toEqual([
    ['Protezione Totale', 'A carico del cliente: danni max 0 €, furto max 1.500 €. Copre anche cristalli, gomme', '36,00 €'],
    ['Seggiolino', '1 pezzo', '24,00 €'],
    ['GPS', '2 pezzi', '30,00 €'],
  ]);
  expect(cauzione).toEqual({ importo: 200, bloccata: true });
});

test('Base senza cauzione bloccata; prenotazioni di prima: nessuna voce', () => {
  expect(vociProtezioneExtra({ protezione: { tipo: 'base', prezzo: 0, cauzione: 500 } }))
    .toEqual({ righe: [['Protezione Base', '-', 'Inclusa']], cauzione: { importo: 500, bloccata: false } });
  expect(vociProtezioneExtra({ cliente: 'Mario' })).toEqual({ righe: [], cauzione: null });
});

test('giovane conducente in tabella: al giorno oppure importo massimo', () => {
  expect(vociProtezioneExtra({ giovaneConducente: { eta: 22, euroGiorno: 15, giorni: 3, importo: 45, alMassimo: false } }).righe)
    .toEqual([['Giovane conducente', '15,00 € al giorno × 3 giorni', '45,00 €']]);
  expect(vociProtezioneExtra({ giovaneConducente: { eta: 19, euroGiorno: 25, giorni: 20, importo: 300, alMassimo: true } }).righe)
    .toEqual([['Giovane conducente', '19 anni, importo massimo', '300,00 €']]);
});

test('il PDF di consegna si genera, con titolo e lingua', async () => {
  const pdf = await generaRiepilogoPdf({
    id: 'k7f3a2c9', cliente: 'Mario Rossi', veicolo: 'Panda', targa: 'AA111AA', dataInizio: '2099-10-12', dataFine: '2099-10-15', prezzoTotale: 135,
    etaConducente: 23, protezione: { tipo: 'totale', prezzo: 36, danni: 0, furto: 300, cauzione: 200, copre: { cristalli: true } },
    cauzioneBloccata: true, optional: [{ nome: 'Seggiolino bambino', quantita: 1, totale: 24 }],
  }, {
    carburante: '3/4', kmIniziali: '45000', danni: 'Graffio portiera destra',
    dotazione: { voci: ['Cric', 'Cavo di ricarica'], presenti: ['Cric'], impostata: true, chiaviConsegnate: 2 },
  }, { azienda: { nome: 'Formia Rent', coloreAccento: '#1f6b4a' } });
  const doc = await PDFDocument.load(pdf);
  expect(doc.getTitle()).toBe('Verbale di consegna n. K7F3A2');
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  if (process.env.PDF_PROVA) require('fs').writeFileSync(`${process.env.PDF_PROVA}-consegna.pdf`, Buffer.from(pdf));
});

test('il PDF con foto dal telefono: etichette, didascalia e foto che non si scaricano vengono saltate', async () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const t = new Date(2026, 9, 12, 9, 2).getTime();
  const pdf = await generaRiepilogoPdf({ id: 'abc', cliente: 'Mario Rossi', veicolo: 'Panda', targa: 'AA111AA', dataInizio: '2099-10-12', dataFine: '2099-10-15' }, { carburante: '3/4' }, {
    azienda: { nome: 'Formia Rent' },
    foto: [
      { id: '1', url: PNG, etichetta: 'Angolo anteriore sinistro', scattataIl: t, caricataIl: t + 1000 },
      { id: '2', url: PNG, etichetta: '', scattataIl: null, caricataIl: t + 2000 },
      { id: '3', url: 'data:text/plain;base64,QUJD', etichetta: 'Interni', scattataIl: t, caricataIl: t },
    ],
  });
  const doc = await PDFDocument.load(pdf);
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  if (process.env.PDF_PROVA) require('fs').writeFileSync(`${process.env.PDF_PROVA}-foto.pdf`, Buffer.from(pdf));
});
