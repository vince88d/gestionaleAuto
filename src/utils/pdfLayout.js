// Impaginazione dei PDF del gestionale (verbale di consegna e di rientro):
// pagina A4, testata con logo e dati dell'azienda, fascia riassunto, sezioni
// numerate, tabelle, schemi, caselle, firme e piede con "Pagina i di n".
// Mockup approvato: formiarent-documenti/mockup/gestionale-pdf-verbali-v2.html
// (le misure sono in punti, come nel mockup).
//
// Regole seguite (analisi: formiarent-documenti/07-Analisi-PDF-verbali.md):
// - nessuna informazione solo a colore: rosso/verde hanno sempre una parola o
//   un segno disegnato accanto (✓ ✗ ▲ ▼ non esistono nel font, si disegnano);
// - testo scuro su bianco, il colore d'accento dell'azienda solo se ha
//   contrasto sufficiente (4,5 : 1);
// - titolo, autore e lingua italiana scritti nel file.
//
// Il font standard (Helvetica) non sa scrivere ogni carattere: `sicuro()`
// sostituisce frecce e virgolette tipografiche e mette "?" al posto di quello
// che non esiste (es. emoji nei nomi), cosi' il PDF non si rompe mai.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Colori del documento (0-255) e funzioni per usarli.
const SCURO = [26, 31, 38];
const GRIGIO = [85, 95, 107];
const LINEA = [213, 218, 224];
const FONDO = [244, 246, 248];
const ACCENTO_BASE = [31, 78, 121];
const VERDE = [37, 107, 62];
const VERDE_CHIARO = [233, 244, 237];
const ROSSO = [164, 55, 43];
const ROSSO_CHIARO = [251, 236, 235];
const BIANCO = [255, 255, 255];

const colore = ([r, g, b]) => rgb(r / 255, g / 255, b / 255);
const miscela = (c, con, quanto) => c.map((v, i) => Math.round(v + (con[i] - v) * quanto));

const luminanza = ([r, g, b]) => {
  const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

// Rapporto di contrasto WCAG tra due colori (da 1 a 21).
export function contrasto(a, b) {
  const [chiaro, scuro] = [luminanza(a), luminanza(b)].sort((x, y) => y - x);
  return (chiaro + 0.05) / (scuro + 0.05);
}

// Colore d'accento dell'azienda ("#1f4e79"): quello base se manca, non si legge
// o ha meno di 4,5 : 1 di contrasto sul bianco.
export function coloreAccento(esadecimale) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(esadecimale || '').trim());
  if (!m) return ACCENTO_BASE;
  const c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return contrasto(c, BIANCO) >= 4.5 ? c : ACCENTO_BASE;
}

const SOSTITUZIONI = [[/→/g, '->'], [/←/g, '<-'], [/[‘’]/g, "'"], [/[“”]/g, '"'], [/[–—]/g, '-'], [/…/g, '...'], [/ /g, ' ']];

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
    } else if (typeof window !== 'undefined' && typeof window.electronAPI?.scaricaImmagine === 'function') {
      // Nell'app: lo scarica il programma stesso (la pagina non puo' leggere Storage da un altro dominio).
      const esito = await window.electronAPI.scaricaImmagine(sorgente);
      if (!esito?.ok) return null;
      byte = Uint8Array.from(esito.byte);
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

const PAG_L = 44;
const PAG_R = 551;
const LARG = PAG_R - PAG_L;
const PAG_ALTEZZA = 842;
const LIMITE_BASSO = 62; // sopra il piede
const GAP_COLONNE = 22;

// Logo dell'azienda («data:image/png|jpeg;base64,…») incorporato nel PDF; null se
// manca o non si legge (si ripiega sul quadratino con le iniziali).
async function incorporaLogo(doc, dataUrl) {
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+=*)$/.exec(String(dataUrl || '').trim());
  if (!m) return null;
  try {
    const binario = typeof atob === 'function' ? atob(m[2]) : Buffer.from(m[2], 'base64').toString('binary');
    const byte = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    return m[1] === 'png' ? await doc.embedPng(byte) : await doc.embedJpg(byte);
  } catch {
    return null;
  }
}

// Iniziali per il marchio quando non c'e' un logo: "Formia Rent" -> "FR".
export function iniziali(nome) {
  const parole = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (parole.length === 0) return '';
  if (parole.length === 1) return parole[0].slice(0, 2).toUpperCase();
  return (parole[0][0] + parole[1][0]).toUpperCase();
}

// Foglio A4 che si riempie dall'alto verso il basso e va a capo da solo.
// `titolo` ("Verbale di consegna"), `numero` ("7F3A2C"), `data` ("12/10/2026"),
// `copia` (scritta sul bollino in alto a destra), `cliente` e `veicolo` per
// l'intestazione delle pagine successive, `piede` (testo a sinistra in fondo).
export async function nuovoFoglio({
  azienda = {}, titolo, numero = '', data = '', copia = '', riepilogo = '', piede = '', soggetto = '',
}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const grassetto = await doc.embedFont(StandardFonts.HelveticaBold);
  const caratteri = new Set(font.getCharacterSet());
  const logo = await incorporaLogo(doc, azienda.logo);
  const s = (t) => sicuro(t, caratteri);
  const larghezza = (t, f, size) => f.widthOfTextAtSize(s(t), size);

  const accento = coloreAccento(azienda.coloreAccento);
  const accentoChiaro = miscela(accento, BIANCO, 0.9);
  const accentoBordo = miscela(accento, BIANCO, 0.7);
  const C = {
    scuro: colore(SCURO), grigio: colore(GRIGIO), linea: colore(LINEA), fondo: colore(FONDO), accento: colore(accento),
    accentoChiaro: colore(accentoChiaro), accentoBordo: colore(accentoBordo), verde: colore(VERDE), verdeChiaro: colore(VERDE_CHIARO),
    rosso: colore(ROSSO), rossoChiaro: colore(ROSSO_CHIARO), bianco: colore(BIANCO),
  };
  const tono = (t) => ({ rosso: C.rosso, verde: C.verde }[t] || C.scuro);

  // Dati del file (titolo nella barra della finestra, lingua, autore).
  const nomeDocumento = [titolo, numero && `n. ${numero}`].filter(Boolean).join(' ');
  doc.setTitle(s(nomeDocumento), { showInWindowTitleBar: true });
  doc.setLanguage('it-IT');
  doc.setAuthor(s(azienda.nome || ''));
  doc.setSubject(s(soggetto || titolo));
  doc.setCreator('Gestionale Noleggio');
  doc.setProducer('Gestionale Noleggio');
  doc.setCreationDate(new Date());

  const pagine = [];
  let page;
  let y;

  const scrivi = (t, x, yy, size, f = font, col = C.scuro) => page.drawText(s(t), { x, y: yy, size, font: f, color: col });
  const scriviDestra = (t, xDestra, yy, size, f = font, col = C.scuro) => scrivi(t, xDestra - larghezza(t, f, size), yy, size, f, col);
  const scriviCentro = (t, xCentro, yy, size, f = font, col = C.scuro) => scrivi(t, xCentro - larghezza(t, f, size) / 2, yy, size, f, col);
  const spaziato = (t, x, yy, size, f, col, spazio) => {
    let cx = x;
    Array.from(s(t)).forEach((c) => {
      page.drawText(c, { x: cx, y: yy, size, font: f, color: col });
      cx += f.widthOfTextAtSize(c, size) + spazio;
    });
    return cx - spazio;
  };
  const linea = (x1, x2, yy, spessore, col) => page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: spessore, color: col });
  const righeDi = (t, w, size, f = font) => spezzaRighe(s(t), w, (x) => f.widthOfTextAtSize(x, size));

  // Rettangolo (con angoli arrotondati) con l'angolo in alto a sinistra in (x, alto).
  const riquadro = (x, alto, w, h, { fondo, bordo, spessore = 0.75, raggio = 5 } = {}) => {
    const r = Math.min(raggio, w / 2, h / 2);
    const percorso = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    page.drawSvgPath(percorso, {
      x, y: alto, ...(fondo ? { color: fondo } : {}), ...(bordo ? { borderColor: bordo, borderWidth: spessore } : {}),
    });
  };
  const cerchio = (cx, cy, r, fondo) => page.drawCircle({ x: cx, y: cy, size: r, color: fondo });
  const spunta = (x, yy, col, size = 1) => { // segno ✓ con il piede in (x, yy)
    page.drawLine({ start: { x, y: yy + 3 * size }, end: { x: x + 2 * size, y: yy }, thickness: 1.4, color: col });
    page.drawLine({ start: { x: x + 2 * size, y: yy }, end: { x: x + 6.4 * size, y: yy + 6.4 * size }, thickness: 1.4, color: col });
  };
  const croce = (x, yy, col, size = 1) => { // segno ✗ nel quadrato con l'angolo basso a sinistra in (x, yy)
    page.drawLine({ start: { x, y: yy }, end: { x: x + 5.4 * size, y: yy + 5.4 * size }, thickness: 1.4, color: col });
    page.drawLine({ start: { x, y: yy + 5.4 * size }, end: { x: x + 5.4 * size, y: yy }, thickness: 1.4, color: col });
  };
  const triangolo = (x, yy, su, col) => page.drawSvgPath(su ? 'M 0 5 L 5 5 L 2.5 0 Z' : 'M 0 0 L 5 0 L 2.5 5 Z', { x, y: yy + 5.5, color: col });

  // Marchio in alto a sinistra: il logo (alto al massimo `lato`, largo al massimo
  // 3,5 volte) oppure il quadratino con le iniziali. Restituisce la larghezza usata.
  const marchio = (x, alto, lato) => {
    if (logo) {
      const fattore = Math.min(lato / logo.height, (lato * 3.5) / logo.width);
      const w = logo.width * fattore;
      const h = logo.height * fattore;
      page.drawImage(logo, { x, y: alto - (lato + h) / 2, width: w, height: h });
      return w;
    }
    riquadro(x, alto, lato, lato, { fondo: C.accento, raggio: lato / 4.5 });
    const sigla = iniziali(azienda.nome);
    if (sigla) scriviCentro(sigla, x + lato / 2, alto - lato / 2 - lato * 0.17, lato * 0.44, grassetto, C.bianco);
    return lato;
  };

  const testata = () => {
    y = PAG_ALTEZZA - 44;
    const alto = y;
    const wMarchio = marchio(PAG_L, alto, 34);
    const xTesto = PAG_L + wMarchio + 10;
    if (azienda.nome) scrivi(azienda.nome, xTesto, alto - 13, 14, grassetto);
    const contatti = [
      [azienda.indirizzo, azienda.partitaIva && `P.IVA ${azienda.partitaIva}`].filter(Boolean).join(' · '),
      [azienda.telefono && `Tel. ${azienda.telefono}`, azienda.email].filter(Boolean).join(' · '),
    ].filter(Boolean);
    contatti.forEach((c, i) => scrivi(c, xTesto, alto - 23 - i * 9.5, 7.5, font, C.grigio));
    scriviDestra(titolo, PAG_R, alto - 18, 19, grassetto, C.accento);
    const sotto = [numero && `N. ${numero}`, data].filter(Boolean).join(' · ');
    if (sotto) scriviDestra(sotto, PAG_R, alto - 31, 8, font, C.grigio);
    if (copia) {
      const t = copia.toUpperCase();
      const w = larghezza(t, grassetto, 7) + (t.length - 1) * 0.6 + 14;
      riquadro(PAG_R - w, alto - 37, w, 13, { bordo: C.accento, spessore: 0.9, raggio: 6.5 });
      spaziato(t, PAG_R - w + 7, alto - 46.5, 7, grassetto, C.accento, 0.6);
    }
    y = alto - 56;
  };

  const nuovaPagina = (prima = false) => {
    page = doc.addPage([595, PAG_ALTEZZA]);
    pagine.push(page);
    if (prima) { testata(); return; }
    y = PAG_ALTEZZA - 44;
    const xTesto = PAG_L + marchio(PAG_L, y, 24) + 8;
    if (azienda.nome) scrivi(azienda.nome, xTesto, y - 11, 11, grassetto);
    scrivi([titolo, numero && `N. ${numero}`].filter(Boolean).join(' · '), xTesto, y - 21, 7.5, font, C.grigio);
    if (riepilogo) scriviDestra(riepilogo, PAG_R, y - 11, 8, font, C.grigio);
    y -= 38;
  };
  nuovaPagina(true);

  const serve = (altezza) => { if (y - altezza < LIMITE_BASSO) nuovaPagina(); };

  // ---- Fascia riassunto: [{ etichetta, valore }] in una riga colorata.
  const fascia = (celle, pesi = celle.map(() => 1)) => {
    const somma = pesi.reduce((a, b) => a + b, 0);
    const larghezze = pesi.map((p) => (LARG * p) / somma);
    const altezza = 34;
    serve(altezza + 6);
    riquadro(PAG_L, y, LARG, altezza, { fondo: C.accentoChiaro });
    let x = PAG_L;
    celle.forEach((c, i) => {
      if (i > 0) page.drawRectangle({ x, y: y - altezza, width: 1.2, height: altezza, color: C.bianco });
      spaziato(c.etichetta.toUpperCase(), x + 10, y - 13, 6.8, font, C.grigio, 0.7);
      let size = 11.5;
      while (size > 8 && larghezza(c.valore, grassetto, size) > larghezze[i] - 18) size -= 0.5;
      const t = righeDi(c.valore, larghezze[i] - 18, size, grassetto)[0];
      scrivi(t, x + 10, y - 27, size, grassetto);
      x += larghezze[i];
    });
    y -= altezza + 4;
  };

  // ---- Titolo di sezione numerato.
  let nSezione = 0;
  const sezione = (testo) => {
    nSezione += 1;
    const n = nSezione;
    serve(70);
    y -= 15;
    cerchio(PAG_L + 7.5, y - 5.5, 7.5, C.accento);
    scriviCentro(String(n), PAG_L + 7.5, y - 8, 8, grassetto, C.bianco);
    scrivi(testo, PAG_L + 20, y - 8.5, 11, grassetto);
    const fine = PAG_L + 20 + larghezza(testo, grassetto, 11) + 7;
    linea(fine, PAG_R, y - 5.5, 0.75, C.linea);
    y -= 22;
  };

  // ---- Dati affiancati in due colonne: etichetta a sinistra, valore a destra.
  const altezzaCoppie = (righe, w, etichettaW) => righe.reduce(
    (tot, [, v]) => tot + Math.max(1, righeDi(v, w - etichettaW - 8, 9.5, grassetto).length) * 12 + 7, 0,
  );
  const disegnaCoppie = (righe, x, w, etichettaW, yInizio) => {
    let yy = yInizio;
    righe.forEach(([e, v]) => {
      const parti = righeDi(v, w - etichettaW - 8, 9.5, grassetto);
      const altezza = Math.max(1, parti.length) * 12 + 7;
      scrivi(e, x, yy - 11, 9.5, font, C.grigio);
      parti.forEach((p, i) => scriviDestra(p, x + w, yy - 11 - i * 12, 9.5, grassetto));
      yy -= altezza;
      linea(x, x + w, yy, 0.5, C.fondo);
    });
  };
  const coppie = (sinistra, destra = [], etichettaW = 78) => {
    const w = destra.length === 0 ? LARG : (LARG - GAP_COLONNE) / 2;
    const altezza = Math.max(altezzaCoppie(sinistra, w, etichettaW), destra.length ? altezzaCoppie(destra, w, etichettaW) : 0);
    serve(altezza + 4);
    disegnaCoppie(sinistra, PAG_L, w, etichettaW, y);
    if (destra.length) disegnaCoppie(destra, PAG_L + w + GAP_COLONNE, w, etichettaW, y);
    y -= altezza + 2;
  };

  // ---- Riquadri affiancati: { etichetta, valore, nota, notaAllarme, barra: { pieni, totale }, rosso }.
  const riquadri = (celle, pesi = celle.map(() => 1)) => {
    const gap = 8;
    const somma = pesi.reduce((a, b) => a + b, 0);
    const larghezze = pesi.map((p) => ((LARG - gap * (celle.length - 1)) * p) / somma);
    const misure = celle.map((c, i) => {
      const w = larghezze[i] - 20;
      const size = larghezza(c.valore, grassetto, 13) > w ? 10.5 : 13;
      const valore = righeDi(c.valore, w, size, grassetto);
      const nota = c.nota ? righeDi(c.nota, w, 8) : [];
      return { size, valore, nota, altezza: 12 + 8 + valore.length * (size + 2) + (c.barra ? 11 : 0) + nota.length * 10 + (nota.length ? 2 : 0) + 6 };
    });
    const altezza = Math.max(...misure.map((m) => m.altezza));
    serve(altezza + 6);
    let x = PAG_L;
    celle.forEach((c, i) => {
      const m = misure[i];
      riquadro(x, y, larghezze[i], altezza, { bordo: C.linea });
      let yy = y - 14;
      spaziato(c.etichetta.toUpperCase(), x + 10, yy, 6.8, font, C.grigio, 0.7);
      yy -= 3;
      m.valore.forEach((riga) => { yy -= m.size + 2; scrivi(riga, x + 10, yy, m.size, grassetto, c.rosso ? C.rosso : C.scuro); });
      if (c.barra) {
        const seg = (larghezze[i] - 20 - 2 * (c.barra.totale - 1)) / c.barra.totale;
        for (let k = 0; k < c.barra.totale; k += 1) {
          page.drawRectangle({ x: x + 10 + k * (seg + 2), y: yy - 10, width: seg, height: 5, color: k < c.barra.pieni ? C.accento : C.linea });
        }
        yy -= 11;
      }
      m.nota.forEach((riga) => { yy -= 10; scrivi(riga, x + 10, yy, 8, font, c.notaAllarme ? C.rosso : C.grigio); });
      x += larghezze[i] + gap;
    });
    y -= altezza + 8;
  };

  // ---- Tabella. colonne: [{ titolo, peso, destra }]. Una cella e' una stringa o
  // { testo, tono: 'rosso'|'verde', grassetto, segno: 'su'|'giu', tag: 'Nuovo' }.
  const tabella = ({ colonne: cols, righe, totale }) => {
    const somma = cols.reduce((a, c) => a + (c.peso || 1), 0);
    const ws = cols.map((c) => (LARG * (c.peso || 1)) / somma);
    const normale = (c) => (typeof c === 'object' && c !== null ? c : { testo: c });
    const misuraRiga = (celle, size = 9.5) => Math.max(...celle.map((c, i) => {
      const cc = normale(c);
      const extra = (cc.segno ? 9 : 0) + (cc.tag ? larghezza(cc.tag, grassetto, 6.5) + 14 : 0);
      return Math.max(1, righeDi(cc.testo ?? '', ws[i] - 12 - extra, size, cc.grassetto || cc.tono ? grassetto : font).length);
    }));
    const disegnaRiga = (celle, yTop, size, spessoreSotto, forzaGrassetto) => {
      const righeN = misuraRiga(celle, size);
      let x = PAG_L;
      celle.forEach((c, i) => {
        const cc = normale(c);
        const f = cc.grassetto || cc.tono || forzaGrassetto ? grassetto : font;
        const col = tono(cc.tono);
        const destra = cols[i].destra;
        let xTesto = x + 6;
        const extra = (cc.segno ? 9 : 0) + (cc.tag ? larghezza(cc.tag, grassetto, 6.5) + 14 : 0);
        const parti = righeDi(cc.testo ?? '', ws[i] - 12 - extra, size, f);
        if (cc.tag) {
          const tw = larghezza(cc.tag.toUpperCase(), grassetto, 6.5) + 8;
          const sfondo = cc.tono === 'verde' ? C.verdeChiaro : cc.tono === 'rosso' ? C.rossoChiaro : C.fondo;
          const txBox = destra ? x + ws[i] - 6 - tw : x + 6;
          riquadro(txBox, yTop - 4, tw, 11, { fondo: sfondo, raggio: 2.5 });
          scrivi(cc.tag.toUpperCase(), txBox + 4, yTop - 11.6, 6.5, grassetto, col);
          xTesto = destra ? x + 6 : x + 6 + tw + 5;
        }
        if (cc.segno) { triangolo(xTesto, yTop - 11, cc.segno === 'su', col); xTesto += 9; }
        parti.forEach((p, k) => {
          if (destra) scriviDestra(p, x + ws[i] - 6, yTop - 11 - k * 12, size, f, col);
          else scrivi(p, xTesto, yTop - 11 - k * 12, size, f, col);
        });
        x += ws[i];
      });
      const altezza = righeN * 12 + 8;
      if (spessoreSotto > 0) linea(PAG_L, PAG_R, yTop - altezza, spessoreSotto, spessoreSotto > 1 ? C.scuro : C.linea);
      return altezza;
    };

    serve(30);
    let x = PAG_L;
    cols.forEach((c, i) => {
      const t = c.titolo.toUpperCase();
      if (c.destra) scriviDestra(t, x + ws[i] - 6, y - 10, 6.8, font, C.grigio);
      else spaziato(t, x + 6, y - 10, 6.8, font, C.grigio, 0.6);
      x += ws[i];
    });
    linea(PAG_L, PAG_R, y - 15, 1.2, C.scuro);
    y -= 15;
    righe.forEach((celle) => {
      serve(misuraRiga(celle) * 12 + 10);
      y -= disegnaRiga(celle, y, 9.5, 0.5);
    });
    if (totale) {
      serve(24);
      linea(PAG_L, PAG_R, y, 1.2, C.scuro);
      disegnaRiga(totale, y, 10.5, 0, true);
      y -= misuraRiga(totale, 10.5) * 12 + 8;
    }
    y -= 4;
  };

  // ---- Danni: elenco numerato [{ numero, titolo, dettaglio, nuovo }]. Vuoto = «Nessun danno».
  // `schema`, se c'e', e' { larghezza, altezza, disegna({ page, x, alto, larghezza, helper }) } messo a sinistra.
  const danni = (voci, { vuoto = 'Nessun danno segnato', schema = null, nota = '' } = {}) => {
    const wSchema = schema ? schema.larghezza || 190 : 0;
    const xLista = PAG_L + (schema ? wSchema + 14 : 0);
    const wLista = PAG_R - xLista;
    let altezzaLista = 0;
    const blocchi = voci.map((v) => {
      const t = righeDi(v.titolo, wLista - 22, 9.5, grassetto);
      const d = v.dettaglio || v.nuovo ? righeDi(v.dettaglio || '', wLista - 22 - (v.nuovo ? 38 : 0), 7.8) : [];
      const altezza = t.length * 12 + Math.max(d.length, v.nuovo ? 1 : 0) * 10 + 10;
      altezzaLista += altezza;
      return { t, d, altezza, v };
    });
    if (voci.length === 0) altezzaLista = 24;
    const righeNota = nota ? righeDi(nota, wLista, 7.8) : [];
    altezzaLista += righeNota.length * 10 + (righeNota.length ? 6 : 0);
    const altezza = Math.max(altezzaLista, schema ? schema.altezza : 0);
    serve(altezza + 6);
    if (schema) schema.disegna({ page, x: PAG_L, alto: y, larghezza: wSchema, helper: { riquadro, scrivi, scriviCentro, cerchio, C, font, grassetto } });
    let yy = y;
    if (voci.length === 0) {
      riquadro(xLista, yy, wLista, 22, { fondo: C.verdeChiaro });
      scrivi(vuoto, xLista + 10, yy - 14.5, 9.5, grassetto, C.verde);
      yy -= 24;
    }
    blocchi.forEach(({ t, d, altezza: h, v }) => {
      const pinColore = v.nuovo ? C.rosso : C.grigio;
      cerchio(xLista + 7, yy - 11, 7, pinColore);
      scriviCentro(String(v.numero), xLista + 7, yy - 13.8, 8, grassetto, C.bianco);
      t.forEach((r, i) => scrivi(r, xLista + 22, yy - 12 - i * 12, 9.5, grassetto));
      let yd = yy - 12 - t.length * 12 + 2;
      if (v.nuovo) {
        riquadro(xLista + 22, yd + 1, 31, 9.5, { fondo: C.rossoChiaro, raggio: 2.5 });
        scrivi('NUOVO', xLista + 25.5, yd - 6, 6.5, grassetto, C.rosso);
      }
      d.forEach((r, i) => scrivi(r, xLista + 22 + (v.nuovo ? 38 : 0), yd - 6.5 - i * 10, 7.8, font, C.grigio));
      yy -= h;
      linea(xLista, PAG_R, yy + 2, 0.5, C.fondo);
    });
    righeNota.forEach((r, i) => scrivi(r, xLista, yy - 8 - i * 10, 7.8, font, C.grigio));
    y -= altezza + 6;
  };

  // ---- Caselle: { testo, ok } (spuntata), { testo, manca } (rossa con ✗), { testo } (vuota).
  const caselle = (voci, colonneN = 3) => {
    const w = (LARG - 12 * (colonneN - 1)) / colonneN;
    const misure = voci.map((v) => righeDi(v.testo, w - 18, 9.5, v.manca ? grassetto : font));
    for (let i = 0; i < voci.length; i += colonneN) {
      const riga = voci.slice(i, i + colonneN).map((v, k) => ({ v, righe: misure[i + k] }));
      const altezza = Math.max(...riga.map((c) => c.righe.length)) * 12 + 5;
      serve(altezza + 2);
      riga.forEach(({ v, righe }, k) => {
        const x = PAG_L + k * (w + 12);
        const col = v.manca ? C.rosso : v.ok ? C.verde : C.scuro;
        riquadro(x, y - 1, 11, 11, { ...(v.manca || v.ok ? { fondo: col } : {}), bordo: col, spessore: 1.2, raggio: 2 });
        if (v.ok) spunta(x + 2.3, y - 7.6, C.bianco, 0.9);
        if (v.manca) croce(x + 2.8, y - 7.4, C.bianco, 0.9);
        righe.forEach((r, j) => scrivi(r, x + 17, y - 9 - j * 12, 9.5, v.manca ? grassetto : font, col));
      });
      y -= altezza;
    }
  };

  // ---- Riquadro colorato con righe etichetta/valore e, se serve, un totale grande.
  // righe: [[etichetta, valore]]; totale: [etichetta, valore]; nota: testo piccolo.
  const riquadroDati = ({ etichetta, testo = '', righe = [], totale = null, nota = '' }) => {
    const righeTesto = testo ? righeDi(testo, LARG - 22, 9.5) : [];
    const righeNota = nota ? righeDi(nota, LARG - 22, 7.8) : [];
    const altezza = 12 + 10 + righeTesto.length * 12 + righe.length * 13 + (totale ? 22 : 0) + righeNota.length * 10 + (righeNota.length ? 4 : 0) + 8;
    serve(altezza + 8);
    riquadro(PAG_L, y, LARG, altezza, { fondo: C.accentoChiaro, bordo: C.accentoBordo });
    let yy = y - 16;
    spaziato(etichetta.toUpperCase(), PAG_L + 11, yy, 6.8, font, C.grigio, 0.7);
    righeTesto.forEach((r) => { yy -= 13; scrivi(r, PAG_L + 11, yy, 9.5); });
    righe.forEach(([e, v]) => {
      yy -= 13;
      scrivi(e, PAG_L + 11, yy, 9.5);
      scriviDestra(v, PAG_R - 11, yy, 9.5);
    });
    if (totale) {
      yy -= 6;
      linea(PAG_L + 11, PAG_R - 11, yy, 0.75, C.accentoBordo);
      yy -= 15;
      scrivi(totale[0], PAG_L + 11, yy, 10, grassetto);
      scriviDestra(totale[1], PAG_R - 11, yy - 1, 13, grassetto);
    }
    righeNota.forEach((r) => { yy -= 10; scrivi(r, PAG_L + 11, yy - 4, 7.8, font, C.grigio); });
    y -= altezza + 8;
  };

  // ---- Foto: griglia da 4. items: [{ immagine, etichetta, didascalia }]; sotto
  // ogni foto il nome e (piu' piccolo) quando e' stata scattata e caricata.
  const foto = (items, { colonneN = 4, altezzaCella = 62 } = {}) => {
    const gap = 6;
    const w = (LARG - gap * (colonneN - 1)) / colonneN;
    for (let i = 0; i < items.length; i += colonneN) {
      serve(altezzaCella + 38);
      items.slice(i, i + colonneN).forEach((it, k) => {
        const x = PAG_L + k * (w + gap);
        page.drawRectangle({ x, y: y - altezzaCella, width: w, height: altezzaCella, color: C.fondo });
        if (it.immagine) {
          const scala = Math.min(w / it.immagine.width, altezzaCella / it.immagine.height);
          const iw = it.immagine.width * scala;
          const ih = it.immagine.height * scala;
          page.drawImage(it.immagine, { x: x + (w - iw) / 2, y: y - altezzaCella + (altezzaCella - ih) / 2, width: iw, height: ih });
        }
        if (it.etichetta) righeDi(it.etichetta, w, 7.5, grassetto).slice(0, 1).forEach((r) => scrivi(r, x, y - altezzaCella - 9, 7.5, grassetto));
        if (it.didascalia) righeDi(it.didascalia, w, 6.3).slice(0, 2).forEach((r, j) => scrivi(r, x, y - altezzaCella - 17.5 - j * 7.5, 6.3, font, C.grigio));
      });
      y -= altezzaCella + 36;
    }
  };

  // ---- Testo in un riquadro con bordo (note).
  const nota = (testo) => {
    const righe = righeDi(testo, LARG - 20, 9.5);
    const altezza = righe.length * 12 + 14;
    serve(altezza + 6);
    riquadro(PAG_L, y, LARG, altezza, { bordo: C.linea });
    righe.forEach((r, i) => scrivi(r, PAG_L + 10, y - 16 - i * 12, 9.5));
    y -= altezza + 6;
  };

  // ---- Dichiarazione sopra le firme, su fondo grigio chiaro.
  const dichiarazione = (testo, intestazione = 'Dichiarazione') => {
    const righe = righeDi(testo, LARG - 20, 8.5);
    const altezza = righe.length * 11.5 + 26;
    serve(altezza + 8);
    y -= 8;
    riquadro(PAG_L, y, LARG, altezza, { fondo: C.fondo });
    scrivi(intestazione, PAG_L + 10, y - 15, 8.5, grassetto);
    righe.forEach((r, i) => scrivi(r, PAG_L + 10, y - 27 - i * 11.5, 8.5));
    y -= altezza;
  };

  const piccolo = (testo, col = C.grigio, size = 7.4) => {
    righeDi(testo, LARG, size, font).forEach((r) => { serve(12); scrivi(r, PAG_L, y - size - 1, size, font, col); y -= size + 3; });
  };

  // ---- Osservazioni del cliente: testo scritto dallo staff, oppure righe vuote da
  // riempire a mano (cosi' il cliente puo' dire «firmo con riserva» sul foglio).
  const osservazioni = (testo = '') => {
    const righe = testo ? righeDi(testo, LARG - 20, 9) : [];
    const altezza = Math.max(righe.length, 3) * 13 + 22;
    serve(altezza + 10);
    y -= 10;
    riquadro(PAG_L, y, LARG, altezza, { bordo: C.linea });
    spaziato('OSSERVAZIONI DEL CLIENTE', PAG_L + 10, y - 13, 6.8, font, C.grigio, 0.7);
    if (righe.length > 0) righe.forEach((r, i) => scrivi(r, PAG_L + 10, y - 27 - i * 13, 9));
    else for (let i = 0; i < 3; i += 1) linea(PAG_L + 10, PAG_R - 10, y - 32 - i * 13, 0.5, C.linea);
    y -= altezza;
  };

  // ---- Due spazi firma. `mancante`: testo scritto al posto della firma del cliente
  // (rifiuto o assenza): resta visibile che la firma non c'e'.
  const firme = (sinistra = 'Il cliente', destra = "Per l'azienda", mancante = '') => {
    const w = (LARG - 26) / 2;
    const righeMancante = mancante ? righeDi(mancante, w - 14, 8.5, grassetto) : [];
    const altezzaBox = righeMancante.length * 11 + 10;
    serve((mancante ? altezzaBox + 14 : 38) + 34);
    y -= mancante ? altezzaBox + 14 : 38;
    [sinistra, destra].forEach((t, i) => {
      const x = PAG_L + i * (w + 26);
      if (i === 0 && mancante) {
        riquadro(x, y + 4 + altezzaBox, w, altezzaBox, { fondo: C.rossoChiaro, bordo: C.rosso, raggio: 3 });
        righeMancante.forEach((r, k) => scrivi(r, x + 7, y + 4 + altezzaBox - 13 - k * 11, 8.5, grassetto, C.rosso));
      } else linea(x, x + w, y, 0.9, C.scuro);
      scrivi(t, x, y - 11, 8, font, C.grigio);
    });
    y -= 20;
  };

  const spazio = (n) => { y -= n; };

  const chiudi = async () => {
    pagine.forEach((p, i) => {
      p.drawLine({ start: { x: PAG_L, y: 40 }, end: { x: PAG_R, y: 40 }, thickness: 0.75, color: C.linea });
      p.drawText(s(piede), { x: PAG_L, y: 28, size: 7.5, font, color: C.grigio });
      const num = `Pagina ${i + 1} di ${pagine.length}`;
      p.drawText(num, { x: PAG_R - font.widthOfTextAtSize(num, 7.5), y: 28, size: 7.5, font, color: C.grigio });
    });
    return doc.save();
  };

  return {
    doc, fascia, sezione, coppie, riquadri, tabella, danni, caselle, riquadroDati, foto, nota, dichiarazione, piccolo, osservazioni, firme, spazio, chiudi,
    immagine: (src) => immagineDaUrl(doc, src),
  };
}
