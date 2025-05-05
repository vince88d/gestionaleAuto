import React from 'react';
import { Link } from 'react-router-dom';
import './Sidebar.css';

function Sidebar({ collapsed, toggleSidebar }) {
  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="top-section">
        <h2 className="logo">{collapsed ? '🚗' : 'Auto Noleggio'}</h2>
        <button className="toggle-btn" onClick={toggleSidebar}>
          {collapsed ? '☰' : '✖'}
        </button>
      </div>
      <nav>
        <ul>
          <li><Link to="/">🏠 {collapsed ? '' : 'Dashboard'}</Link></li>
          <li><Link to="/vehicles">🚘 {collapsed ? '' : 'Veicoli'}</Link></li>
          <li><Link to="/clients">👤 {collapsed ? '' : 'Clienti'}</Link></li>
          <li><Link to="/booking">📅 {collapsed ? '' : 'Prenotazioni'}</Link></li>
          <li><Link to="/impostazioni-azienda">⚙️ {collapsed ? '' : 'Impostazioni '}</Link></li>        
          <li><Link to="/archivio-prenotazione">📜{collapsed ? '' : 'archivio'}</Link></li>
      </ul> 
     </nav>
    </div>
  );
}

export default Sidebar;
