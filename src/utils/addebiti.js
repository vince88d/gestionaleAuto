// Prezzi fissi degli addebiti al rientro (scheda «Addebiti al rientro» di
// Tariffe e optional). Al rientro vengono proposti gia' compilati e si possono
// sempre cambiare caso per caso. Il ritardo non e' qui: e' automatico (giorni
// in piu' x prezzo al giorno della prenotazione).
// Documento impostazioni/addebiti. Funzioni pure, testate.
// Mockup approvato: formiarent-documenti/mockup/gestionale-rientro.html
import { leggiEuro } from './protezioni';

export const ADDEBITI = [
  { chiave: 'rifornimentoQuarto', nome: 'Rifornimento', aiuto: 'Per ogni quarto di serbatoio mancante rispetto alla consegna', unita: '€ / quarto' },
  { chiave: 'pulizia', nome: 'Pulizia straordinaria', aiuto: 'Auto molto sporca, peli di animali, odore di fumo', unita: '€' },
  { chiave: 'chiave', nome: 'Chiave non restituita', aiuto: 'Per ogni chiave in meno rispetto a quelle consegnate', unita: '€' },
  { chiave: 'oggettoMancante', nome: 'Oggetto della dotazione mancante', aiuto: 'Triangolo, giubbotto, cavo… (si cambia caso per caso)', unita: '€' },
];

// Prezzi di partenza (proposti dal mockup approvato).
export const ADDEBITI_DI_PARTENZA = { rifornimentoQuarto: 20, pulizia: 30, chiave: 150, oggettoMancante: 15 };

const importo = (v, base) => {
  const n = leggiEuro(v);
  return n === null || Number.isNaN(n) || n < 0 ? base : Math.round(n * 100) / 100;
};

// Da Firestore (o dal form) a numeri: il valore mancante o sbagliato torna a
// quello di partenza.
export function normalizzaAddebiti(dati = {}) {
  return Object.fromEntries(ADDEBITI.map(({ chiave }) => [chiave, importo(dati?.[chiave], ADDEBITI_DI_PARTENZA[chiave])]));
}

// Errori per campo ({} se si puo' salvare).
export function validaAddebiti(form = {}) {
  const errori = {};
  ADDEBITI.forEach(({ chiave }) => {
    const n = leggiEuro(form[chiave]);
    if (n === null) errori[chiave] = 'Scrivi l\'importo (anche 0).';
    else if (Number.isNaN(n) || n < 0) errori[chiave] = 'Scrivi un importo, es. 20';
  });
  return errori;
}

// Testo per le caselle del form (all'italiana).
export function addebitiPerForm(dati) {
  const n = normalizzaAddebiti(dati);
  return Object.fromEntries(ADDEBITI.map(({ chiave }) => [chiave, n[chiave].toLocaleString('it-IT', { maximumFractionDigits: 2 })]));
}
