// Firma del cliente sul verbale di consegna e di rientro: normalmente si firma
// sul foglio stampato; se il cliente rifiuta o non c'e' lo staff lo registra e
// il PDF lo scrive al posto della firma. Le osservazioni sono quello che il
// cliente vuole far mettere a verbale (anche «firmo con riserva»).
// Funzioni pure, testate. Salvata in `schedaVeicolo.firma` (consegna) e in
// `rientro.firma` (rientro): { stato, osservazioni, registrataIl }.
import { formattaData } from './scadenze';

export const STATI_FIRMA = [
  { id: 'foglio', etichetta: 'Firma sul foglio stampato' },
  { id: 'rifiuta', etichetta: 'Il cliente rifiuta di firmare' },
  { id: 'assente', etichetta: 'Il cliente non è presente' },
];

export const FIRMA_NORMALE = Object.freeze({ stato: 'foglio', osservazioni: '' });

// Da salvare sulla prenotazione, o null se non c'e' niente da registrare
// (firma normale e nessuna osservazione): nessun campo vuoto in piu'.
export function normalizzaFirma(firma, adesso = new Date()) {
  const stato = STATI_FIRMA.some((s) => s.id === firma?.stato) ? firma.stato : 'foglio';
  const osservazioni = String(firma?.osservazioni || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (stato === 'foglio' && !osservazioni) return null;
  return { stato, osservazioni, registrataIl: adesso.toISOString() };
}

export const nonFirmato = (firma) => firma?.stato === 'rifiuta' || firma?.stato === 'assente';

// Testo scritto nel PDF al posto della firma, o '' se si firma sul foglio.
export function testoFirmaMancante(firma) {
  if (!nonFirmato(firma)) return '';
  const motivo = firma.stato === 'rifiuta' ? 'il cliente ha rifiutato di firmare' : 'il cliente non era presente';
  const quando = firma.registrataIl ? new Date(firma.registrataIl) : null;
  const registrato = quando && !Number.isNaN(quando.getTime())
    ? ` Registrato il ${formattaData(quando)} alle ${quando.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.`
    : '';
  return `Firma non apposta: ${motivo}.${registrato}`;
}
