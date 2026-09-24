import { useEffect, useState } from 'react';
import { db } from '../components/firebase';
import { doc, onSnapshot, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';
import { normalizzaAzienda, aziendaVuota, AZIENDA_VUOTA } from '../utils/azienda';

// Dati dell'azienda che usa il gestionale (nome in sidebar e Dashboard,
// contatti, partita IVA). Documento: impostazioni/azienda. Prima stavano in un
// file sul computer, quindi ogni postazione aveva i suoi.
const AZIENDA_DOC = ['impostazioni', 'azienda'];

// Dati in tempo reale. `esiste` serve a capire se va fatta la copia iniziale
// dai dati salvati sul computer dalla vecchia versione.
export function ascoltaAzienda(onDati, onErrore) {
  return onSnapshot(
    doc(db, ...AZIENDA_DOC),
    (snapshot) => onDati({ dati: normalizzaAzienda(snapshot.data()), esiste: snapshot.exists() }),
    onErrore,
  );
}

export async function salvaAzienda(dati) {
  await setDoc(doc(db, ...AZIENDA_DOC), { ...normalizzaAzienda(dati), aggiornatoIl: serverTimestamp() });
  return true;
}

// Copia una sola volta su Firestore i dati che la vecchia versione salvava sul
// computer. In transazione: se due postazioni la fanno insieme, o se qualcuno
// ha gia' salvato dei dati, vince quello che c'e' gia' e niente viene
// sovrascritto. Restituisce true se ha copiato.
export async function copiaAziendaDalComputer(datiLocali) {
  if (aziendaVuota(datiLocali)) return false;
  const rif = doc(db, ...AZIENDA_DOC);
  return runTransaction(db, async (tx) => {
    const attuale = await tx.get(rif);
    if (attuale.exists()) return false;
    tx.set(rif, { ...normalizzaAzienda(datiLocali), aggiornatoIl: serverTimestamp() });
    return true;
  });
}

// Dati dell'azienda in tempo reale per sidebar, Dashboard e Impostazioni:
// { dati, caricato, errore }. Se il documento non c'e' ancora, prova la copia
// dai dati del computer (una volta per avvio; la transazione evita doppioni).
let copiaTentata = false;

// Le versioni piu' vecchie salvavano i dati dell'azienda nella memoria interna
// del programma (localStorage 'datiAzienda', con anche la password dell'email:
// normalizzaAzienda la scarta).
function datiAziendaMemoriaInterna() {
  try {
    return JSON.parse(window.localStorage.getItem('datiAzienda')) || {};
  } catch {
    return {};
  }
}

export function useAzienda() {
  const [stato, setStato] = useState({ dati: AZIENDA_VUOTA, caricato: false, errore: null });

  useEffect(() => ascoltaAzienda(
    ({ dati, esiste }) => {
      setStato({ dati, caricato: true, errore: null });
      if (esiste || copiaTentata) return;
      copiaTentata = true;
      Promise.resolve(window.electronAPI?.getCompanySettings?.())
        .then((locali) => copiaAziendaDalComputer(aziendaVuota(locali) ? datiAziendaMemoriaInterna() : locali))
        .catch((err) => console.error('Errore copia dati azienda dal computer:', err));
    },
    (errore) => {
      console.error('Errore lettura dati azienda:', errore);
      setStato((prec) => ({ ...prec, caricato: true, errore }));
      // Ripiego sui dati del computer, cosi' almeno il nome resta visibile.
      Promise.resolve(window.electronAPI?.getCompanySettings?.())
        .then((locali) => setStato((prec) => ({ ...prec, dati: normalizzaAzienda(locali || {}) })))
        .catch(() => {});
    },
  ), []);

  return stato;
}
