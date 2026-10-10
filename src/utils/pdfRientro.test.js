import { sezioniRientro, generaVerbaleRientroPdf } from './pdfRientro';

const prenotazione = {
  cliente: 'Mario Rossi', veicolo: 'Fiat Panda', targa: 'AA111AA',
  dataInizio: '2026-10-12', dataFine: '2026-10-15', oraInizio: '09:00', oraFine: '09:00', tolleranzaMinuti: 29,
  descrizioneDanno: 'Ammaccatura sul paraurti anteriore', daRiparare: true,
  rientro: {
    dataRientro: '2026-10-15', oraRientro: '11:30', km: 48730, kmConsegna: 48318, carburante: '1/2', carburanteConsegna: 'Pieno',
    chiaviConsegnate: 2, chiaviTornate: 2, dotazioneNonTornata: ['Triangolo'], extraNonTornati: [],
    addebiti: [{ id: 'ritardo', nome: 'Ritardo, 1 giorno', importo: 25 }, { id: 'danno', nome: 'Danno', importo: 350 }],
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
  it('genera un PDF', async () => {
    const bytes = await generaVerbaleRientroPdf(prenotazione);
    expect(bytes.length).toBeGreaterThan(500);
  });
});
