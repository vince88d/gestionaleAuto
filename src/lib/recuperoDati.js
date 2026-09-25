import {
  collection, doc, getDocs, runTransaction, onSnapshot,
} from 'firebase/firestore';
import { db } from '../components/firebase';
import { caricaFotoRecuperata, caricaPdfRecuperato } from './storageFoto';
import { copiaAziendaDalComputer } from './firestoreAzienda';
import { senzaUndefined } from '../utils/senzaUndefined';
import { pianificaFile, applicaIndirizzi, idArchivioContratto, nomeStorageRecupero } from '../utils/recuperoDati';

// Cosa c'e' gia' su Firebase, per non sovrascriverlo: id e targhe dei
// veicoli, id di prenotazioni, clienti e documenti in archivio.
export async function leggiEsistentiPerRecupero() {
  const [veicoli, prenotazioni, clienti, archivio] = await Promise.all(
    ['veicoli', 'prenotazioni', 'clienti', 'archivioDocumenti'].map((nome) => getDocs(collection(db, nome))),
  );
  return {
    veicoli: veicoli.docs.map((d) => ({ id: d.id, targa: d.data().targa || '' })),
    prenotazioni: prenotazioni.docs.map((d) => d.id),
    clienti: clienti.docs.map((d) => d.id),
    archivio: archivio.docs.map((d) => d.id),
  };
}

// Dati che la versione precedente teneva nella memoria interna del programma
// invece che nei file (i dati dell'azienda). Leggibili solo sullo stesso
// computer. La vecchia password dell'email (in chiaro) viene tolta.
export function leggiMemoriaInterna() {
  try {
    const grezzo = window.localStorage.getItem('datiAzienda');
    if (!grezzo) return null;
    const { password: _password, ...datiAzienda } = JSON.parse(grezzo) || {};
    return { datiAzienda };
  } catch {
    return null;
  }
}

const TIPI_IMMAGINE = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };
const LIMITE_DOCUMENTO = 900 * 1024; // Firestore rifiuta documenti oltre 1 MB

async function leggiFileVecchio(cartella, sottocartella, nome) {
  const res = await window.electronAPI.recuperoLeggiFile({ cartella, sottocartella, nome });
  if (!res.success) throw new Error(res.error);
  return res.dati;
}

// Scrive un documento SOLO se non esiste gia' (transazione: se nel frattempo
// qualcuno l'ha creato, non lo tocca). true = scritto, false = gia' presente.
async function scriviSeNuovo(collezione, id, dati) {
  const pulito = senzaUndefined(dati);
  if (JSON.stringify(pulito).length > LIMITE_DOCUMENTO) throw new Error('troppo grande per Firebase (oltre 1 MB)');
  const rif = doc(db, collezione, id);
  return runTransaction(db, async (tx) => {
    if ((await tx.get(rif)).exists()) return false;
    tx.set(rif, pulito);
    return true;
  });
}

// Esegue `lavoro` su tutti gli elementi, pochi alla volta (Firebase regge
// bene 5 scritture in parallelo, e l'avanzamento resta leggibile).
async function aGruppi(elementi, lavoro, perVolta = 5) {
  for (let i = 0; i < elementi.length; i += perVolta) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(elementi.slice(i, i + perVolta).map(lavoro));
  }
}

// Recupero vero. `analisi.dati` viene da analizzaRecupero; `letti` da
// recuperoLeggi (per immagini, contratti e dati azienda). `onProgresso`
// riceve { fase, fatti, totale }. Non si ferma al primo errore: lo annota e
// continua, cosi' alla fine c'e' l'elenco completo di cosa rifare.
export async function eseguiRecupero({ cartella, analisi, letti, onProgresso = () => {} }) {
  const esistenti = await leggiEsistentiPerRecupero();
  const idVeicoli = new Set(esistenti.veicoli.map((v) => v.id));
  const idPrenotazioni = new Set(esistenti.prenotazioni);
  const idClienti = new Set(esistenti.clienti);
  const daScrivere = {
    veicoli: analisi.dati.veicoli.filter((v) => !idVeicoli.has(v.id)),
    clienti: analisi.dati.clienti.filter((c) => !idClienti.has(c.id)),
    prenotazioni: analisi.dati.prenotazioni.filter((p) => !idPrenotazioni.has(p.id)),
  };
  const fileDisponibili = { immagini: letti.immagini, contratti: letti.contratti };
  const esito = {
    veicoli: { scritti: 0, giaPresenti: analisi.dati.veicoli.length - daScrivere.veicoli.length, errori: [] },
    clienti: { scritti: 0, giaPresenti: analisi.dati.clienti.length - daScrivere.clienti.length, errori: [] },
    prenotazioni: { scritti: 0, giaPresenti: analisi.dati.prenotazioni.length - daScrivere.prenotazioni.length, errori: [] },
    file: { caricati: 0, errori: [] },
    archivio: { scritti: 0, giaPresenti: 0, errori: [] },
  };

  // 1. Foto e file citati nei dati da scrivere.
  const piano = pianificaFile(daScrivere, fileDisponibili);
  const indirizzi = new Map();
  let fatti = 0;
  onProgresso({ fase: 'Caricamento foto', fatti, totale: piano.length });
  await aGruppi(piano, async (voce) => {
    try {
      let url;
      if (voce.tipo === 'incorporata') {
        const blob = await (await fetch(voce.valore)).blob();
        url = await caricaFotoRecuperata(blob, voce.destinazione, voce.nomeStorage);
      } else {
        const dati = await leggiFileVecchio(cartella, voce.sottocartella, voce.nome);
        if (voce.destinazione === 'contratti') {
          url = await caricaPdfRecuperato(new Blob([dati], { type: 'application/pdf' }), voce.nomeStorage);
        } else {
          const estensione = voce.nome.split('.').pop().toLowerCase();
          url = await caricaFotoRecuperata(new Blob([dati], { type: TIPI_IMMAGINE[estensione] || 'image/jpeg' }), voce.destinazione, voce.nomeStorage);
        }
      }
      indirizzi.set(voce.valore, url);
      esito.file.caricati += 1;
    } catch (error) {
      esito.file.errori.push(`Foto/file ${voce.nome || 'incorporata'}: ${error.message}`);
    }
    fatti += 1;
    onProgresso({ fase: 'Caricamento foto', fatti, totale: piano.length });
  });

  // 2. Documenti: veicoli, clienti, prenotazioni (id fissi, mai sovrascritti).
  const recuperatoIl = new Date().toISOString();
  const collezioni = [
    ['veicoli', 'Veicoli', daScrivere.veicoli],
    ['clienti', 'Clienti', daScrivere.clienti],
    ['prenotazioni', 'Prenotazioni', daScrivere.prenotazioni],
  ];
  for (const [collezione, fase, elenco] of collezioni) {
    const contatore = { fatti: 0 };
    onProgresso({ fase, fatti: 0, totale: elenco.length });
    // eslint-disable-next-line no-await-in-loop
    await aGruppi(elenco, async (documento) => {
      const { id, ...dati } = applicaIndirizzi(documento, indirizzi, recuperatoIl);
      try {
        if (await scriviSeNuovo(collezione, id, dati)) esito[collezione].scritti += 1;
        else esito[collezione].giaPresenti += 1;
      } catch (error) {
        esito[collezione].errori.push(`${fase} ${documento.targa || documento.id}: ${error.message}`);
      }
      contatore.fatti += 1;
      onProgresso({ fase, fatti: contatore.fatti, totale: elenco.length });
    });
  }

  // 3. Contratti non collegati a nessun dato: archivio documenti (quelli
  // gia' in archivio non si ricaricano).
  const giaInArchivio = new Set((await getDocs(collection(db, 'archivioDocumenti'))).docs.map((d) => d.id));
  const tuttiContratti = analisi.dati.contrattiArchivio || [];
  const contratti = tuttiContratti.filter((c) => !giaInArchivio.has(idArchivioContratto(c.nome)));
  esito.archivio.giaPresenti = tuttiContratti.length - contratti.length;
  fatti = 0;
  onProgresso({ fase: 'Contratti in archivio', fatti, totale: contratti.length });
  await aGruppi(contratti, async (contratto) => {
    try {
      const dati = await leggiFileVecchio(cartella, contratto.cartella, contratto.nome);
      const url = await caricaPdfRecuperato(new Blob([dati], { type: 'application/pdf' }), nomeStorageRecupero(contratto.nome, 'pdf'));
      const numero = Number((contratto.nome.match(/(\d{12,13})/) || [])[1]);
      const scritto = await scriviSeNuovo('archivioDocumenti', idArchivioContratto(contratto.nome), {
        tipo: 'contratto',
        nome: contratto.nome,
        url,
        data: numero ? new Date(numero).toISOString() : (contratto.modificatoIl || ''),
        dimensione: contratto.dimensione || 0,
        recupero: { da: 'versione-precedente', il: recuperatoIl },
      });
      if (scritto) esito.archivio.scritti += 1;
      else esito.archivio.giaPresenti += 1;
    } catch (error) {
      esito.file.errori.push(`Contratto ${contratto.nome}: ${error.message}`);
    }
    fatti += 1;
    onProgresso({ fase: 'Contratti in archivio', fatti, totale: contratti.length });
  });

  // 4. Dati dell'azienda (solo se su Firebase non ci sono ancora).
  try {
    await copiaAziendaDalComputer(letti.azienda || {});
  } catch (error) {
    esito.file.errori.push(`Dati azienda: ${error.message}`);
  }

  return esito;
}

// Documenti recuperati (contratti non collegati), in tempo reale.
export function ascoltaArchivioDocumenti(onDati, onErrore) {
  return onSnapshot(
    collection(db, 'archivioDocumenti'),
    (snap) => onDati(snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))),
    onErrore,
  );
}
