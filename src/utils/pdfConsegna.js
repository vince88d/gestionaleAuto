// PDF del riepilogo di consegna (cliente, veicolo, scheda, spazio firma).
// Usato alla consegna e, per riscaricarlo dopo, dai dettagli della prenotazione.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { prezzoPrenotazione } from './dashboard';
import { COPERTURE } from './protezioni';

// "1.200 EUR" / "36,00 EUR": nel PDF si scrive EUR come nel resto del riepilogo.
const eur = (n, decimali = false) => `${Number(n || 0).toLocaleString('it-IT', {
  minimumFractionDigits: decimali ? 2 : 0, maximumFractionDigits: 2, useGrouping: 'always',
})} EUR`;

// Righe [etichetta, valore] della sezione "Protezione ed extra" del PDF.
// Vuoto per le prenotazioni senza protezione ne' extra (quelle di prima).
export function righeProtezioneExtra(prenotazione = {}) {
  const p = prenotazione.protezione;
  const extra = (Array.isArray(prenotazione.optional) ? prenotazione.optional : []).filter((r) => r?.quantita > 0);
  const righe = [];
  if (p) {
    righe.push(['Protezione', p.tipo === 'totale' ? `Totale (${eur(p.prezzo, true)})` : 'Base (inclusa)']);
    if (typeof p.danni === 'number') righe.push(['Danni (max)', `${eur(p.danni)} a carico del cliente`]);
    if (typeof p.furto === 'number') righe.push(['Furto (max)', `${eur(p.furto)} a carico del cliente`]);
    if (typeof p.cauzione === 'number') {
      righe.push(['Cauzione', `${eur(p.cauzione)}${prenotazione.cauzioneBloccata ? ' - bloccata sulla carta' : ''}`]);
    }
    const coperte = COPERTURE.filter(([k]) => p.copre?.[k]).map(([, nome], i) => (i === 0 ? nome : nome.toLowerCase()));
    if (coperte.length > 0) righe.push(['Copre anche', coperte.join(', ')]);
  }
  extra.forEach((r, i) => righe.push([i === 0 ? 'Extra' : '', `${r.nome} x ${r.quantita} (${eur(r.totale, true)})`]));
  return righe;
}

export async function generaRiepilogoPdf(prenotazione, scheda = {}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const lineSpacing = 18;
  const indent = 50;

  const drawTitle = (text) => {
    page.drawText(text, {
      x: indent,
      y,
      size: 20,
      font: bold,
      color: rgb(0.1, 0.2, 0.5),
    });
    y -= 30;
  };

  const drawSection = (title) => {
    page.drawText(title, {
      x: indent,
      y,
      size: 14,
      font: bold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 20;
    page.drawLine({
      start: { x: indent, y },
      end: { x: 545, y },
      thickness: 0.8,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 10;
  };

  const drawField = (label, value) => {
    page.drawText(`${label}:`, {
      x: indent,
      y,
      size: 12,
      font: bold,
      color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(value || '-', {
      x: indent + 130,
      y,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    y -= lineSpacing;
  };

  drawTitle('Riepilogo Prenotazione');
  drawSection('Cliente');
  drawField('Nome', prenotazione.cliente);
  drawField('Codice Fiscale', prenotazione.codiceFiscale);
  drawField('Patente', prenotazione.patente);
  drawField('Email', prenotazione.emailCliente);

  drawSection('Veicolo');
  drawField('Modello', prenotazione.veicolo);
  drawField('Targa', prenotazione.targa);
  drawField('Periodo', `dal ${prenotazione.dataInizio} al ${prenotazione.dataFine}`);
  drawField('Prezzo Totale', `${prezzoPrenotazione(prenotazione)} EUR`);

  const protezioneExtra = righeProtezioneExtra(prenotazione);
  if (protezioneExtra.length > 0) {
    drawSection('Protezione ed extra');
    protezioneExtra.forEach(([etichetta, valore]) => {
      if (etichetta) drawField(etichetta, valore);
      else {
        page.drawText(valore, { x: indent + 130, y, size: 12, font, color: rgb(0, 0, 0) });
        y -= lineSpacing;
      }
    });
  }

  drawSection('Scheda Veicolo');
  drawField('Carburante', scheda.carburante);
  drawField('Km alla consegna', scheda.kmIniziali);
  drawField('Danni', scheda.danni || 'Nessuno');

  if (scheda.accessori && Object.keys(scheda.accessori).length) {
    drawField('Accessori', '');
    Object.entries(scheda.accessori)
      .filter(([key]) => key !== 'altro')
      .forEach(([key, value]) => {
        page.drawText(`- ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value ? 'SI' : 'NO'}`, {
          x: indent + 20,
          y,
          size: 11,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= 14;
      });

    if (scheda.accessori.altro) {
      page.drawText(`- ${scheda.accessori.altro}: SI`, {
        x: indent + 20,
        y,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 14;
    }
  }

  y -= 30;
  page.drawLine({
    start: { x: indent, y },
    end: { x: indent + 250, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  page.drawText('Firma Cliente', {
    x: indent,
    y: y - 15,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  return doc.save();
}

// Chiede dove salvare e scrive il PDF (piu' l'eventuale contratto).
// Restituisce { success, cancelled, paths, error } come l'API di Electron.
export async function salvaPdfConsegna({ prenotazione, scheda, contrattoPdf = null, nomeContratto = '' }) {
  const riepilogo = await generaRiepilogoPdf(prenotazione, scheda || prenotazione.schedaVeicolo || {});
  return window.electronAPI.salvaDocumentiPrenotazione({
    prenotazione,
    riepilogoPdf: Array.from(new Uint8Array(riepilogo)),
    contrattoPdf,
    nomeContratto,
  });
}
