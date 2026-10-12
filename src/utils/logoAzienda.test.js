import { dimensioniLogo, quasiQuadrato, dimensioniDaDataUrl, MESSAGGI_ERRORE_LOGO, preparaLogo } from './logoAzienda';

// PNG 1x1 vero e un PNG con IHDR 320x90 (basta l'intestazione per leggere le misure).
const PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
function pngConMisure(l, a) {
  const byte = new Uint8Array(33);
  byte.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const v = new DataView(byte.buffer);
  v.setUint32(16, l); v.setUint32(20, a);
  return `data:image/png;base64,${Buffer.from(byte).toString('base64')}`;
}
// JPEG minimo: SOI, un segmento APP0 corto e SOF0 con altezza 90 e larghezza 320.
function jpegConMisure(l, a) {
  const byte = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, a >> 8, a & 255, l >> 8, l & 255, 0x01, 0x01, 0x11, 0x00]);
  return `data:image/jpeg;base64,${Buffer.from(byte).toString('base64')}`;
}

test('misure ridotte senza ingrandire', () => {
  expect(dimensioniLogo(1600, 400)).toEqual({ larghezza: 400, altezza: 100 });
  expect(dimensioniLogo(200, 100)).toEqual({ larghezza: 200, altezza: 100 });
  expect(dimensioniLogo(300, 900)).toEqual({ larghezza: 133, altezza: 400 });
  expect(dimensioniLogo(0, 10)).toEqual({ larghezza: 0, altezza: 0 });
});

test('quasi quadrato: fino a 1,4 : 1', () => {
  expect(quasiQuadrato(100, 100)).toBe(true);
  expect(quasiQuadrato(140, 100)).toBe(true);
  expect(quasiQuadrato(141, 100)).toBe(false);
  expect(quasiQuadrato(100, 141)).toBe(false);
  expect(quasiQuadrato(320, 90)).toBe(false);
  expect(quasiQuadrato(0, 0)).toBe(false);
});

test('misure lette dal testo del PNG e del JPEG', () => {
  expect(dimensioniDaDataUrl(PNG_1X1)).toEqual({ larghezza: 1, altezza: 1 });
  expect(dimensioniDaDataUrl(pngConMisure(320, 90))).toEqual({ larghezza: 320, altezza: 90 });
  expect(dimensioniDaDataUrl(jpegConMisure(320, 90))).toEqual({ larghezza: 320, altezza: 90 });
  expect(dimensioniDaDataUrl('data:image/gif;base64,R0lGOD')).toBeNull();
  expect(dimensioniDaDataUrl('')).toBeNull();
  expect(dimensioniDaDataUrl(null)).toBeNull();
});

test('preparaLogo rifiuta i tipi sbagliati e i file enormi', async () => {
  await expect(preparaLogo({ type: 'application/pdf', size: 10 })).rejects.toThrow('tipo-non-valido');
  await expect(preparaLogo({ type: 'image/png', size: 6 * 1024 * 1024 })).rejects.toThrow('file-troppo-grande');
  await expect(preparaLogo(null)).rejects.toThrow('tipo-non-valido');
  expect(Object.keys(MESSAGGI_ERRORE_LOGO)).toEqual(['tipo-non-valido', 'file-troppo-grande', 'immagine-non-leggibile', 'logo-troppo-pesante']);
});
