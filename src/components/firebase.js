// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {getStorage} from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCD1gt7XQ9kWDQM2xT4L5msRl2bcy0Ql3M",
  authDomain: "gestionaleauto-16d87.firebaseapp.com",
  projectId: "gestionaleauto-16d87",
  storageBucket: "gestionaleauto-16d87.appspot.com",
  messagingSenderId: "330773017292",
  appId: "1:330773017292:web:dd01f41fe2a1b88a824869",
  measurementId: "G-G35R11WW67"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Inizializza Firestore
const db = getFirestore(app);
const storage = getStorage(app);

export { db,storage };
