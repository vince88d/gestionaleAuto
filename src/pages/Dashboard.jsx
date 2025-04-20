import React from 'react';
import './Dashboard.css';

function Dashboard() {
  const stats = [
    {
      title: 'Veicoli Disponibili',
      value: 12,
      icon: '🚘',
      colorClass: 'blue'
    },
    {
      title: 'Clienti Registrati',
      value: 45,
      icon: '👥',
      colorClass: 'green'
    },
    {
      title: 'Prenotazioni Attive',
      value: 8,
      icon: '📅',
      colorClass: 'yellow'
    },
    {
      title: 'Incasso Mese',
      value: '€3.250',
      icon: '💰',
      colorClass: 'purple'
    }
  ];

  return (
    <div className="dashboard-page">
      <h1>Dashboard Noleggio Auto</h1>
      <div className="grid">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`card ${stat.colorClass}`}
          >
            <div>
              <div className="title">{stat.title}</div>
              <div className="value">{stat.value}</div>
            </div>
            <div className="icon">{stat.icon}</div>
          </div>
        ))}
      </div>

      <div className="graph">
        <div className="graph-card">
          <h3>Grafico Prenotazioni</h3>
          <p>Qui andrebbe un grafico delle prenotazioni nel tempo</p>
        </div>
        <div className="graph-card">
          <h3>Grafico Incasso</h3>
          <p>Qui andrebbe un grafico degli incassi</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
