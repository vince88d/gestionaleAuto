import React from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
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
          <li><Link to="/archivio-prenotazione">📜{collapsed ? '' : 'archivio'}</Link></li>
          <li><Link to="/impostazioni-azienda">⚙️ {collapsed ? '' : 'Impostazioni '}</Link></li>
      </ul>
     </nav>
      <div className="user-section">
        {!collapsed && <span className="user-email">{auth.currentUser?.email}</span>}
        <button className="logout-btn" onClick={() => signOut(auth)} title="Esci">
          🚪 {collapsed ? '' : 'Esci'}
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
