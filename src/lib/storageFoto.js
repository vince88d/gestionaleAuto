import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../components/firebase';
import { controllaFile, dimensioniRidotte, nomeFileVeicolo, eFotoIncorporata } from '../utils/immagineVeicolo';

// Ridimensiona la foto (lato massimo 1600 px), la converte in WebP (mantiene la
// trasparenza dei PNG ritagliati) e la carica su Firebase Storage nella
// cartella indicata. Restituisce l'indirizzo web da salvare nel veicolo.
async function caricaComeWebp(file, cartella, nome = nomeFileVeicolo()) {
  const immagine = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { larghezza, altezza } = dimensioniRidotte(immagine.width, immagine.height);
  const canvas = document.createElement('canvas');
  canvas.width = larghezza;
  canvas.height = altezza;
  canvas.getContext('2d').drawImage(immagine, 0, 0, larghezza, altezza);
  immagine.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) throw new Error('Non riesco a preparare la foto. Prova con un altro file.');

  const riferimento = ref(storage, `${cartella}/${nome}`);
  await uploadBytes(riferimento, blob, {
    contentType: 'image/webp',
    cacheControl: 'public,max-age=31536000,immutable',
  });
  return getDownloadURL(riferimento);
}

// Foto del veicolo, cartella `veicoli/`: a differenza di un file del computer,
// la può mostrare anche il sito.
export async function caricaFotoVeicolo(file) {
  const errore = controllaFile(file);
  if (errore) throw new Error(errore);
  return caricaComeWebp(file, 'veicoli');
}

// Foto di un danno, cartella `danni/` (visibile solo allo staff).
export async function caricaFotoDanno(file) {
  const errore = controllaFile(file);
  if (errore) throw new Error(errore);
  return caricaComeWebp(file, 'danni');
}

// Una foto arrivata come dato incorporato (data:image/...;base64, es. dalla
// finestra "Concludi con danni") caricata nella cartella danni/: ne restituisce
// l'indirizzo. Se non e' incorporata la lascia com'e'.
export async function fotoIncorporataSuStorage(valore) {
  if (!eFotoIncorporata(valore)) return valore;
  const file = await (await fetch(valore)).blob();
  return caricaComeWebp(file, 'danni');
}

// Le foto dei danni salvate prima erano incorporate nel documento del veicolo
// (data:image/...;base64): le carica su Storage e mette l'indirizzo al loro
// posto. Se una foto non si riesce a caricare resta com'era, cosi' non si perde.
export async function spostaFotoDanniSuStorage(danni) {
  if (!Array.isArray(danni)) return danni;
  return Promise.all(danni.map(async (danno) => {
    if (!eFotoIncorporata(danno?.immagine)) return danno;
    try {
      const file = await (await fetch(danno.immagine)).blob();
      return { ...danno, immagine: await caricaComeWebp(file, 'danni') };
    } catch (error) {
      console.error('Foto del danno non spostata su Storage, resta incorporata:', error);
      return danno;
    }
  }));
}

// Recupero dalla versione precedente: foto letta dal vecchio computer,
// caricata con un nome FISSO (`nome`), cosi' se il recupero si ripete la foto
// viene sovrascritta invece di essere caricata una seconda volta.
export async function caricaFotoRecuperata(blob, cartella, nome) {
  return caricaComeWebp(blob, cartella, nome);
}

// Contratto PDF recuperato (cartella contratti/, solo staff), nome fisso.
export async function caricaPdfRecuperato(blob, nome) {
  const riferimento = ref(storage, `contratti/${nome}`);
  await uploadBytes(riferimento, blob, { contentType: 'application/pdf' });
  return getDownloadURL(riferimento);
}
