import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  PanelLeftClose, PanelLeftOpen, LayoutDashboard, Car, Users, CalendarDays,
  Euro, Tags, Archive, Trash2, Settings, LogOut,
} from 'lucide-react';
import { auth } from './firebase';
import './Sidebar.css';

// Nome del prodotto, mostrato in piccolo sotto il nome dell'azienda cliente.
// Il gestionale e' pensato per piu' aziende (SaaS): in testa c'e' sempre
// l'azienda che lo usa, presa da Impostazioni.
export const NOME_PRODOTTO = 'Gestionale Noleggio';

// Evento lanciato da Impostazioni dopo il salvataggio, per aggiornare subito
// il nome in sidebar senza ricaricare l'app.
export const EVENTO_AZIENDA_AGGIORNATA = 'azienda-aggiornata';

// Voci del menu: icone lucide uniformi al posto delle emoji (che avevano
// dimensioni e colori diversi tra loro).
const VOCI_MENU = [
  { to: '/', etichetta: 'Dashboard', Icona: LayoutDashboard, end: true },
  { to: '/vehicles', etichetta: 'Veicoli', Icona: Car },
  { to: '/clients', etichetta: 'Clienti', Icona: Users },
  { to: '/booking', etichetta: 'Prenotazioni', Icona: CalendarDays },
  { to: '/tariffe', etichetta: 'Tariffe', Icona: Euro },
  { to: '/categorie', etichetta: 'Categorie', Icona: Tags },
  { to: '/archivio-prenotazione', etichetta: 'Archivio', Icona: Archive },
  { to: '/cestino', etichetta: 'Cestino', Icona: Trash2 },
  { to: '/impostazioni-azienda', etichetta: 'Impostazioni', Icona: Settings },
];

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
          {VOCI_MENU.map(({ to, etichetta, Icona, end }) => (
            <li key={to}>
              {/* NavLink aggiunge la classe "active" alla voce della pagina aperta */}
              <NavLink to={to} end={end} draggable={false} title={collapsed ? etichetta : undefined}>
                <Icona size={19} className="nav-icona" aria-hidden="true" />
                {!collapsed && <span>{etichetta}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="user-section">
        {!collapsed && <span className="user-email">{auth.currentUser?.email}</span>}
        <button className="logout-btn" onClick={() => signOut(auth)} title="Esci">
          <LogOut size={17} aria-hidden="true" />
          {!collapsed && <span>Esci</span>}
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
