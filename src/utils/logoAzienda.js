// Logo dell'azienda per i verbali PDF e il menu. Le funzioni pure (misure,
// proporzioni) sono testate; `preparaLogo` usa il browser per ridurre l'immagine
// e restituirla come testo («data:image/png;base64,…»), pronta da salvare nelle
// Impostazioni dell'azienda e da incorporare nel PDF.

import { LOGO_MAX_CARATTERI } from './azienda';

export const LOGO_LATO_MAX = 400; // punti, sul lato piu' lungo
export const LOGO_PESO_MAX_FILE = 5 * 1024 * 1024; // file di partenza

// Misure ridotte per stare in `max` x `max`, senza ingrandire.
export function dimensioniLogo(larghezza, altezza, max = LOGO_LATO_MAX) {
  const l = Number(larghezza);
  const a = Number(altezza);
  if (!(l > 0) || !(a > 0)) return { larghezza: 0, altezza: 0 };
  const fattore = Math.min(1, max / Math.max(l, a));
  return { larghezza: Math.max(1, Math.round(l * fattore)), altezza: Math.max(1, Math.round(a * fattore)) };
}

// Quasi quadrato: sta nel quadratino del menu senza diventare illeggibile.
export function quasiQuadrato(larghezza, altezza) {
  if (!(larghezza > 0) || !(altezza > 0)) return false;
  const rapporto = larghezza / altezza;
  return rapporto >= 1 / 1.4 && rapporto <= 1.4;
}

const daBase64 = (testo) => {
  try {
    const binario = typeof atob === 'function' ? atob(testo) : Buffer.from(testo, 'base64').toString('binary');
    return Uint8Array.from(binario, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
};

// Larghezza e altezza di un PNG o JPEG dal testo «data:image/…;base64,…», senza
// caricarlo (serve a scegliere il disegno del menu). null se non si legge.
export function dimensioniDaDataUrl(url) {
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+=*)$/.exec(String(url || ''));
  if (!m) return null;
  const byte = daBase64(m[2]);
  if (!byte) return null;
  if (m[1] === 'png') {
    if (byte.length < 24) return null;
    const vista = new DataView(byte.buffer);
    return { larghezza: vista.getUint32(16), altezza: vista.getUint32(20) };
  }
  let p = 2;
  while (p + 9 < byte.length) {
    if (byte[p] !== 0xff) { p += 1; continue; }
    const tipo = byte[p + 1];
    if (tipo >= 0xc0 && tipo <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(tipo)) {
      return { altezza: (byte[p + 5] << 8) | byte[p + 6], larghezza: (byte[p + 7] << 8) | byte[p + 8] };
    }
    p += 2 + ((byte[p + 2] << 8) | byte[p + 3]);
  }
  return null;
}

const caricaImmagine = (file) => new Promise((resolve, reject) => {
  const indirizzo = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(indirizzo); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(indirizzo); reject(new Error('immagine-non-leggibile')); };
  img.src = indirizzo;
});

// Riduce il file scelto (PNG, JPG, WebP, SVG) a un PNG di al massimo 400 punti;
// se pesa troppo lo salva come JPEG su sfondo bianco, riducendolo ancora se serve.
// Restituisce { logo, larghezza, altezza, kb }. Errori: 'tipo-non-valido', 'file-troppo-grande',
// 'immagine-non-leggibile', 'logo-troppo-pesante'.
export async function preparaLogo(file) {
  if (!file || !/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error('tipo-non-valido');
  if (file.size > LOGO_PESO_MAX_FILE) throw new Error('file-troppo-grande');
  const img = await caricaImmagine(file);
  const origL = img.naturalWidth || 300;
  const origA = img.naturalHeight || 100;
  let fattore = 1;
  for (let tentativo = 0; tentativo < 5; tentativo += 1) {
    const { larghezza, altezza } = dimensioniLogo(origL * fattore, origA * fattore);
    const tela = document.createElement('canvas');
    tela.width = larghezza;
    tela.height = altezza;
    const ctx = tela.getContext('2d');
    ctx.drawImage(img, 0, 0, larghezza, altezza);
    let logo = tela.toDataURL('image/png');
    if (logo.length > LOGO_MAX_CARATTERI) {
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, larghezza, altezza);
      logo = tela.toDataURL('image/jpeg', 0.85);
    }
    if (logo.length <= LOGO_MAX_CARATTERI) {
      return { logo, larghezza, altezza, kb: Math.max(1, Math.round((logo.length * 0.75) / 1024)) };
    }
    fattore *= 0.7;
  }
  throw new Error('logo-troppo-pesante');
}

export const MESSAGGI_ERRORE_LOGO = {
  'tipo-non-valido': 'Scegli un file PNG, JPG, WebP o SVG.',
  'file-troppo-grande': 'Il file è troppo grande (massimo 5 MB).',
  'immagine-non-leggibile': 'Non riesco a leggere questa immagine: prova con un altro file.',
  'logo-troppo-pesante': 'Il logo è troppo pesante anche ridotto: prova con un file più semplice.',
};
