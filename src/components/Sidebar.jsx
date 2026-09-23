import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { auth } from './firebase';
import './Sidebar.css';

// Nome del prodotto, mostrato in piccolo sotto il nome dell'azienda cliente.
// Il gestionale e' pensato per piu' aziende (SaaS): in testa c'e' sempre
// l'azienda che lo usa, presa da Impostazioni.
export const NOME_PRODOTTO = 'Gestionale Noleggio';

// Evento lanciato da Impostazioni dopo il salvataggio, per aggiornare subito
// il nome in sidebar senza ricaricare l'app.
export const EVENTO_AZIENDA_AGGIORNATA = 'azienda-aggiornata';

function iniziali(nome) {
  const parole = nome.trim().split(/\s+/).filter(Boolean);
  if (parole.length === 0) return '?';
  if (parole.length === 1) return parole[0].slice(0, 2).toUpperCase();
  return (parole[0][0] + parole[1][0]).toUpperCase();
}

function Sidebar({ collapsed, toggleSidebar }) {
  const [nomeAzienda, setNomeAzienda] = useState('');

  useEffect(() => {
    const carica = async () => {
      try {
        const settings = await window.electronAPI?.getCompanySettings();
        setNomeAzienda(settings?.nome?.trim() || '');
      } catch (err) {
        console.error('Errore lettura nome azienda:', err);
      }
    };
    carica();
    window.addEventListener(EVENTO_AZIENDA_AGGIORNATA, carica);
    return () => window.removeEventListener(EVENTO_AZIENDA_AGGIORNATA, carica);
  }, []);

  const titolo = nomeAzienda || 'La tua azienda';
  const IconaToggle = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="top-section">
        <div className="brand" title={titolo}>
          <span className="brand-badge" aria-hidden="true">{iniziali(titolo)}</span>
          {!collapsed && (
            <span className="brand-testi">
              <span className="brand-nome">{titolo}</span>
              <span className="brand-prodotto">{NOME_PRODOTTO}</span>
            </span>
          )}
        </div>
        <button
          type="button"
          className="toggle-btn"
          onClick={toggleSidebar}
          title={collapsed ? 'Espandi menu' : 'Riduci menu'}
          aria-label={collapsed ? 'Espandi menu' : 'Riduci menu'}
        >
          <IconaToggle size={18} />
        </button>
      </div>
      <nav>
        <ul>
          <li><Link to="/">🏠 {collapsed ? '' : 'Dashboard'}</Link></li>
          <li><Link to="/vehicles">🚘 {collapsed ? '' : 'Veicoli'}</Link></li>
          <li><Link to="/clients">👤 {collapsed ? '' : 'Clienti'}</Link></li>
          <li><Link to="/booking">📅 {collapsed ? '' : 'Prenotazioni'}</Link></li>
          <li><Link to="/tariffe">💶 {collapsed ? '' : 'Tariffe'}</Link></li>
          <li><Link to="/categorie">🏷️ {collapsed ? '' : 'Categorie'}</Link></li>
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
