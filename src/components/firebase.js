// src/firebase.js
import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import {getStorage} from "firebase/storage";

// Solo in sviluppo nel browser: con REACT_APP_USA_EMULATORI=1 il gestionale
// parla con gli emulatori locali di Firebase (progetto finto demo-formiarent),
// per provare tutto senza toccare dati reali. Emulatori avviati da formiarent:
//   firebase emulators:start --only auth,firestore,functions --project demo-formiarent
const usaEmulatori = process.env.NODE_ENV === "development" && process.env.REACT_APP_USA_EMULATORI === "1";

const firebaseConfig = {
  apiKey: "AIzaSyCD1gt7XQ9kWDQM2xT4L5msRl2bcy0Ql3M",
  authDomain: "gestionaleauto-16d87.firebaseapp.com",
  projectId: "gestionaleauto-16d87",
  storageBucket: "gestionaleauto-16d87.firebasestorage.app",
  messagingSenderId: "330773017292",
  appId: "1:330773017292:web:dd01f41fe2a1b88a824869",
  measurementId: "G-G35R11WW67"
};

// Inizializza Firebase
const app = initializeApp(usaEmulatori ? { ...firebaseConfig, projectId: "demo-formiarent" } : firebaseConfig);

// Inizializza Firestore
const db = getFirestore(app);
const storage = getStorage(app);

// Autenticazione staff (vedi AuthGate.jsx)
const auth = getAuth(app);

// Cloud Functions del sito (rimborsi). Regione di functions/src/index.ts.
const functions = getFunctions(app, "europe-west1");

if (usaEmulatori) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  // Nel browser non c'e' Electron: licenza e funzioni del PC fanno finta di niente.
  if (!window.electronAPI) {
    window.electronAPI = new Proxy({ getLicenseStatus: async () => ({ status: "valid" }) }, {
      get: (obj, nome) => obj[nome] ?? (async () => null),
    });
  }
}

export { db, storage, auth, functions };
