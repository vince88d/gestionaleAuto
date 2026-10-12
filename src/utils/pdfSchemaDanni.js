// Schema dell'auto per il PDF: stesse sagome della finestra (utils/schemaDanni.js),
// con i danni numerati sopra. Si passa a `foglio.danni(voci, { schema })`.

import { rgb } from 'pdf-lib';
import { SAGOME, SCRITTE, SCHEMA_LARGHEZZA, SCHEMA_ALTEZZA } from './schemaDanni';

const LARGHEZZA = 230;
const SCALA = LARGHEZZA / SCHEMA_LARGHEZZA;
const colore = (r, g, b) => rgb(r / 255, g / 255, b / 255);
const RIEMPIMENTI = {
  bianco: colore(255, 255, 255), vetro: colore(223, 230, 238), nero: colore(26, 31, 38), cerchione: colore(154, 165, 177),
};
const CONTORNO = colore(26, 31, 38);

// null se nessun danno ha un punto sull'auto (solo testo scritto a mano).
export function schemaPdf(voci = []) {
  const punti = voci.filter((v) => v.vista);
  if (punti.length === 0) return null;
  const altezza = SCHEMA_ALTEZZA * SCALA + 8;
  return {
    larghezza: LARGHEZZA + 8,
    altezza,
    disegna({ page, x, alto, helper }) {
      const { riquadro, scrivi, scriviCentro, cerchio, C, font, grassetto } = helper;
      const x0 = x + 4;
      const y0 = alto - 4;
      riquadro(x, alto, LARGHEZZA + 8, altezza, { fondo: C.fondo, bordo: C.linea, raggio: 5 });
      Object.values(SAGOME).forEach(({ parti }) => parti.forEach(({ d, riempi, contorno }) => {
        page.drawSvgPath(d, {
          x: x0, y: y0, scale: SCALA,
          ...(riempi ? { color: RIEMPIMENTI[riempi] } : {}),
          ...(contorno ? { borderColor: CONTORNO, borderWidth: contorno } : {}),
        });
      }));
      SCRITTE.forEach(({ testo, x: tx, y: ty, centro, fine }) => {
        const px = x0 + tx * SCALA;
        const py = y0 - ty * SCALA;
        const f = font;
        if (centro) scriviCentro(testo, px, py, 5.5, f, C.grigio);
        else if (fine) scrivi(testo, px - f.widthOfTextAtSize(testo, 5.5), py, 5.5, f, C.grigio);
        else scrivi(testo, px, py, 5.5, f, C.grigio);
      });
      punti.forEach((v) => {
        const px = x0 + v.x * SCALA;
        const py = y0 - v.y * SCALA;
        cerchio(px, py, 6.5, C.bianco);
        cerchio(px, py, 5.5, v.nuovo ? C.rosso : C.grigio);
        scriviCentro(String(v.numero), px, py - 2.4, 7, grassetto, C.bianco);
      });
    },
  };
}
