import { PDFDocument } from 'pdf-lib';
import { sezioniRientro, righeConfronto, esitoRientro, generaVerbaleRientroPdf } from './pdfRientro';

const prenotazione = {
  id: 'abc123def456', cliente: 'Mario Rossi', veicolo: 'Fiat Panda', targa: 'AA111AA',
  dataInizio: '2026-10-12', dataFine: '2026-10-15', oraInizio: '09:00', oraFine: '09:00', tolleranzaMinuti: 29,
  descrizioneDanno: 'Ammaccatura sul paraurti anteriore', daRiparare: true,
  schedaVeicolo: { danni: 'Graffio portiera', dotazione: { voci: ['Cric', 'Triangolo', 'Cavo di ricarica'], presenti: ['Cric', 'Triangolo'], impostata: true, chiaviConsegnate: 2 } },
  rientro: {
    dataRientro: '2026-10-15', oraRientro: '11:30', km: 48730, kmConsegna: 48318, carburante: '1/2', carburanteConsegna: 'Pieno',
    chiaviConsegnate: 2, chiaviTornate: 2, dotazioneNonTornata: ['Triangolo'], extraNonTornati: [],
    addebiti: [{ id: 'ritardo', nome: 'Ritardo: 1 giorno in più', dettaglio: '1 × 25,00 €', importo: 25 }, { id: 'danno', nome: 'Danno', dettaglio: 'Riparazione', importo: 350 }],
    totaleAddebiti: 375, cauzione: { importo: 500, trattenuta: 375, sbloccata: 125, restano: 0 }, restanoDaPagare: 0,
  },
};

describe('verbale di rientro', () => {
  it('vuoto per le prenotazioni senza rientro completo', () => {
    expect(sezioniRientro({})).toEqual([]);
  });
  it('scrive rientro, km, carburante, non tornato, addebiti e cauzione', () => {
    const [generali, addebiti, cauzione] = sezioniRientro(prenotazione);
    const g = Object.fromEntries(generali.righe);
    expect(g.Rientrata).toBe('15/10/2026 alle 11:30 (1 giorno in più)');
    expect(g.Km).toBe('48.318 -> 48.730 (412 km)');
    expect(g.Carburante).toBe('Pieno -> 1/2');
    expect(g.Chiavi).toBe('2 consegnate, 2 tornate');
    expect(g['Non tornato']).toBe('Triangolo');
    expect(g['Danni nuovi']).toBe('Ammaccatura sul paraurti anteriore (da riparare)');
    expect(addebiti.righe.at(-1)).toEqual(['Totale', '375,00 EUR']);
    expect(Object.fromEntries(cauzione.righe)).toMatchObject({ Trattenuta: '375,00 EUR', Sbloccata: '125,00 EUR' });
  });
  it('senza cauzione e con addebiti: restano da pagare', () => {
    const p = { ...prenotazione, rientro: { ...prenotazione.rientro, cauzione: null, restanoDaPagare: 375 } };
    expect(sezioniRientro(p).at(-1)).toEqual({ titolo: 'Pagamento', righe: [['Restano da pagare', '375,00 EUR']] });
  });
  it('senza rientro completo non ci sono righe di confronto', () => {
    expect(righeConfronto({})).toEqual([]);
  });

  it('confronta km, carburante, riconsegna, chiavi e dotazione con la consegna', () => {
    const [km, carb, ora, chiavi, dot] = righeConfronto(prenotazione);
    expect(km).toEqual(['Chilometri', '48.318 km', '48.730 km', { testo: '412 km percorsi', grassetto: true }]);
    expect(carb).toEqual(['Carburante', 'Pieno', '1/2', { testo: '2/4 in meno', tono: 'rosso', segno: 'giu' }]);
    expect(ora.slice(0, 3)).toEqual(['Riconsegna', 'entro 09:00', '11:30']);
    expect(ora[3]).toMatchObject({ tono: 'rosso', segno: 'su' });
    expect(chiavi).toEqual(['Chiavi', '2', '2', { tag: 'Tutte', tono: 'verde' }]);
    expect(dot).toEqual(['Dotazione', '2 voci', '1 voce', { testo: 'Manca: Triangolo', tono: 'rosso' }]);
  });

  it('rientro puntuale: tag «In orario», stesso carburante «Uguale»', () => {
    const p = { ...prenotazione, rientro: { ...prenotazione.rientro, oraRientro: '09:10', carburante: 'Pieno', dotazioneNonTornata: [] } };
    const [, carb, ora, , dot] = righeConfronto(p);
    expect(carb[3]).toEqual({ tag: 'Uguale' });
    expect(ora[3]).toEqual({ tag: 'In orario', tono: 'verde' });
    expect(dot[3]).toEqual({ tag: 'Completa', tono: 'verde' });
  });

  it('esito in una parola', () => {
    expect(esitoRientro(prenotazione)).toBe('Con addebiti');
    expect(esitoRientro({ ...prenotazione, rientro: { ...prenotazione.rientro, totaleAddebiti: 0 } })).toBe('Con danni');
    expect(esitoRientro({ rientro: { totaleAddebiti: 0, dotazioneNonTornata: ['Cric'] } })).toBe('Con mancanze');
    expect(esitoRientro({ rientro: { totaleAddebiti: 0 } })).toBe('Tutto in ordine');
  });

  it('genera un PDF con titolo, lingua e autore', async () => {
    const bytes = await generaVerbaleRientroPdf(prenotazione, { azienda: { nome: 'Formia Rent', partitaIva: '01234567890' } });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe('Verbale di rientro n. ABC123');
    expect(doc.getAuthor()).toBe('Formia Rent');
    expect(doc.catalog.get(require('pdf-lib').PDFName.of('Lang')).toString()).toContain('it-IT');
    if (process.env.PDF_PROVA) require('fs').writeFileSync(`${process.env.PDF_PROVA}-rientro.pdf`, Buffer.from(bytes));
  });
});
