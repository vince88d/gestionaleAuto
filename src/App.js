import React, { useState, useEffect } from 'react';
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
import Tariffe from './pages/Tariffe';
import Categorie from './pages/Categorie';
import ArchivioPrenotazione from './pages/ArchivioPrenotazioni';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { ascoltaPrenotazioni } from './lib/firestorePrenotazioni';
import { setPrenotazioni } from './store/prenotazioniSlice';
import { ascoltaClienti } from './lib/firestoreClienti';
import { setClienti } from './store/clientiSlice';

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
  useEffect(() => ascoltaPrenotazioni(
    (dati) => dispatch(setPrenotazioni(dati)),
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

  const toggleSidebar = () => setCollapsed(prev => !prev);

  return (
    <div className={`app-container ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} toggleSidebar={toggleSidebar} />
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
          <Route path="/tariffe" element={<Tariffe />} />
          <Route path="/categorie" element={<Categorie />} />
          <Route path="/impostazioni-azienda" element={<ImpostazioniAzienda />} />
          <Route path="/archivio-prenotazione" element={<ArchivioPrenotazione />} />
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
