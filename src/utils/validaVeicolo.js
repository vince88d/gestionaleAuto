// Regole del form "Aggiungi / Modifica veicolo".
// Le prenotazioni sono legate al veicolo SOLO tramite la targa: per questo la
// targa e' obbligatoria, scritta sempre allo stesso modo e unica in flotta.

// "ab 123-cd" -> "AB123CD": lettere e numeri, maiuscolo.
export function normalizzaTarga(targa) {
  return (targa || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const numeroOVuoto = (valore) => {
  if (valore === '' || valore === null || valore === undefined) return '';
  const numero = Number(valore);
  return Number.isFinite(numero) ? numero : NaN;
};

// Errori per campo ({ targa: 'messaggio', ... }); oggetto vuoto se va tutto bene.
// `idCorrente` e' il veicolo che si sta modificando (la sua targa non conta
// come doppione).
export function validaVeicolo(dati, flotta = [], idCorrente = null, annoCorrente = new Date().getFullYear()) {
  const errori = {};
  const obbligatori = { marca: 'la marca', modello: 'il modello', targa: 'la targa', categoria: 'la categoria' };
  Object.entries(obbligatori).forEach(([campo, nome]) => {
    if (!(dati?.[campo] || '').toString().trim()) errori[campo] = `Inserisci ${nome}.`;
  });

  const targa = normalizzaTarga(dati?.targa);
  if (targa && targa.length < 5) errori.targa = 'Targa troppo corta.';
  if (targa && !errori.targa) {
    const doppione = flotta.find((v) => v.id !== idCorrente && normalizzaTarga(v.targa) === targa);
    if (doppione) {
      const nome = [doppione.marca, doppione.modello].filter(Boolean).join(' ') || 'un altro veicolo';
      errori.targa = `Questa targa è già di ${nome}.`;
    }
  }

  const anno = numeroOVuoto(dati?.anno);
  if (anno !== '' && !(Number.isInteger(anno) && anno >= 1950 && anno <= annoCorrente + 1)) {
    errori.anno = `Anno tra 1950 e ${annoCorrente + 1}.`;
  }
  const km = numeroOVuoto(dati?.km);
  if (km !== '' && !(km >= 0)) errori.km = 'I km non possono essere negativi.';
  const porte = numeroOVuoto(dati?.porte);
  if (porte !== '' && !(Number.isInteger(porte) && porte >= 1 && porte <= 9)) errori.porte = 'Porte tra 1 e 9.';

  return errori;
}

// Dati pronti da salvare: targa uniformata, testi senza spazi ai lati, anno /
// km / porte come numeri (prima finivano su Firestore come testo).
export function preparaVeicolo(dati) {
  const pronto = { ...dati, targa: normalizzaTarga(dati.targa) };
  ['marca', 'modello', 'colore', 'note'].forEach((campo) => {
    if (typeof pronto[campo] === 'string') pronto[campo] = pronto[campo].trim();
  });
  ['anno', 'km', 'porte'].forEach((campo) => {
    const valore = numeroOVuoto(pronto[campo]);
    pronto[campo] = Number.isNaN(valore) ? '' : valore;
  });
  return pronto;
}
