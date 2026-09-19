import React, { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// Chi è staff lo decide la collezione Firestore `staff`: un documento con id
// uguale all'UID dell'utente. Le stesse regole (firestore.rules del sito) la
// usano per aprire o chiudere l'accesso ai dati, quindi questo controllo serve
// solo a mostrare un messaggio chiaro invece di errori di permesso ovunque.
async function eStaff(uid) {
  try {
    const snap = await getDoc(doc(db, 'staff', uid));
    return snap.exists();
  } catch (err) {
    console.error('Errore verifica staff:', err);
    return false;
  }
}

function messaggioErrore(err) {
  switch (err?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Email o password non corretti.';
    case 'auth/too-many-requests':
      return 'Troppi tentativi. Riprova tra qualche minuto.';
    case 'auth/network-request-failed':
      return 'Nessuna connessione a internet. Riprova.';
    default:
      return 'Accesso non riuscito. Riprova.';
  }
}

const stili = {
  pagina: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f4f6f8', fontFamily: 'sans-serif',
  },
  scheda: {
    width: 340, background: 'white', padding: '2rem', borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  titolo: { margin: '0 0 1.5rem', textAlign: 'center', color: '#2c3e50' },
  campo: {
    display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.7rem',
    marginBottom: '1rem', border: '1px solid #ccd3da', borderRadius: 6, fontSize: '1rem',
  },
  bottone: {
    width: '100%', padding: '0.75rem', border: 'none', borderRadius: 6, cursor: 'pointer',
    background: '#2c3e50', color: 'white', fontSize: '1rem',
  },
  errore: { color: '#c0392b', margin: '0 0 1rem', fontSize: '0.9rem' },
};

function FormLogin({ messaggio }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState(messaggio || '');
  const [invio, setInvio] = useState(false);

  const accedi = async (e) => {
    e.preventDefault();
    setErrore('');
    setInvio(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setErrore(messaggioErrore(err));
      setInvio(false);
    }
  };

  return (
    <div style={stili.pagina}>
      <form style={stili.scheda} onSubmit={accedi}>
        <h2 style={stili.titolo}>Auto Noleggio — Accesso staff</h2>
        {errore && <p style={stili.errore}>{errore}</p>}
        <input
          style={stili.campo} type="email" placeholder="Email" autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
        />
        <input
          style={stili.campo} type="password" placeholder="Password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} required
        />
        <button style={stili.bottone} type="submit" disabled={invio}>
          {invio ? 'Accesso in corso…' : 'Accedi'}
        </button>
      </form>
    </div>
  );
}

// Mostra l'app solo a un utente autenticato e presente nell'elenco staff.
// Le pagine non vengono nemmeno montate prima, quindi nessuna lettura di
// Firestore parte senza login.
export default function AuthGate({ children }) {
  const [stato, setStato] = useState('caricamento'); // caricamento | fuori | non-autorizzato | staff
  // Il signOut di un utente non staff fa scattare il listener con utente nullo:
  // il flag evita che quel passaggio cancelli il messaggio "non autorizzato".
  const respinto = useRef(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (utente) => {
      if (!utente) {
        setStato(respinto.current ? 'non-autorizzato' : 'fuori');
        return;
      }
      respinto.current = false;
      setStato('caricamento');
      if (await eStaff(utente.uid)) {
        setStato('staff');
      } else {
        respinto.current = true;
        await signOut(auth);
      }
    });
  }, []);

  if (stato === 'caricamento') {
    return <div style={stili.pagina}>Caricamento…</div>;
  }
  if (stato === 'staff') return children;

  return (
    <FormLogin
      key={stato}
      messaggio={stato === 'non-autorizzato'
        ? 'Questo utente non è autorizzato ad accedere al gestionale.'
        : ''}
    />
  );
}
