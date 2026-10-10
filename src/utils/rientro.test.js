import {
  quartiMancanti, kmPercorsi, giorniInPiu, rientroEntro, proponiAddebiti, addebitiAttivi,
  totaleAddebiti, erroriAddebiti, esitoCauzione, tettoDanno,
} from './rientro';
import { ADDEBITI_DI_PARTENZA } from './addebiti';

const pren = {
  dataInizio: '2026-10-12', dataFine: '2026-10-15', oraInizio: '09:00', oraFine: '09:00', tolleranzaMinuti: 29,
  prezzoGiornaliero: '25', protezione: { tipo: 'base', danni: 1200, cauzione: 500 },
  schedaVeicolo: { carburante: 'Pieno', dotazione: { chiaviConsegnate: 2 } },
};

describe('carburante e km', () => {
  it('conta i quarti mancanti', () => {
    expect(quartiMancanti('Pieno', '1/2')).toBe(2);
    expect(quartiMancanti('1/2', 'Pieno')).toBe(0);
    expect(quartiMancanti('Pieno', '')).toBe(0);
    expect(quartiMancanti(undefined, '1/4')).toBe(0);
  });
  it('km percorsi', () => {
    expect(kmPercorsi('48318', '48730')).toBe(412);
    expect(kmPercorsi('50000', '49000')).toBeNull();
    expect(kmPercorsi('', '49000')).toBeNull();
  });
});

describe('ritardo', () => {
  it('entro la tolleranza nessun giorno in piu\'', () => {
    expect(giorniInPiu({ prenotazione: pren, dataRientro: '2026-10-15', oraRientro: '09:29' })).toBe(0);
  });
  it('oltre la tolleranza un giorno in piu\'', () => {
    expect(giorniInPiu({ prenotazione: pren, dataRientro: '2026-10-15', oraRientro: '11:30' })).toBe(1);
  });
  it('un giorno dopo è in ritardo', () => {
    expect(giorniInPiu({ prenotazione: pren, dataRientro: '2026-10-16', oraRientro: '09:00' })).toBe(1);
  });
  it('in anticipo non cambia nulla', () => {
    expect(giorniInPiu({ prenotazione: pren, dataRientro: '2026-10-14', oraRientro: '18:00' })).toBe(0);
  });
  it('senza ore conta solo la data', () => {
    const vecchia = { dataInizio: '2026-10-12', dataFine: '2026-10-15' };
    expect(giorniInPiu({ prenotazione: vecchia, dataRientro: '2026-10-15', oraRientro: '18:00' })).toBe(0);
    expect(giorniInPiu({ prenotazione: vecchia, dataRientro: '2026-10-16', oraRientro: '08:00' })).toBe(1);
  });
  it('rientro entro', () => {
    expect(rientroEntro(pren)).toBe('9:29');
    expect(rientroEntro({})).toBeNull();
    expect(rientroEntro({ oraFine: '23:45', tolleranzaMinuti: 29 })).toBeNull();
  });
});

describe('addebiti proposti', () => {
  const base = {
    prenotazione: pren, prezzi: ADDEBITI_DI_PARTENZA, dataRientro: '2026-10-15', oraRientro: '11:30',
    carburante: '1/2', chiaviTornate: 2, danno: 'Ammaccatura sul paraurti', nonTornati: [{ nome: 'Triangolo', addebita: true }],
  };
  it('propone ritardo, rifornimento, danno, oggetto, pulizia spenta', () => {
    const r = proponiAddebiti(base);
    expect(r.map((x) => x.id)).toEqual(['ritardo', 'rifornimento', 'danno', 'mancante:Triangolo', 'pulizia']);
    expect(r[0].importo).toBe(25);
    expect(r[1].importo).toBe(40);
    expect(r[2].importo).toBeNull();
    expect(r[3].importo).toBe(15);
    expect(r[4].attiva).toBe(false);
  });
  it('niente riga se tutto in ordine', () => {
    const r = proponiAddebiti({ ...base, oraRientro: '09:00', carburante: 'Pieno', danno: '', nonTornati: [] });
    expect(r.map((x) => x.id)).toEqual(['pulizia']);
  });
  it('chiave non restituita', () => {
    const r = proponiAddebiti({ ...base, oraRientro: '09:00', carburante: 'Pieno', danno: '', nonTornati: [], chiaviTornate: 1 });
    expect(r[0]).toMatchObject({ id: 'chiave', importo: 150 });
  });
  it('oggetto mancante senza «addebita» non ha riga', () => {
    const r = proponiAddebiti({ ...base, nonTornati: [{ nome: 'Triangolo', addebita: false }] });
    expect(r.some((x) => x.id.startsWith('mancante'))).toBe(false);
  });
});

describe('totale e cauzione', () => {
  const righe = [
    { id: 'ritardo', nome: 'Ritardo', importo: 25, attiva: true },
    { id: 'danno', nome: 'Danno', importo: '1.500', attiva: true },
    { id: 'pulizia', nome: 'Pulizia', importo: 30, attiva: false },
  ];
  it('somma solo le attive e applica il tetto al danno', () => {
    expect(totaleAddebiti(righe)).toBe(1525);
    expect(totaleAddebiti(righe, tettoDanno(pren))).toBe(1225);
    expect(addebitiAttivi(righe, 1200).map((r) => r.importo)).toEqual([25, 1200]);
  });
  it('segnala le righe attive senza importo', () => {
    expect(erroriAddebiti([{ id: 'danno', attiva: true, importo: null }, { id: 'x', attiva: false, importo: null }])).toEqual({ danno: expect.any(String) });
  });
  it('sblocca tutta la cauzione', () => {
    expect(esitoCauzione({ cauzione: 500, totale: 0, trattieni: 0 })).toEqual({ importo: 500, trattenuta: 0, sbloccata: 500, restano: 0 });
  });
  it('trattiene gli addebiti e sblocca il resto', () => {
    expect(esitoCauzione({ cauzione: 500, totale: 430, trattieni: '430' })).toEqual({ importo: 500, trattenuta: 430, sbloccata: 70, restano: 0 });
  });
  it('se gli addebiti superano la cauzione restano da pagare', () => {
    expect(esitoCauzione({ cauzione: 500, totale: 650, trattieni: 650 })).toEqual({ importo: 500, trattenuta: 500, sbloccata: 0, restano: 150 });
  });
  it('senza cauzione tutto resta da pagare', () => {
    expect(esitoCauzione({ cauzione: undefined, totale: 100, trattieni: 100 }).restano).toBe(100);
  });
});
