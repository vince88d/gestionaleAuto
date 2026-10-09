import { useEffect, useState } from 'react';
import { ascoltaProtezioni } from './firestoreProtezioni';
import { ascoltaOptional } from './firestoreOptional';

// Protezioni per categoria e catalogo degli optional, in tempo reale: servono
// alla prenotazione per calcolare prezzo, cauzione e pezzi liberi.
// `pronti` diventa true quando sono arrivati entrambi.
export function useExtra() {
  const [protezioni, setProtezioni] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  useEffect(() => ascoltaProtezioni(setProtezioni, (e) => {
    console.error('Errore lettura protezioni:', e);
    setProtezioni({ perCategoria: {}, nonCopre: '', cauzioneTesto: '' });
  }), []);
  useEffect(() => ascoltaOptional(setCatalogo, (e) => {
    console.error('Errore lettura optional:', e);
    setCatalogo([]);
  }), []);
  return {
    protezioni: protezioni?.perCategoria || {},
    testiProtezioni: protezioni || { nonCopre: '', cauzioneTesto: '' },
    catalogo: catalogo || [],
    pronti: protezioni !== null && catalogo !== null,
  };
}
