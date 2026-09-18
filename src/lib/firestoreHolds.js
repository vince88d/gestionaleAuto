import { db } from '../components/firebase';
import { collection, getDocs } from 'firebase/firestore';

const HOLDS_COLLECTION = 'holds';

// Gli hold sono creati/eliminati solo dalle Cloud Function del sito (le
// Firestore rules vietano ai client di scriverli): qui li leggiamo soltanto,
// per sapere quante unità di ogni categoria sono momentaneamente bloccate da
// un cliente che sta pagando online.
export async function readHolds() {
  const snapshot = await getDocs(collection(db, HOLDS_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
