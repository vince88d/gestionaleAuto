import React, { useState, useEffect } from 'react';
import './App.css';
import { HashRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Clients from './pages/Clients';
import Booking from './pages/Booking';
import ImpostazioniAzienda from './pages/ImpostazioniAzienda';
import ArchivioPrenotazione from './pages/ArchivioPrenotazioni';

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
      <Router>
        <AppContent />
      </Router>
    </>
  );
}

export default App;
