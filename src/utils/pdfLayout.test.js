import { PDFDocument, PDFName } from 'pdf-lib';
import { sicuro, spezzaRighe, nuovoFoglio, immagineDaUrl, contrasto, coloreAccento, iniziali } from './pdfLayout';

const PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('sicuro', () => {
  it('sostituisce frecce e virgolette, toglie gli a capo', () => {
    expect(sicuro('A → B “x” – y\nz')).toBe('A -> B "x" - y z');
  });
  it('mette ? dove il font non scrive', () => {
    expect(sicuro('ok 😀', new Set(Array.from('ok ').map((c) => c.codePointAt(0))))).toBe('ok ?');
  });
});

describe('spezzaRighe', () => {
  const misura = (t) => t.length * 5;
  it('manda a capo alle parole', () => {
    expect(spezzaRighe('uno due tre quattro', 50, misura)).toEqual(['uno', 'due', 'tre', 'quattro'].reduce((r, p) => {
      const ultimo = r[r.length - 1];
      if (ultimo !== undefined && (ultimo + ' ' + p).length * 5 <= 50) r[r.length - 1] = `${ultimo} ${p}`; else r.push(p);
      return r;
    }, []));
  });
  it('spezza le parole piu\' lunghe della riga', () => {
    const r = spezzaRighe('abcdefghijklmnopqrstuvwxyz', 50, misura);
    expect(r.every((x) => x.length * 5 <= 50)).toBe(true);
    expect(r.join('')).toBe('abcdefghijklmnopqrstuvwxyz');
  });
  it('testo vuoto = una riga vuota', () => {
    expect(spezzaRighe('', 50, misura)).toEqual(['']);
  });
});

describe('immagineDaUrl', () => {
  it('incorpora un PNG e ignora quello che non si legge', async () => {
    const doc = await PDFDocument.create();
    expect(await immagineDaUrl(doc, PNG_1X1)).not.toBeNull();
    expect(await immagineDaUrl(doc, 'data:text/plain;base64,QUJD')).toBeNull();
    expect(await immagineDaUrl(doc, '')).toBeNull();
    expect(await immagineDaUrl(doc, undefined)).toBeNull();
    const prima = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('rete'));
    expect(await immagineDaUrl(doc, 'https://esempio.it/x.png')).toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await immagineDaUrl(doc, 'https://esempio.it/x.png')).toBeNull();
    global.fetch = prima;
  });
});

describe('colori e marchio', () => {
  it('contrasto: bianco su nero 21, uguali 1', () => {
    expect(contrasto([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
    expect(contrasto([9, 9, 9], [9, 9, 9])).toBeCloseTo(1, 5);
  });
  it('colore d\'accento: scelto se leggibile sul bianco, altrimenti quello base', () => {
    expect(coloreAccento('#1f6b4a')).toEqual([31, 107, 74]);
    expect(coloreAccento('1f6b4a')).toEqual([31, 107, 74]);
    expect(coloreAccento('#ffee00')).toEqual([31, 78, 121]); // giallo: poco contrasto
    expect(coloreAccento('boh')).toEqual([31, 78, 121]);
    expect(coloreAccento(undefined)).toEqual([31, 78, 121]);
  });
  it('iniziali del marchio', () => {
    expect(iniziali('Formia Rent')).toBe('FR');
    expect(iniziali('Autonoleggio')).toBe('AU');
    expect(iniziali('')).toBe('');
  });
});

describe('foglio', () => {
  it('con tanto contenuto va su piu\' pagine e numera il piede', async () => {
    const foglio = await nuovoFoglio({ azienda: { nome: 'Formia Rent' }, titolo: 'Prova', numero: 'ABC123', piede: 'Piede', riepilogo: 'Mario · Panda' });
    foglio.sezione('Addebiti');
    foglio.tabella({
      colonne: [{ titolo: 'Voce' }, { titolo: 'Importo', destra: true }],
      righe: Array.from({ length: 80 }, (_, i) => [`Voce ${i + 1} con \u{1F600} e \u2192 freccia`, '10,00 \u20AC']),
      totale: ['Totale', '800,00 \u20AC'],
    });
    foglio.firme('Il cliente', "Per l'azienda");
    const doc = await PDFDocument.load(await foglio.chiudi());
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('tutti i blocchi insieme, con foto e celle speciali, non rompono il PDF', async () => {
    const foglio = await nuovoFoglio({ azienda: { nome: 'Formia Rent', coloreAccento: '#8a2c3a' }, titolo: 'Prova', copia: 'Copia per il cliente' });
    foglio.fascia([{ etichetta: 'Cliente', valore: 'Mario Rossi con un nome molto molto lungo da stringere' }, { etichetta: 'Durata', valore: '3 giorni' }]);
    foglio.sezione('Uno');
    foglio.coppie([['Nome', 'Mario'], ['Note', 'una frase lunga lunga lunga lunga lunga lunga lunga lunga lunga lunga lunga']], [['Ritiro', 'oggi']]);
    foglio.riquadri([{ etichetta: 'Km', valore: '1.000 km' }, { etichetta: 'Carburante', valore: '3/4', barra: { pieni: 3, totale: 4 }, nota: 'ok' }]);
    foglio.tabella({
      colonne: [{ titolo: 'A' }, { titolo: 'B' }],
      righe: [['x', { testo: '2/4 in meno', tono: 'rosso', segno: 'giu' }], ['y', { tag: 'Tutte', tono: 'verde' }], ['z', { testo: 'su', tono: 'verde', segno: 'su' }]],
    });
    foglio.danni([{ numero: 1, titolo: 'Graffio', dettaglio: 'Già presente', nuovo: false }, { numero: 2, titolo: 'Ammaccatura', dettaglio: 'Da riparare', nuovo: true }], { nota: 'nota' });
    foglio.danni([], {});
    foglio.caselle([{ testo: 'Cric', ok: true }, { testo: 'Cavo: mancante', manca: true }, { testo: 'Altro' }]);
    foglio.riquadroDati({ etichetta: 'Cauzione', righe: [['Importo', '300,00 \u20AC']], totale: ['Sbloccata', '230,00 \u20AC'], nota: 'nota' });
    foglio.foto([{ immagine: await foglio.immagine(PNG_1X1), etichetta: 'Davanti' }, { immagine: null, etichetta: 'Dietro' }]);
    foglio.nota('Una nota');
    foglio.dichiarazione('Testo della dichiarazione.');
    foglio.firme();
    foglio.piccolo('Privacy.');
    const doc = await PDFDocument.load(await foglio.chiudi());
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.catalog.get(PDFName.of('Lang')).toString()).toContain('it-IT');
  });
});

describe('logo dell\'azienda nel PDF', () => {
  const { PDFName, PDFRawStream } = require('pdf-lib');
  const immagini = (doc) => doc.context.enumerateIndirectObjects()
    .filter(([, o]) => o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')).length;
  const genera = async (azienda, pagine = 1) => {
    const foglio = await nuovoFoglio({ azienda, titolo: 'Verbale di consegna', numero: 'ABC123', copia: 'Copia per il cliente' });
    foglio.sezione('Uno');
    if (pagine > 1) {
      foglio.tabella({ colonne: [{ titolo: 'Voce' }, { titolo: 'Importo', destra: true }], righe: Array.from({ length: 80 }, (_, i) => [`Voce ${i}`, '1,00 €']) });
    }
    return PDFDocument.load(await foglio.chiudi());
  };

  it('senza logo non ci sono immagini (resta il quadratino con le iniziali)', async () => {
    expect(immagini(await genera({ nome: 'Formia Rent' }))).toBe(0);
  });

  it('con il logo l\'immagine e\' nel PDF, una volta sola anche con piu\' pagine', async () => {
    // Un PNG con trasparenza diventa due oggetti (immagine e maschera): lo stesso numero con una o piu' pagine.
    const una = await genera({ nome: 'Formia Rent', logo: PNG_1X1 });
    const molte = await genera({ nome: 'Formia Rent', logo: PNG_1X1 }, 2);
    expect(immagini(una)).toBeGreaterThanOrEqual(1);
    expect(molte.getPageCount()).toBeGreaterThan(1);
    expect(immagini(molte)).toBe(immagini(una));
  });

  it('un logo che non si legge non rompe il PDF: si torna alle iniziali', async () => {
    const doc = await genera({ nome: 'Formia Rent', logo: 'data:image/png;base64,AAAA' });
    expect(doc.getPageCount()).toBe(1);
    expect(immagini(doc)).toBe(0);
  });
});
