import { auth, db } from '../components/firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { componiBackup } from '../utils/backup';

const COLLEZIONI = ['veicoli', 'prenotazioni', 'clienti'];
// Documenti letti uno per uno: le regole non permettono di elencare tutta la
// collezione impostazioni. Gli hold del sito non servono (durano 30 minuti).
const IMPOSTAZIONI = ['azienda', 'categorie', 'tariffe'];

// Legge tutti i dati veri da Firestore e li restituisce pronti da salvare.
// Le foto (veicoli, danni) restano su Storage: nel backup ci sono i loro link.
export async function leggiDatiPerBackup() {
  const [collezioniLette, impostazioniLette] = await Promise.all([
    Promise.all(COLLEZIONI.map(async (nome) => {
      const snap = await getDocs(collection(db, nome));
      return [nome, snap.docs.map((d) => ({ id: d.id, ...d.data() }))];
    })),
    Promise.all(IMPOSTAZIONI.map(async (nome) => {
      const snap = await getDoc(doc(db, 'impostazioni', nome));
      return [nome, snap.exists() ? snap.data() : null];
    })),
  ]);

  return componiBackup({
    collezioni: Object.fromEntries(collezioniLette),
    impostazioni: Object.fromEntries(impostazioniLette),
    creatoDa: auth.currentUser?.email || '',
  });
}
