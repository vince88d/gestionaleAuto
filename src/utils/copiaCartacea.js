// Copia cartacea dei documenti alla consegna (impostazioni/copiaCartacea).
// Se chi comanda l'attiva (con presa visione), alla consegna si puo' spuntare
// «Ho preso copia cartacea dei documenti»: non bloccano piu' codice fiscale,
// documento d'identita' e data/luogo di nascita. La patente resta obbligatoria.

export const TESTO_PRESA_VISIONE = 'Con questa opzione, alla consegna si può andare avanti senza codice fiscale, '
  + 'documento d\'identità e data di nascita se si prende una copia cartacea dei documenti del cliente. '
  + 'La patente resta sempre obbligatoria. Il gestionale non verifica se la copia cartacea basti per legge o '
  + 'per la tua assicurazione, né se la conservazione rispetti le norme sulla privacy: la responsabilità è tua. '
  + 'Conserva le copie con cura e secondo le regole sulla protezione dei dati.';

// Scritta nel PDF del verbale quando alla consegna si e' presa la copia cartacea.
export const FRASE_VERBALE = 'Copie dei documenti conservate in formato cartaceo';

export const COPIA_CARTACEA_SPENTA = { attiva: false, presaVisioneDa: '', presaVisioneIl: '' };

// Dati del documento salvato -> forma sicura. Attiva solo se c'e' la presa
// visione registrata (chi e quando).
export function normalizzaCopiaCartacea(dati) {
  const d = dati && typeof dati === 'object' ? dati : {};
  const presaVisioneDa = typeof d.presaVisioneDa === 'string' ? d.presaVisioneDa : '';
  const presaVisioneIl = typeof d.presaVisioneIl === 'string' ? d.presaVisioneIl : '';
  return {
    attiva: d.attiva === true && Boolean(presaVisioneIl),
    presaVisioneDa,
    presaVisioneIl,
  };
}
