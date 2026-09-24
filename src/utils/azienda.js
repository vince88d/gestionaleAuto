// Regole dei dati dell'azienda (funzioni pure, testate). I dati stanno su
// Firestore in impostazioni/azienda, uguali per tutte le postazioni.

export const CAMPI_AZIENDA = ['nome', 'partitaIva', 'email', 'pec', 'telefono', 'indirizzo'];

export const AZIENDA_VUOTA = Object.freeze(
  Object.fromEntries(CAMPI_AZIENDA.map((campo) => [campo, '']))
);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Solo i campi conosciuti, sempre stringhe senza spazi ai bordi. Partita IVA
// / codice fiscale senza spazi interni e in maiuscolo, email in minuscolo.
export function normalizzaAzienda(dati = {}) {
  const pulita = Object.fromEntries(
    CAMPI_AZIENDA.map((campo) => [campo, typeof dati[campo] === 'string' ? dati[campo].trim() : ''])
  );
  pulita.partitaIva = pulita.partitaIva.replace(/\s+/g, '').toUpperCase();
  pulita.email = pulita.email.toLowerCase();
  pulita.pec = pulita.pec.toLowerCase();
  return pulita;
}

// Errori per campo ({} se va tutto bene). Solo il nome e' obbligatorio: e'
// quello mostrato in sidebar e in Dashboard.
export function validaAzienda(dati) {
  const a = normalizzaAzienda(dati);
  const errori = {};
  if (!a.nome) errori.nome = "Inserisci il nome dell'azienda.";
  if (a.partitaIva && !/^\d{11}$/.test(a.partitaIva) && !/^[A-Z0-9]{16}$/.test(a.partitaIva)) {
    errori.partitaIva = 'La partita IVA ha 11 cifre, il codice fiscale 16 lettere e numeri.';
  }
  if (a.email && !EMAIL.test(a.email)) errori.email = 'Email non valida.';
  if (a.pec && !EMAIL.test(a.pec)) errori.pec = 'PEC non valida.';
  return errori;
}

// Campi con valore diverso tra i due gruppi di dati (normalizzati).
export function campiCambiati(a, b) {
  const na = normalizzaAzienda(a);
  const nb = normalizzaAzienda(b);
  return CAMPI_AZIENDA.filter((campo) => na[campo] !== nb[campo]);
}

// Vero se i due gruppi di dati sono uguali una volta normalizzati (per
// attivare "Salva" solo quando c'e' davvero qualcosa di cambiato).
export function aziendeUguali(a, b) {
  return campiCambiati(a, b).length === 0;
}

// Vero se non c'e' nessun dato (serve per decidere se copiare su Firestore
// i dati salvati sul computer dalla vecchia versione).
export function aziendaVuota(dati) {
  const a = normalizzaAzienda(dati);
  return CAMPI_AZIENDA.every((campo) => !a[campo]);
}
