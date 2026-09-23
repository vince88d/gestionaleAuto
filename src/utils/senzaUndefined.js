// Firestore rifiuta i campi undefined: li toglie (anche negli oggetti annidati).
export function senzaUndefined(valore) {
  if (Array.isArray(valore)) return valore.map(senzaUndefined);
  if (valore && typeof valore === 'object' && valore.constructor === Object) {
    return Object.fromEntries(
      Object.entries(valore).filter(([, v]) => v !== undefined).map(([k, v]) => [k, senzaUndefined(v)])
    );
  }
  return valore;
}
