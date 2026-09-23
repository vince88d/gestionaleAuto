import { controllaFile, dimensioniRidotte, eImmagineOnline, nomeFileVeicolo, eFotoIncorporata } from './immagineVeicolo';

const file = (type, size) => ({ type, size });

describe('controllaFile', () => {
  it('accetta JPG, PNG e WebP', () => {
    ['image/jpeg', 'image/png', 'image/webp'].forEach((tipo) => expect(controllaFile(file(tipo, 1000))).toBeNull());
  });
  it('rifiuta gli altri tipi', () => {
    expect(controllaFile(file('application/pdf', 1000))).toMatch(/JPG, PNG o WebP/);
    expect(controllaFile(file('image/gif', 1000))).not.toBeNull();
  });
  it('rifiuta i file troppo grandi', () => {
    expect(controllaFile(file('image/jpeg', 26 * 1024 * 1024))).toMatch(/troppo grande/);
  });
  it('nessun file', () => expect(controllaFile(undefined)).not.toBeNull());
});

describe('dimensioniRidotte', () => {
  it('rimpicciolisce mantenendo le proporzioni', () => {
    expect(dimensioniRidotte(4000, 3000)).toEqual({ larghezza: 1600, altezza: 1200 });
    expect(dimensioniRidotte(3000, 4000)).toEqual({ larghezza: 1200, altezza: 1600 });
  });
  it('non ingrandisce le foto già piccole', () => {
    expect(dimensioniRidotte(800, 600)).toEqual({ larghezza: 800, altezza: 600 });
    expect(dimensioniRidotte(1600, 900)).toEqual({ larghezza: 1600, altezza: 900 });
  });
  it('misure non valide', () => {
    expect(dimensioniRidotte(0, 0)).toEqual({ larghezza: 0, altezza: 0 });
  });
});

describe('nomeFileVeicolo', () => {
  it('è unico e finisce in .webp', () => {
    expect(nomeFileVeicolo(1700000000000, 0.5)).toMatch(/^1700000000000-[0-9a-z]+\.webp$/);
    expect(nomeFileVeicolo(1, 0.1)).not.toBe(nomeFileVeicolo(1, 0.2));
  });
});

describe('eImmagineOnline', () => {
  it('distingue gli indirizzi web dai percorsi locali', () => {
    expect(eImmagineOnline('https://firebasestorage.googleapis.com/v0/b/x/o/a.webp')).toBe(true);
    expect(eImmagineOnline('file:///Volumes/x/images/1.jpeg')).toBe(false);
    expect(eImmagineOnline('')).toBe(false);
    expect(eImmagineOnline(undefined)).toBe(false);
  });
});

describe('eFotoIncorporata', () => {
  test('riconosce le foto salvate dentro il dato (base64)', () => {
    expect(eFotoIncorporata('data:image/jpeg;base64,AAAA')).toBe(true);
    expect(eFotoIncorporata('data:image/png;base64,AAAA')).toBe(true);
  });
  test('non tocca indirizzi web, testo o valori mancanti', () => {
    expect(eFotoIncorporata('https://firebasestorage.googleapis.com/x.webp')).toBe(false);
    expect(eFotoIncorporata('base64...')).toBe(false);
    expect(eFotoIncorporata(undefined)).toBe(false);
  });
});
