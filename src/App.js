import React, { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import { HashRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import AuthGate from './components/AuthGate';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Clients from './pages/Clients';
import Booking from './pages/Booking';
import ImpostazioniAzienda from './pages/ImpostazioniAzienda';
import RecuperoDati from './pages/RecuperoDati';
import TariffeEOptional from './pages/TariffeEOptional';
import Categorie from './pages/Categorie';
import ArchivioPrenotazione from './pages/ArchivioPrenotazioni';
import Cestino from './pages/Cestino';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { ascoltaPrenotazioni } from './lib/firestorePrenotazioni';
import { setPrenotazioni } from './store/prenotazioniSlice';
import { ascoltaClienti } from './lib/firestoreClienti';
import { setClienti } from './store/clientiSlice';
import { giornoLocale } from './utils/scadenze';
import { avvisoNuoveRichieste, richiesteDaGestire, richiesteNuove, titoloConRichieste } from './utils/richiesteSito';

function AppContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkLicense = async () => {
      const res = await window.electronAPI.getLicenseStatus();
      setLicenseStatus(res.status);

      if (res.status === 'trial-expired' || res.status === 'invalid-license' || res.status === 'date-modified') {
        navigate('/impostazioni-azienda'); // 👈 reindirizza forzatamente
      }
    };
    checkLicense();
  }, [navigate]);

  // Prenotazioni sempre aggiornate in tutte le pagine: arrivano da sole
  // quando cambiano (sito, altre postazioni), invece di rileggerle solo
  // all'apertura di ogni pagina.
  const dispatch = useDispatch();
  const [prenotazioniCaricate, setPrenotazioniCaricate] = useState(false);
  useEffect(() => ascoltaPrenotazioni(
    (dati) => { dispatch(setPrenotazioni(dati)); setPrenotazioniCaricate(true); },
    (error) => {
      console.error('Errore aggiornamento prenotazioni:', error);
      toast.error('Non riesco ad aggiornare le prenotazioni: controlla la connessione.');
    },
  ), [dispatch]);

  // Anche i clienti in tempo reale (nuovi clienti o modifiche da un'altra
  // postazione, contratti e danni registrati alla consegna/riconsegna).
  useEffect(() => ascoltaClienti(
    (dati) => dispatch(setClienti(dati)),
    (error) => console.error('Errore aggiornamento clienti:', error),
  ), [dispatch]);

  // Richieste dal sito che aspettano una risposta: numero nel menu e nel titolo
  // della scheda, e un avviso quando ne arriva una nuova (da qualunque pagina).
  const prenotazioni = useSelector((state) => state.prenotazioni);
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAdesso(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const richieste = useMemo(
    () => richiesteDaGestire(prenotazioni, adesso, giornoLocale()),
    [prenotazioni, adesso],
  );
  const titoloBase = useRef(document.title);
  useEffect(() => { document.title = titoloConRichieste(titoloBase.current, richieste.length); }, [richieste.length]);
  const richiesteViste = useRef(null);
  useEffect(() => {
    if (!prenotazioniCaricate) return;
    // La prima volta si memorizza quello che c'e' gia': l'avviso e' solo per le nuove.
    if (richiesteViste.current === null) {
      richiesteViste.current = new Set(richieste.map((r) => r.prenotazione.id));
      return;
    }
    const nuove = richiesteNuove(richieste, richiesteViste.current);
    nuove.forEach((r) => richiesteViste.current.add(r.prenotazione.id));
    const avviso = avvisoNuoveRichieste(nuove);
    if (!avviso) return;
    toast.info(
      <div>
        <b>{avviso.titolo}</b>
        <div>{avviso.dettaglio}</div>
        <button type="button" className="avviso-richieste-link" onClick={() => navigate('/booking')}>Vai alle richieste</button>
      </div>,
      { autoClose: 10000, toastId: `richieste-${nuove.map((r) => r.prenotazione.id).join('-')}` },
    );
  }, [richieste, prenotazioniCaricate, navigate]);

  const toggleSidebar = () => setCollapsed(prev => !prev);

  return (
    <div className={`app-container ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} toggleSidebar={toggleSidebar} richiesteDaConfermare={richieste.length} />
      <main className="main-content">
        {licenseStatus === 'trial-expired' && (
          <div style={{ background: 'red', color: 'white', padding: '1rem' }}>
            Trial scaduta – inserisci una licenza in Impostazioni
          </div>
        )}
        {licenseStatus === 'invalid-license' && (
          <div style={{ background: 'orange', color: 'white', padding: '1rem' }}>
            Licenza non valida – aggiorna il codice in Impostazioni
          </div>
        )}

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/tariffe" element={<TariffeEOptional />} />
          <Route path="/categorie" element={<Categorie />} />
          <Route path="/impostazioni-azienda" element={<ImpostazioniAzienda />} />
          <Route path="/recupero-dati" element={<RecuperoDati />} />
          <Route path="/archivio-prenotazione" element={<ArchivioPrenotazione />} />
          <Route path="/cestino" element={<Cestino />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <>
      <ToastContainer />
      <AuthGate>
        <Router>
          <AppContent />
        </Router>
      </AuthGate>
    </>
  );
}

export default App;
