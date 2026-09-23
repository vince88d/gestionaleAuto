import { db } from '../components/firebase';
import {
  doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, writeBatch, onSnapshot,
} from 'firebase/firestore';
import { normalizzaElencoCategorie } from '../utils/categorie';

// Elenco delle categorie gestibili dal gestionale, letto anche dal form del
// veicolo. Documento: impostazioni/categorie → { elenco: ["City Car", "SUV"] }
const CATEGORIE_DOC = ['impostazioni', 'categorie'];

// Lista tenuta come seed finché nessuno ha ancora salvato un elenco proprio:
// evita che al primo avvio la pagina Categorie (o il select del veicolo)
// appaia vuota.
const CATEGORIE_SEED = [
  'City Car', 'Utilitaria', 'Berlina', 'SUV', 'Furgone', 'Minivan', 'Lusso',
  'Sportiva', 'Cabrio', 'Elettrica', 'Ibrida', 'Motociclo', 'Quad', 'Pick-up',
  'Camper', 'Imbarcazione', 'Acquascooter',
];

// Se il documento non esiste ancora, ripiega sul seed unito alle categorie già
// presenti sui veicoli (per non far sparire nulla prima del primo salvataggio).
export async function readCategorie(veicoli = []) {
  const snapshot = await getDoc(doc(db, ...CATEGORIE_DOC));
  const elenco = snapshot.data()?.elenco;
  if (Array.isArray(elenco)) return normalizzaElencoCategorie(elenco);
  const usate = veicoli.map((v) => v.categoria).filter(Boolean);
  return normalizzaElencoCategorie([...CATEGORIE_SEED, ...usate]);
}

// Elenco delle categorie in tempo reale (senza i veicoli: chi la usa unisce da
// sé le categorie eventualmente presenti solo sui veicoli, come fa Tariffe).
export function ascoltaCategorie(onDati, onErrore) {
  return onSnapshot(
    doc(db, ...CATEGORIE_DOC),
    (snapshot) => {
      const elenco = snapshot.data()?.elenco;
      onDati(normalizzaElencoCategorie(Array.isArray(elenco) ? elenco : CATEGORIE_SEED));
    },
    onErrore,
  );
}

export async function writeCategorie(elenco) {
  await setDoc(doc(db, ...CATEGORIE_DOC), {
    elenco: normalizzaElencoCategorie(elenco),
    aggiornatoIl: serverTimestamp(),
  });
  return true;
}

// Rinomina una categoria ovunque compaia: elenco categorie, veicoli,
// prenotazioni (tutte, anche quelle già assegnate: la disponibilità legge per
// prima cosa il loro campo `categoria`) e l'eventuale tariffa. Un unico batch,
// o va tutto a buon fine o niente (evita di lasciare nomi diversi in giro).
// Nota: gli `holds` temporanei non sono inclusi perché non scrivibili dal
// client (solo le Cloud Functions), rischio trascurabile: scadono da soli
// entro 30 minuti.
export async function rinominaCategoriaOvunque(vecchia, nuova, elencoAggiornato) {
  const batch = writeBatch(db);
  batch.set(doc(db, ...CATEGORIE_DOC), {
    elenco: normalizzaElencoCategorie(elencoAggiornato),
    aggiornatoIl: serverTimestamp(),
  });

  const [veicoliSnap, prenotazioniSnap, tariffeSnap] = await Promise.all([
    getDocs(query(collection(db, 'veicoli'), where('categoria', '==', vecchia))),
    getDocs(query(collection(db, 'prenotazioni'), where('categoria', '==', vecchia))),
    getDoc(doc(db, 'impostazioni', 'tariffe')),
  ]);

  veicoliSnap.forEach((d) => batch.update(d.ref, { categoria: nuova }));
  prenotazioniSnap.forEach((d) => batch.update(d.ref, { categoria: nuova }));

  const prezziGiorno = tariffeSnap.data()?.prezziGiorno;
  if (prezziGiorno && Object.prototype.hasOwnProperty.call(prezziGiorno, vecchia)) {
    const aggiornate = { ...prezziGiorno };
    aggiornate[nuova] = aggiornate[vecchia];
    delete aggiornate[vecchia];
    batch.set(doc(db, 'impostazioni', 'tariffe'), { prezziGiorno: aggiornate, aggiornatoIl: serverTimestamp() });
  }

  await batch.commit();
  return true;
}

// Toglie l'eventuale tariffa di una categoria appena eliminata dall'elenco.
export async function rimuoviTariffaCategoria(categoria) {
  const snapshot = await getDoc(doc(db, 'impostazioni', 'tariffe'));
  const prezziGiorno = snapshot.data()?.prezziGiorno;
  if (!prezziGiorno || !Object.prototype.hasOwnProperty.call(prezziGiorno, categoria)) return false;
  const aggiornate = { ...prezziGiorno };
  delete aggiornate[categoria];
  await setDoc(doc(db, 'impostazioni', 'tariffe'), { prezziGiorno: aggiornate, aggiornatoIl: serverTimestamp() });
  return true;
}
