// Impaginazione dei PDF del gestionale (verbale di consegna e di rientro):
// pagina A4, testata con i dati dell'azienda, sezioni, riquadri, elenchi con
// caselle, tabelle, firme e piede con "Pagina i di n". Mockup approvato:
// formiarent-documenti/mockup/gestionale-pdf-consegna.html (misure in punti).
//
// Il font standard (Helvetica) non sa scrivere ogni carattere: `sicuro()` sostituisce
// le frecce e le virgolette tipografiche e mette "?" al posto di quello che
// non esiste (es. emoji nei nomi), cosi' il PDF non si rompe mai.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const COLORI = {
  inchiostro: rgb(0.106, 0.145, 0.188),
  grigio: rgb(0.357, 0.4, 0.447),
  linea: rgb(0.788, 0.816, 0.847),
  fondo: rgb(0.953, 0.961, 0.969),
  accento: rgb(0.122, 0.306, 0.475),
  allarme: rgb(0.643, 0.216, 0.169),
  bianco: rgb(1, 1, 1),
};

const SOSTITUZIONI = [[/→/g, '->'], [/←/g, '<-'], [/[‘’]/g, "'"], [/[“”]/g, '"'], [/[–—]/g, '-'], [/…/g, '...'], [/ /g, ' ']];

// Testo scrivibile con il font standard.
export function sicuro(testo, caratteri) {
  let t = String(testo ?? '').replace(/[\r\n\t]+/g, ' ');
  SOSTITUZIONI.forEach(([da, a]) => { t = t.replace(da, a); });
  if (!caratteri) return t;
  return Array.from(t).map((c) => (caratteri.has(c.codePointAt(0)) ? c : '?')).join('');
}

// Divide il testo in righe che stanno in `larghezza` (le parole troppo lunghe si spezzano).
export function spezzaRighe(testo, larghezza, misura) {
  const righe = [];
  let corrente = '';
  String(testo ?? '').split(' ').forEach((parola) => {
    let p = parola;
    while (misura(p) > larghezza && p.length > 1) {
      let n = p.length - 1;
      while (n > 1 && misura(p.slice(0, n)) > larghezza) n -= 1;
      if (corrente) { righe.push(corrente); corrente = ''; }
      righe.push(p.slice(0, n));
      p = p.slice(n);
    }
    const prova = corrente ? `${corrente} ${p}` : p;
    if (misura(prova) <= larghezza || !corrente) corrente = prova;
    else { righe.push(corrente); corrente = p; }
  });
  if (corrente || righe.length === 0) righe.push(corrente);
  return righe;
}

// Immagine da un indirizzo (o da un dato incorporato) per metterla nel PDF.
// null se non si scarica o non e' PNG/JPEG: il PDF esce lo stesso, senza foto.
export async function immagineDaUrl(doc, sorgente) {
  if (!sorgente || typeof sorgente !== 'string') return null;
  try {
    let byte;
    if (sorgente.startsWith('data:')) {
      const base64 = sorgente.split(',')[1] || '';
      byte = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    } else {
      if (typeof fetch !== 'function') return null;
      const controllo = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controllo ? setTimeout(() => controllo.abort(), 8000) : null;
      try {
        const risposta = await fetch(sorgente, controllo ? { signal: controllo.signal } : undefined);
        if (!risposta.ok) return null;
        byte = new Uint8Array(await risposta.arrayBuffer());
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    if (byte[0] === 0x89 && byte[1] === 0x50) return await doc.embedPng(byte);
    if (byte[0] === 0xff && byte[1] === 0xd8) return await doc.embedJpg(byte);
    return null;
  } catch {
    return null;
  }
}

const PAG_L = 40;
const PAG_R = 555;
const LARG = PAG_R - PAG_L;
const PAG_ALTEZZA = 842;
const LIMITE_BASSO = 62; // sopra il piede
const GAP_COLONNE = 26;

export async function nuovoFoglio({ azienda = {}, titolo, sottotitolo = '', piede = '' }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const grassetto = await doc.embedFont(StandardFonts.HelveticaBold);
  const corsivo = await doc.embedFont(StandardFonts.HelveticaOblique);
  const caratteri = new Set(font.getCharacterSet());
  const s = (t) => sicuro(t, caratteri);
  const larghezza = (t, f, size) => f.widthOfTextAtSize(s(t), size);

  const pagine = [];
  let page;
  let y;

  const barra = () => page.drawRectangle({ x: 0, y: PAG_ALTEZZA - 6, width: 595, height: 6, color: COLORI.accento });
  const scrivi = (t, x, yy, size, f = font, colore = COLORI.inchiostro) => page.drawText(s(t), { x, y: yy, size, font: f, color: colore });
  const spaziato = (t, x, yy, size, f, colore, spazio) => {
    let cx = x;
    Array.from(s(t)).forEach((c) => {
      page.drawText(c, { x: cx, y: yy, size, font: f, color: colore });
      cx += f.widthOfTextAtSize(c, size) + spazio;
    });
  };
  const linea = (x1, x2, yy, spessore, colore) => page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: spessore, color: colore });
  const righeDi = (t, w, size, f = font) => spezzaRighe(s(t), w, (x) => f.widthOfTextAtSize(x, size));

  const testata = () => {
    barra();
    y = PAG_ALTEZZA - 36;
    const alto = y;
    if (azienda.nome) scrivi(azienda.nome, PAG_L, y - 13, 16, grassetto);
    let yy = y - 13;
    const contatti = [
      [azienda.partitaIva && `P.IVA ${azienda.partitaIva}`, azienda.indirizzo].filter(Boolean).join(' · '),
      [azienda.telefono && `Tel. ${azienda.telefono}`, azienda.email].filter(Boolean).join(' · '),
    ].filter(Boolean);
    contatti.forEach((c) => { yy -= 11; scrivi(c, PAG_L, yy, 8, font, COLORI.grigio); });
    const t = s(titolo).toUpperCase();
    const larghezzaTitolo = grassetto.widthOfTextAtSize(t, 13) + (t.length - 1) * 1.2;
    spaziato(t, PAG_R - larghezzaTitolo, alto - 13, 13, grassetto, COLORI.accento, 1.2);
    if (sottotitolo) scrivi(sottotitolo, PAG_R - larghezza(sottotitolo, font, 8.5), alto - 27, 8.5, font, COLORI.grigio);
    y = Math.min(yy, alto - 30) - 12;
    linea(PAG_L, PAG_R, y, 1.5, COLORI.inchiostro);
    y -= 2;
  };

  const nuovaPagina = (prima = false) => {
    page = doc.addPage([595, PAG_ALTEZZA]);
    pagine.push(page);
    if (prima) { testata(); return; }
    barra();
    y = PAG_ALTEZZA - 40;
    scrivi(`${titolo}${sottotitolo ? ` · ${sottotitolo}` : ''}`, PAG_L, y, 8.5, font, COLORI.grigio);
    y -= 8;
    linea(PAG_L, PAG_R, y, 0.75, COLORI.linea);
  };
  nuovaPagina(true);

  const serve = (altezza) => { if (y - altezza < LIMITE_BASSO) nuovaPagina(); };

  // Titolo di sezione in piccolo maiuscolo con la linea sotto.
  const intestazione = (testo, x, w) => {
    spaziato(testo.toUpperCase(), x, y - 8, 8, grassetto, COLORI.grigio, 1.3);
    linea(x, x + w, y - 13, 0.75, COLORI.linea);
  };
  const sezione = (testo) => {
    serve(60);
    y -= 14;
    intestazione(testo, PAG_L, LARG);
    y -= 19;
  };

  // Righe "etichetta: valore" in una colonna; restituisce l'altezza usata.
  const altezzaRighe = (righe, w, etichettaW) => righe.reduce(
    (tot, [, v]) => tot + Math.max(1, righeDi(v, w - etichettaW - 8, 9.5, grassetto).length) * 13 + 2, 0,
  );
  const disegnaRighe = (righe, x, w, etichettaW, yInizio) => {
    let yy = yInizio;
    righe.forEach(([e, v]) => {
      scrivi(e, x, yy - 9.5, 9.5, font, COLORI.grigio);
      const parti = righeDi(v, w - etichettaW - 8, 9.5, grassetto);
      parti.forEach((p, i) => scrivi(p, x + etichettaW + 8, yy - 9.5 - i * 13, 9.5, grassetto));
      yy -= Math.max(1, parti.length) * 13 + 2;
    });
  };

  // Una o due colonne di dati, ognuna con il suo titolo di sezione.
  const colonne = (gruppi, etichettaW = 84) => {
    const w = gruppi.length === 1 ? LARG : (LARG - GAP_COLONNE) / 2;
    const altezza = Math.max(...gruppi.map((g) => altezzaRighe(g.righe, w, etichettaW)));
    serve(40 + altezza);
    y -= 14;
    gruppi.forEach((g, i) => intestazione(g.titolo, PAG_L + i * (w + GAP_COLONNE), w));
    y -= 19;
    gruppi.forEach((g, i) => disegnaRighe(g.righe, PAG_L + i * (w + GAP_COLONNE), w, etichettaW, y));
    y -= altezza;
  };

  // Righe di dati dentro una sezione gia' aperta (due colonne senza titolo).
  const datiADueColonne = (sinistra, destra, etichettaW = 70) => {
    const w = (LARG - GAP_COLONNE) / 2;
    const altezza = Math.max(altezzaRighe(sinistra, w, etichettaW), altezzaRighe(destra, w, etichettaW));
    serve(altezza + 8);
    disegnaRighe(sinistra, PAG_L, w, etichettaW, y);
    disegnaRighe(destra, PAG_L + w + GAP_COLONNE, w, etichettaW, y);
    y -= altezza;
  };

  // Riquadri affiancati: { etichetta, valore, nota, notaAllarme, barra: { pieni, totale }, rosso }.
  const riquadri = (celle, pesi = celle.map(() => 1)) => {
    const gap = 10;
    const somma = pesi.reduce((a, b) => a + b, 0);
    const larghezze = pesi.map((p) => ((LARG - gap * (celle.length - 1)) * p) / somma);
    const misure = celle.map((c, i) => {
      const w = larghezze[i] - 18;
      const size = larghezza(c.valore, grassetto, 13) > w ? 10.5 : 13;
      const valore = righeDi(c.valore, w, size, grassetto);
      const nota = c.nota ? righeDi(c.nota, w, 8) : [];
      return { size, valore, nota, altezza: 7 + 13 + valore.length * (size + 2) + (c.barra ? 13 : 0) + nota.length * 10 + (nota.length ? 3 : 0) + 3 };
    });
    const altezza = Math.max(...misure.map((m) => m.altezza));
    serve(altezza + 6);
    let x = PAG_L;
    celle.forEach((c, i) => {
      const m = misure[i];
      page.drawRectangle({ x, y: y - altezza, width: larghezze[i], height: altezza, borderColor: COLORI.linea, borderWidth: 0.75 });
      let yy = y - 7 - 7.5;
      spaziato(c.etichetta.toUpperCase(), x + 9, yy, 7.5, font, COLORI.grigio, 0.6);
      yy -= 3;
      m.valore.forEach((riga) => { yy -= m.size + 2; scrivi(riga, x + 9, yy + 3, m.size, grassetto, c.rosso ? COLORI.allarme : COLORI.inchiostro); });
      if (c.barra) {
        const seg = (larghezze[i] - 18 - 3 * (c.barra.totale - 1)) / c.barra.totale;
        for (let k = 0; k < c.barra.totale; k += 1) {
          page.drawRectangle({
            x: x + 9 + k * (seg + 3), y: yy - 11, width: seg, height: 8,
            borderColor: COLORI.inchiostro, borderWidth: 0.75, ...(k < c.barra.pieni ? { color: COLORI.inchiostro } : {}),
          });
        }
        yy -= 13;
      }
      m.nota.forEach((riga) => { yy -= 10; scrivi(riga, x + 9, yy, 8, font, c.notaAllarme ? COLORI.allarme : COLORI.grigio); });
      x += larghezze[i] + gap;
    });
    y -= altezza + 10;
  };

  // Riquadro con testo e, se c'e', una foto a destra.
  const riquadroTesto = ({ etichetta, testo, immagine }) => {
    const foto = immagine ? { w: 70, h: 50 } : null;
    const w = LARG - 18 - (foto ? foto.w + 10 : 0);
    const righe = righeDi(testo, w, 9.5);
    const altezza = Math.max(7 + 10 + righe.length * 13 + 5, foto ? foto.h + 14 : 0);
    serve(altezza + 6);
    page.drawRectangle({ x: PAG_L, y: y - altezza, width: LARG, height: altezza, borderColor: COLORI.linea, borderWidth: 0.75 });
    spaziato(etichetta.toUpperCase(), PAG_L + 9, y - 14.5, 7.5, font, COLORI.grigio, 0.6);
    righe.forEach((r, i) => scrivi(r, PAG_L + 9, y - 27 - i * 13, 9.5));
    if (foto) {
      const scala = Math.min(foto.w / immagine.width, foto.h / immagine.height);
      const iw = immagine.width * scala;
      const ih = immagine.height * scala;
      page.drawImage(immagine, { x: PAG_R - 9 - foto.w + (foto.w - iw), y: y - 7 - ih, width: iw, height: ih });
    }
    y -= altezza + 4;
  };

  // Elenco con caselle: { testo, ok } oppure { testo, manca: true } (casella vuota in rosso).
  const elencoCaselle = (voci, colonneN = 3) => {
    const w = (LARG - 14 * (colonneN - 1)) / colonneN;
    const misure = voci.map((v) => righeDi(v.testo, w - 15, 9.5, v.manca ? grassetto : font));
    const righeDiVoci = [];
    for (let i = 0; i < voci.length; i += colonneN) righeDiVoci.push(voci.slice(i, i + colonneN).map((v, k) => ({ v, righe: misure[i + k] })));
    righeDiVoci.forEach((riga) => {
      const altezza = Math.max(...riga.map((c) => c.righe.length)) * 12 + 4;
      serve(altezza + 2);
      riga.forEach(({ v, righe }, k) => {
        const x = PAG_L + k * (w + 14);
        const colore = v.manca ? COLORI.allarme : COLORI.inchiostro;
        page.drawRectangle({ x, y: y - 10, width: 9, height: 9, borderColor: colore, borderWidth: 0.9 });
        if (v.ok) {
          page.drawLine({ start: { x: x + 2, y: y - 5.5 }, end: { x: x + 3.8, y: y - 8 }, thickness: 1.3, color: colore });
          page.drawLine({ start: { x: x + 3.8, y: y - 8 }, end: { x: x + 7.5, y: y - 2.5 }, thickness: 1.3, color: colore });
        }
        righe.forEach((r, i) => scrivi(r, x + 15, y - 9 - i * 12, 9.5, v.manca ? grassetto : font, colore));
      });
      y -= altezza;
    });
  };

  // Tabella a due colonne (descrizione, importo) con riga di totale.
  const tabella = (righe, totale) => {
    righe.forEach(([d, v]) => {
      serve(18);
      scrivi(d, PAG_L, y - 11, 9.5);
      scrivi(v, PAG_R - larghezza(v, font, 9.5), y - 11, 9.5);
      y -= 17;
      linea(PAG_L, PAG_R, y, 0.5, COLORI.linea);
    });
    if (totale) {
      serve(22);
      scrivi(totale[0], PAG_L, y - 13, 10, grassetto);
      scrivi(totale[1], PAG_R - larghezza(totale[1], grassetto, 10), y - 13, 10, grassetto);
      y -= 19;
      linea(PAG_L, PAG_R, y, 1.2, COLORI.inchiostro);
    }
  };

  // Testo su fondo grigio chiaro (dichiarazioni).
  const paragrafo = (testo, size = 8.5) => {
    const righe = righeDi(testo, LARG - 20, size, font);
    const altezza = righe.length * (size + 3.5) + 14;
    serve(altezza + 8);
    y -= 10;
    page.drawRectangle({ x: PAG_L, y: y - altezza, width: LARG, height: altezza, color: COLORI.fondo });
    righe.forEach((r, i) => scrivi(r, PAG_L + 10, y - 13 - i * (size + 3.5), size, font, COLORI.inchiostro));
    y -= altezza;
  };

  const piccolo = (testo, colore = COLORI.grigio, size = 8.5) => {
    righeDi(testo, LARG, size, font).forEach((r) => { serve(12); scrivi(r, PAG_L, y - size - 2, size, font, colore); y -= size + 3.5; });
  };

  // Luogo/data e i due spazi firma.
  const firme = (dataTesto) => {
    serve(90);
    y -= 16;
    if (dataTesto) { scrivi(dataTesto, PAG_L, y - 8.5, 8.5, font, COLORI.grigio); y -= 12; }
    y -= 34;
    const w = (LARG - 40) / 2;
    ['Firma del cliente', 'Per l\'azienda'].forEach((t, i) => {
      const x = PAG_L + i * (w + 40);
      linea(x, x + w, y, 0.9, COLORI.inchiostro);
      scrivi(t, x, y - 12, 8.5, font, COLORI.grigio);
    });
    y -= 20;
  };

  const spazio = (n) => { y -= n; };

  const chiudi = async () => {
    pagine.forEach((p, i) => {
      p.drawLine({ start: { x: PAG_L, y: 40 }, end: { x: PAG_R, y: 40 }, thickness: 0.75, color: COLORI.linea });
      p.drawText(s(piede), { x: PAG_L, y: 28, size: 7.5, font, color: COLORI.grigio });
      const num = `Pagina ${i + 1} di ${pagine.length}`;
      p.drawText(num, { x: PAG_R - font.widthOfTextAtSize(num, 7.5), y: 28, size: 7.5, font, color: COLORI.grigio });
    });
    return doc.save();
  };

  return {
    doc, sezione, colonne, datiADueColonne, riquadri, riquadroTesto, elencoCaselle, tabella, paragrafo, piccolo, firme, spazio, chiudi,
    immagine: (src) => immagineDaUrl(doc, src),
  };
}
