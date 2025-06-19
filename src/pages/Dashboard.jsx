import React from 'react';
import './Dashboard.css';
import { useSelector } from 'react-redux';
import { useEffect,useState } from 'react';
import { setVeicoli } from '../store/veicoliSlice';
import { useDispatch } from 'react-redux';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { Car, Users, CalendarCheck, Euro,CalendarDays } from 'lucide-react';
import VehicleDetailModal from '../components/VehicleDetailModal';



function Dashboard() {
  
  const veicoli = useSelector((state) => state.veicoli);
  const [scadenzeProssime, setScadenzeProssime] = useState([]);
  const dispatch = useDispatch();

  const [clienti, setClienti] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [incassoTotaleMese, setIncassoTotaleMese] = useState(0);
  const [prenotazioniPerMese, setPrenotazioniPerMese] = useState([]);
  const [incassiPerMese, setIncassiPerMese] = useState([]); 
  const [dataInizioRicerca, setDataInizioRicerca] = useState('');
  const [dataFineRicerca, setDataFineRicerca] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedVeicolo, setSelectedVeicolo] = useState(null);
  const [danniDaRiparare, setDanniDaRiparare] = useState([])
  const [veicoliDaMostrare,setVeicoliDaMostrare] = useState([]);



const handleApriModaleVeicolo = (veicolo) => {
  setSelectedVeicolo(veicolo);
  setDetailModalOpen(true);
};

const handleChiudiModaleVeicolo = () => {
  setDetailModalOpen(false);
  setSelectedVeicolo(null);
};

  useEffect(() => {  
  if (veicoli.length > 0) {    
    if (prenotazioni.length > 0) {
      const oggi = new Date();
      const fineSettimana = new Date();
      fineSettimana.setDate(oggi.getDate() + 7);

      const veicoliOccupati = prenotazioni.filter(p => {
        const start = new Date(p.dataInizio);
        const end = new Date(p.dataFine);
        return oggi <= end && fineSettimana >= start;
      }).map(p => p.targa);

      const disponibiliSettimana = veicoli.filter(v => !veicoliOccupati.includes(v.targa));

      setVeicoliDaMostrare(disponibiliSettimana);

    } else {
      setVeicoliDaMostrare(veicoli);
    }
  }
}, [veicoli, prenotazioni]);


  useEffect(() => {
  const dati = Array.from({ length: 12 }, (_, i) => ({
    mese: new Date(0, i).toLocaleString('it-IT', { month: 'short' }),
    valore: 0
  }));

  prenotazioni.forEach(p => {
    const d = new Date(p.dataInizio);
    if (!isNaN(d)) {
      const mese = d.getMonth();
      dati[mese].valore += 1;
    }
  });

  setPrenotazioniPerMese(dati);
}, [prenotazioni]);

  // Carica i dati iniziali della dashboard
  useEffect(() => {
  const caricaDatiDashboard = async () => {
    try {
      const clientiData = await window.electronAPI.readClienti();
      const prenotazioniData = await window.electronAPI.readPrenotazioni();

      const meseCorrente = new Date().getMonth(); // 0-11
      const annoCorrente = new Date().getFullYear();

      //const prenotazioniAttive = prenotazioniData.filter(p => p.status === 'attiva');
      const incassoMese = prenotazioniData.reduce((tot, p) => {
        const d = new Date(p.dataInizio);
        if (d.getMonth() === meseCorrente && d.getFullYear() === annoCorrente) {
          return tot + (parseFloat(p.prezzoTotale) || 0);
        }
        return tot;
      }, 0);

      setClienti(clientiData);
      setPrenotazioni(prenotazioniData);
      setIncassoTotaleMese(incassoMese);
    } catch (err) {
      console.error("Errore dashboard:", err);
      toast.error("Errore nel caricamento dei dati della dashboard.");
    }
  };

  caricaDatiDashboard();
}, []);

useEffect(() => {
  const datiPrenotazioni = Array.from({ length: 12 }, (_, i) => ({
    mese: new Date(0, i).toLocaleString('it-IT', { month: 'short' }),
    valore: 0
  }));

  const datiIncassi = Array.from({ length: 12 }, (_, i) => ({
    mese: new Date(0, i).toLocaleString('it-IT', { month: 'short' }),
    valore: 0
  }));

  prenotazioni.forEach(p => {
    const d = new Date(p.dataInizio);
    if (!isNaN(d)) {
      const mese = d.getMonth();
      datiPrenotazioni[mese].valore += 1;
      datiIncassi[mese].valore += parseFloat(p.prezzoTotale) || 0;
    }
  });

  setPrenotazioniPerMese(datiPrenotazioni);
  setIncassiPerMese(datiIncassi);
}, [prenotazioni]);


  useEffect(() => {
    const oggi = new Date();
    const entro30giorni = veicoli.flatMap(v => {
      const check = (tipo, data) => {
        if (!data) return null;
        const d = new Date(data);
        const diff = (d - oggi) / (1000 * 60 * 60 * 24);
        if (diff <= 30) {
          return {
            veicolo: `${v.marca} ${v.modello}`,
            targa: v.targa,
            tipo,
            data: data,
            giorni: Math.floor(diff)
          };
        }
        return null;
      };

      return [
        check("Assicurazione", v.scadenze?.assicurazione),
        check("Bollo", v.scadenze?.bollo),
        check("Revisione", v.scadenze?.revisione)
      ].filter(Boolean);
    });

    setScadenzeProssime(entro30giorni);
  }, [veicoli]);

  useEffect(() => {
  const danni = [];

  veicoli.forEach((v) => {
    // Danni manuali ancora da riparare
    v.danni?.forEach((d) => {
      if (d.daRiparare === true) {
        danni.push({
          tipo: "Manuale",
          veicolo: `${v.marca} ${v.modello}`,
          targa: v.targa,
          descrizione: d.descrizione,
        });
      }
    });

    // Danni da prenotazioni completate ancora da riparare
    prenotazioni
      .filter((p) => p.targa === v.targa && p.status === "completata" && p.daRiparare === true)
      .forEach((p) => {
        danni.push({
          tipo: "Prenotazione",
          veicolo: `${v.marca} ${v.modello}`,
          targa: v.targa,
          descrizione: p.descrizioneDanno,
        });
      });
  });

  setDanniDaRiparare(danni);
}, [veicoli, prenotazioni]);

  
  useEffect(() => {
    const caricaVeicoli = async () => {
      try {
        const dati = await window.electronAPI.readVeicoli();
        dispatch(setVeicoli(dati));
      } catch (error) {
        console.error('Errore nel caricamento veicoli dalla Dashboard:', error);
      }
    };
  
    if (veicoli.length === 0) {
      caricaVeicoli();
    }
  }, [veicoli.length, dispatch]);

  const stats = [
    {
      title: 'Veicoli Disponibili',
      value: veicoli.length,
      icon:  <Car size={32} />,
      colorClass: 'blue'
    },
    {
      title: 'Clienti Registrati',
      value: clienti.length,
      icon:  <Users size={32} />,
      colorClass: 'green'
    },
    {
      title: 'Prenotazioni Attive',
      value: prenotazioni.length,
      icon: <CalendarCheck size={32} />,
      colorClass: 'yellow'
    },
    {
      title: 'Incasso Mese',
      value:`€${incassoTotaleMese.toLocaleString('it-IT')}`,
      icon: <Euro size={32} />,
      colorClass: 'purple'
    }
  ];


  const filtraVeicoliDisponibili = async () => {
  if (!dataInizioRicerca || !dataFineRicerca) {
    toast.warn("Seleziona entrambe le date per cercare.");
    return;
  }

  const inizio = new Date(dataInizioRicerca);
  const fine = new Date(dataFineRicerca);

  if (inizio > fine) {
    toast.error("La data di inizio non può essere dopo la data di fine.");
    return;
  }

  try {
    const tuttePrenotazioni = await window.electronAPI.readPrenotazioni();

    const veicoliOccupati = tuttePrenotazioni
      .filter(p => {
        const start = new Date(p.dataInizio);
        const end = new Date(p.dataFine);
        return (
          (inizio <= end && fine >= start) // sovrapposizione
        );
      })
      .map(p => p.targa);

    const disponibili = veicoli.filter(v => !veicoliOccupati.includes(v.targa));
    setVeicoliDaMostrare(disponibili);
  } catch (err) {
    console.error("Errore ricerca disponibilità:", err);
    toast.error("Errore durante la ricerca dei veicoli disponibili.");
  }
};

  

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

<div className="box-veicoli-dashboard">
 <h2><Car size={20} style={{ marginRight: '6px' }} /> Auto Disponibili</h2>


  <div className="filtro-date">
    <label className='campo-data'>
    <CalendarDays size={16} style={{ marginRight: '6px' }} />
      Inizio:
      <input type="date" value={dataInizioRicerca} onChange={(e) => setDataInizioRicerca(e.target.value)} />
    </label>
    <label className='campo-data'>
      <CalendarDays size={16} style={{ marginRight: '6px' }} />
     Fine:
      <input type="date" value={dataFineRicerca} onChange={(e) => setDataFineRicerca(e.target.value)} />
    </label>
    <button onClick={filtraVeicoliDisponibili}>Cerca</button>
  </div>

  <div className="scroll-veicoli">
    {veicoliDaMostrare.length > 0 ? (
      veicoliDaMostrare.map(v => (
      <div
        key={v.id}
        className="card-veicolo-dashboard"
        onClick={() => handleApriModaleVeicolo(v)}

        style={{ cursor: 'pointer' }}
      >
        {v.immagine && (
          <img
            src={v.immagine}
            className="img-card-veicolo"
            alt={`${v.marca} ${v.modello}`}
          />
        )}
        <div className="info-card-veicolo">
          <div className="titolo">{v.marca} {v.modello}</div>
          <div className="targa">{v.targa}</div>
        </div>
      </div>
    ))
  ) :(
   <p>Nessun veicolo disponibile per le date selezionate.</p>
  )}
  </div>


</div>



<div className="graph">
  <div className="graph-card">
    <h3>📈 Prenotazioni per mese</h3>
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={prenotazioniPerMese}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="mese" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="valore" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  </div>

  <div className="graph-card">
    <h3>💶 Incasso per mese</h3>
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={incassiPerMese}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="mese" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="valore" stroke="#28a745" />
      </LineChart>
    </ResponsiveContainer>
  </div>
</div>




      {scadenzeProssime.length > 0 && (
        <div className="scadenze-box">
          <h2>🔔 Scadenze in arrivo (entro 30 giorni)</h2>
          <table className="scadenze-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Veicolo</th>
                <th>Targa</th>
                <th>Data</th>
                <th>Tra (giorni)</th>
              </tr>
            </thead>
            <tbody>
              {scadenzeProssime.map((s, i) => (
                <tr key={i}>
                  <td>{s.tipo}</td>
                  <td>{s.veicolo}</td>
                  <td>{s.targa}</td>
                  <td>{s.data?.split('-').reverse().join('/')}</td>
                  <td style={{color: s.giorni < 0 ? 'red' : 'inherit'}}>{s.giorni >= 0 ? s.giorni : 'Scaduto'} </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
{/*
      {danniDaRiparare.length > 0 && (
  <div className="scadenze-box">
    <h2>🛠️ Danni da Riparare</h2>
    <table className="scadenze-table">
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Veicolo</th>
          <th>Targa</th>
          <th>Descrizione</th>
        </tr>
      </thead>
      <tbody>
        {danniDaRiparare.map((d, i) => (
          <tr key={i}>
            <td>{d.tipo}</td>
            <td>{d.veicolo}</td>
            <td>{d.targa}</td>
            <td>{d.descrizione || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
*/}

  <VehicleDetailModal
  isOpen={detailModalOpen}
  onClose={handleChiudiModaleVeicolo}
  veicolo={selectedVeicolo}
  prenotazioni={prenotazioni}
  onUpdate={() => {}} // opzionale
  onEdit={() => {}}
  onDelete={() => {}}
  onAddDamage={() => {}}
  onDeleteDamage={() => {}}
  damageModalOpen={false}
  setDamageModalOpen={() => {}}
  selectedDamagePhoto={null}
  setSelectedDamagePhoto={() => {}}
  mostraManutenzioni={false}
  setMostraManutenzioni={() => {}}
  manutenzioneRef={null}
  nuovaManutenzione={{ data: '', descrizione: '', costo: '' }}
  setNuovaManutenzione={() => {}}
  onAddManutenzione={() => {}}
  modalLite = {true}
/>

    </div>

    
  );
}

export default Dashboard;
