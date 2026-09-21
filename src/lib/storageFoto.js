import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../components/firebase';
import { controllaFile, dimensioniRidotte, nomeFileVeicolo } from '../utils/immagineVeicolo';

// Ridimensiona la foto (lato massimo 1600 px), la converte in WebP (mantiene la
// trasparenza dei PNG ritagliati) e la carica su Firebase Storage, cartella
// `veicoli/`. Restituisce l'indirizzo web da salvare in `immagine` del veicolo:
// a differenza di un file del computer, lo può mostrare anche il sito.
export async function caricaFotoVeicolo(file) {
  const errore = controllaFile(file);
  if (errore) throw new Error(errore);

  const immagine = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { larghezza, altezza } = dimensioniRidotte(immagine.width, immagine.height);
  const canvas = document.createElement('canvas');
  canvas.width = larghezza;
  canvas.height = altezza;
  canvas.getContext('2d').drawImage(immagine, 0, 0, larghezza, altezza);
  immagine.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) throw new Error('Non riesco a preparare la foto. Prova con un altro file.');

  const riferimento = ref(storage, `veicoli/${nomeFileVeicolo()}`);
  await uploadBytes(riferimento, blob, {
    contentType: 'image/webp',
    cacheControl: 'public,max-age=31536000,immutable',
  });
  return getDownloadURL(riferimento);
}
