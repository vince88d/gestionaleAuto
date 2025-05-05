import React, { useState } from 'react';
import './App.css';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Clients from './pages/Clients';
import Booking from './pages/Booking';
import ImpostazioniAzienda from './pages/ImpostazioniAzienda';
import ArchivioPrenotazione from './pages/ArchivioPrenotazioni';
function

App() {
  const [collapsed, setCollapsed] = useState(false);

  const toggleSidebar = () => {
    setCollapsed(prev => !prev);
  };

  return (
    <>
    <ToastContainer/>
    <Router>
      <div className={`app-container ${collapsed ? 'collapsed' : ''}`}>
        <Sidebar collapsed={collapsed} toggleSidebar={toggleSidebar} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/impostazioni-azienda" element={<ImpostazioniAzienda />} />
            <Route path="/archivio-prenotazione" element={<ArchivioPrenotazione />} />
          </Routes>
        </main>
      </div>
    </Router> 
    </>
  );   
}

export default App;
