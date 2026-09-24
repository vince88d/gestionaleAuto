import {
  tipoRiferimento, nomeFileDaPercorso, raccogliRiferimenti, sostituisciRiferimenti,
  preparaVeicolo, preparaPrenotazione, collegaConfermeOtp, preparaClienti, analizzaRecupero, testoResoconto,
} from './recuperoDati';

// Formato reale della versione precedente su Windows (slash mescolati).
const FOTO_WIN = 'file://C:\\Users\\mario\\AppData\\Roaming\\react-electron\\images\\1749035637679.jpg';

describe('riferimenti a file', () => {
  it('riconosce i tipi', () => {
    expect(tipoRiferimento(FOTO_WIN)).toBe('file');
    expect(tipoRiferimento('file:///Users/mario/Library/react-electron/images/1.png')).toBe('file');
    expect(tipoRiferimento('C:/dati/contratto_1.pdf')).toBe('file');
    expect(tipoRiferimento('data:image/png;base64,AAAA')).toBe('incorporata');
    expect(tipoRiferimento('blob:http://localhost/abc')).toBe('temporanea');
    expect(tipoRiferimento('https://firebasestorage.googleapis.com/x')).toBe('online');
    expect(tipoRiferimento('Graffio sul paraurti')).toBeNull();
    expect(tipoRiferimento(12)).toBeNull();
  });

  it('estrae nome e cartella da percorsi Windows e Mac', () => {
    expect(nomeFileDaPercorso(FOTO_WIN)).toEqual({ nome: '1749035637679.jpg', cartella: 'images' });
    expect(nomeFileDaPercorso('file:///Users/m/app/images/foto%20uno.png')).toEqual({ nome: 'foto uno.png', cartella: 'images' });
  });

  it('trova e sostituisce i riferimenti anche annidati', () => {
    const dato = { immagine: FOTO_WIN, danni: [{ immagine: 'data:image/png;base64,AA' }], note: 'ok', web: 'https://x' };
    expect(raccogliRiferimenti(dato).map((r) => [r.campo, r.tipo])).toEqual([
      ['immagine', 'file'], ['danni[0].immagine', 'incorporata'],
    ]);
    const nuovo = sostituisciRiferimenti(dato, (v, tipo) => (tipo === 'file' ? 'https://nuova' : undefined));
    expect(nuovo).toEqual({ ...dato, immagine: 'https://nuova' });
  });
});

describe('preparaVeicolo', () => {
  it('uniforma targa e numeri, trasforma i danni vecchi e toglie la copia delle prenotazioni', () => {
    const v = preparaVeicolo({
      id: 'u1', targa: 'ab 123-cd', anno: '2019', km: '45000', porte: '5', prezzo: '35,5',
      danni: [FOTO_WIN, { descrizione: 'graffio', daRiparare: true }], prenotazioni: [{ id: 'x' }],
      scadenze: { assicurazione: '2026-01-01' },
    }, 0);
    expect(v).toMatchObject({ id: 'u1', targa: 'AB123CD', anno: 2019, km: 45000, porte: 5, prezzo: 35.5 });
    expect(v.danni[0]).toEqual({ descrizione: '', immagine: FOTO_WIN, daRiparare: false });
    expect(v.danni[1]).toEqual({ descrizione: 'graffio', daRiparare: true });
    expect(v.scadenze).toEqual({ assicurazione: '2026-01-01', bollo: '', revisione: '' });
    expect(v).not.toHaveProperty('prenotazioni');
  });

  it('senza id ne crea uno fisso (il recupero si puo\' ripetere senza doppioni)', () => {
    expect(preparaVeicolo({ targa: 'X' }, 2).id).toBe('recupero-veicolo-3');
  });
});

describe('prenotazioni e conferme OTP', () => {
  it('uniforma targa e codice fiscale, sistema fotoDanni', () => {
    expect(preparaPrenotazione({ id: 'p', targa: 'ab123cd', codiceFiscale: ' rssmra ', fotoDanni: null }, 0))
      .toEqual({ id: 'p', targa: 'AB123CD', codiceFiscale: 'RSSMRA', status: 'attiva' });
    expect(preparaPrenotazione({ id: 'p', fotoDanni: 'data:image/png;base64,A' }, 0).fotoDanni).toEqual(['data:image/png;base64,A']);
  });

  it('collega la conferma OTP con stessa targa, data e codice fiscale', () => {
    const pren = [{ id: 'a', targa: 'AB123CD', dataInizio: '2025-07-01', codiceFiscale: 'CF1' }, { id: 'b', targa: 'ZZ999ZZ', dataInizio: '2025-07-01', codiceFiscale: 'CF1' }];
    const otp = [
      { targa: 'ab123cd', dataInizio: '2025-07-01', codiceFiscale: 'cf1', confermatoIl: '2025-06-30T10:00:00Z', ip: '1.2.3.4' },
      { targa: 'OLD', dataInizio: '2025-05-01', codiceFiscale: 'CF1' },
    ];
    const r = collegaConfermeOtp(pren, otp);
    expect(r.prenotazioni[0].confermaOtp).toEqual({ confermatoIl: '2025-06-30T10:00:00Z', ip: '1.2.3.4', email: '' });
    expect(r.prenotazioni[1]).not.toHaveProperty('confermaOtp');
    expect(r.nonCollegate).toHaveLength(1);
  });
});

describe('preparaClienti', () => {
  it('ricava i clienti dalle prenotazioni, uno per codice fiscale, dati della piu\' recente', () => {
    const prenotazioni = [
      { codiceFiscale: 'CF1', cliente: 'Mario Rossi', telefono: '111', dataInizio: '2025-01-01', patente: 'P1' },
      { codiceFiscale: 'CF1', cliente: 'Mario Rossi', telefono: '222', dataInizio: '2025-06-01', emailCliente: 'm@x.it' },
      { codiceFiscale: '', cliente: 'Senza CF' },
    ];
    const { clienti } = preparaClienti([], prenotazioni);
    expect(clienti).toHaveLength(1);
    expect(clienti[0]).toMatchObject({
      id: 'CF1', nome: 'Mario', cognome: 'Rossi', telefono: '222', email: 'm@x.it', patente: 'P1', ricavatoDaPrenotazioni: true,
    });
  });

  it('l\'anagrafica vince sulle prenotazioni, unisce i doppi, scarta chi non ha codice fiscale', () => {
    const { clienti, senzaCf, doppi } = preparaClienti(
      [{ codiceFiscale: 'cf1', nome: 'Maria', telefono: '' }, { codiceFiscale: 'CF1', telefono: '333' }, { nome: 'Anonimo' }],
      [{ codiceFiscale: 'CF1', cliente: 'Altro Nome', telefono: '999', dataInizio: '2025-01-01' }],
    );
    expect(clienti).toHaveLength(1);
    expect(clienti[0]).toMatchObject({ id: 'CF1', nome: 'Maria', telefono: '333', ricavatoDaPrenotazioni: false });
    expect(senzaCf).toHaveLength(1);
    expect(doppi).toBe(1);
  });
});

describe('analizzaRecupero', () => {
  const vecchi = {
    veicoli: [
      { id: 'v1', targa: 'AB123CD', immagine: FOTO_WIN },
      { id: 'v2', targa: 'ab123cd' },
      { id: 'v3', targa: 'EE555EE', immagine: 'file://C:\\x\\images\\manca.jpg' },
    ],
    prenotazioni: [
      { id: 'p1', targa: 'AB123CD', dataInizio: '2025-07-01', dataFine: '2025-07-03', codiceFiscale: 'CF1', cliente: 'Mario Rossi', status: 'completata' },
      { id: 'p2', targa: 'VECCHIA1', dataInizio: '2025-07-05', dataFine: '2025-07-01', codiceFiscale: 'CF1', cliente: 'Mario Rossi', status: 'boh' },
    ],
    clienti: [],
    conferme: [{ targa: 'AB123CD', dataInizio: '2025-07-01', codiceFiscale: 'CF1', confermatoIl: 'x' }],
  };
  const file = {
    immagini: ['1749035637679.jpg', 'vecchia.png'],
    contratti: [{ nome: 'contratto_1748349579063.pdf', cartella: '' }],
  };

  it('conta cosa verrebbe recuperato ed elenca i problemi', () => {
    const r = analizzaRecupero(vecchi, { veicoli: [{ id: 'v1', targa: 'AB123CD' }], prenotazioni: [], clienti: [] }, file);
    // v2 ha la targa di v1, che e' gia' su Firebase: non si recupera (sarebbe un doppione).
    expect(r.conteggi.veicoli).toEqual({ totale: 2, nuovi: 1, giaPresenti: 1 });
    expect(r.conteggi.prenotazioni).toEqual({ totale: 2, nuovi: 2, giaPresenti: 0 });
    expect(r.conteggi.clienti).toEqual({ totale: 1, nuovi: 1, giaPresenti: 0 });
    expect(r.conteggi).toMatchObject({
      clientiRicavati: 1, confermeOtpCollegate: 1, fileDaCaricare: 1, fileMancanti: 1, immaginiNonUsate: 1, contrattiArchivio: 1,
    });
    const messaggi = r.problemi.map((p) => p.messaggio).join('\n');
    expect(messaggi).toMatch(/Targhe presenti su piu/);
    expect(messaggi).toMatch(/targa gia' usata da un altro veicolo/);
    expect(messaggi).toMatch(/veicoli che non ci sono piu/);
    expect(messaggi).toMatch(/date mancanti o non valide/);
    expect(messaggi).toMatch(/stato sconosciuto/);
    expect(messaggi).toMatch(/non trovati nella cartella/);
    expect(testoResoconto(r)).toMatch(/Veicoli: +2 \(nuovi 1, gia' presenti 1\)/);
  });

  it('non recupera un veicolo la cui targa e\' gia\' di un altro veicolo nel gestionale nuovo', () => {
    const r = analizzaRecupero({ veicoli: [{ id: 'nuovo', targa: 'EE555EE' }] }, { veicoli: [{ id: 'altro', targa: 'EE555EE' }] });
    expect(r.dati.veicoli).toHaveLength(0);
    expect(r.problemi[0].dettagli).toEqual(['EE555EE']);
  });

  it('segnala i file che non si sono potuti leggere', () => {
    const r = analizzaRecupero({ erroriLettura: [{ file: 'veicoli.json', errore: 'JSON non valido' }] });
    expect(r.problemi[0]).toMatchObject({ gravita: 'grave' });
  });
});
