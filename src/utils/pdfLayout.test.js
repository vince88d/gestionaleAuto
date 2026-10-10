import { PDFDocument } from 'pdf-lib';
import { sicuro, spezzaRighe, nuovoFoglio, immagineDaUrl } from './pdfLayout';

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

describe('foglio', () => {
  it('con tanto contenuto va su piu\' pagine e numera il piede', async () => {
    const foglio = await nuovoFoglio({ azienda: { nome: 'Formia Rent' }, titolo: 'Prova', piede: 'Piede' });
    foglio.sezione('Addebiti');
    foglio.tabella(Array.from({ length: 80 }, (_, i) => [`Voce ${i + 1} con 😀 e → freccia`, '10,00 EUR']), ['Totale', '800,00 EUR']);
    foglio.firme('Data: oggi');
    const bytes = await foglio.chiudi();
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('con la foto del danno non si rompe', async () => {
    const foglio = await nuovoFoglio({ titolo: 'Prova' });
    foglio.riquadroTesto({ etichetta: 'Danni', testo: 'Graffio', immagine: await foglio.immagine(PNG_1X1) });
    const doc = await PDFDocument.load(await foglio.chiudi());
    expect(doc.getPageCount()).toBe(1);
  });
});
