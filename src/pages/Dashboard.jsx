import './Dashboard.css';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'react-toastify';
import {
  Car, CalendarCheck, CalendarClock, Euro, CalendarDays, LineChartIcon,
  LogIn, LogOut, ClipboardList, Wrench, Bell, CheckCircle2,
} from 'lucide-react';
import { setVeicoli } from '../store/veicoliSlice';
import { setPrenotazioni } from '../store/prenotazioniSlice';
import { readPrenotazioni, isPrenotazioneVisibile } from '../lib/firestorePrenotazioni';
import { readVeicoli } from '../lib/firestoreVeicoli';
import { readHolds } from '../lib/firestoreHolds';
import { riepilogoDashboard, serieUltimi12Mesi, veicoliLiberiNelPeriodo } from '../utils/dashboard';
import { formattaData, giornoLocale } from '../utils/scadenze';
import VehicleDetailModal from '../components/VehicleDetailModal';

const euro = (valore) => `€ ${Number(valore || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })}`;
const nomeVeicolo = (v) => [v?.marca, v?.modello].filter(Boolean).join(' ') || 'Veicolo';

function testoGiorni(giorni) {
  if (giorni < 0) return `scaduta da ${-giorni} ${giorni === -1 ? 'giorno' : 'giorni'}`;
  if (giorni === 0) return 'scade oggi';
  return `tra ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`;
}

function Dashboard() {
  const veicoli = useSelector((state) => state.veicoli);
  const tuttePrenotazioni = useSelector((state) => state.prenotazioni);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [holds, setHolds] = useState([]);
  const [dataInizioRicerca, setDataInizioRicerca] = useState('');
  const [dataFineRicerca, setDataFineRicerca] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedVeicolo, setSelectedVeicolo] = useState(null);

  // Stessi dati delle altre pagine (store condiviso): prima la Dashboard aveva
  // una copia sua delle prenotazioni e poteva mostrare numeri vecchi.
  useEffect(() => {
    const carica = async () => {
      try {
        const [datiVeicoli, datiPrenotazioni] = await Promise.all([readVeicoli(), readPrenotazioni()]);
        dispatch(setVeicoli(datiVeicoli));
        dispatch(setPrenotazioni(datiPrenotazioni));
      } catch (err) {
        console.error('Errore dashboard:', err);
        toast.error('Errore nel caricamento dei dati della dashboard.');
      }
    };
    carica();
    readHolds().then(setHolds).catch((err) => console.error('Errore caricamento hold del sito:', err));
  }, [dispatch]);

  const oggi = giornoLocale();
  // Niente annullate ne' richieste del sito non pagate o scadute.
  const prenotazioni = useMemo(() => tuttePrenotazioni.filter(isPrenotazioneVisibile), [tuttePrenotazioni]);
  const r = useMemo(
    () => riepilogoDashboard({ veicoli, prenotazioni, holds, oggi }),
    [veicoli, prenotazioni, holds, oggi]
  );
  const serie = useMemo(() => serieUltimi12Mesi(prenotazioni, oggi), [prenotazioni, oggi]);

  // Ricerca disponibilita': senza date mostra i liberi di oggi.
  const dateValide = dataInizioRicerca && dataFineRicerca && dataInizioRicerca <= dataFineRicerca;
  const dateInvertite = dataInizioRicerca && dataFineRicerca && dataInizioRicerca > dataFineRicerca;
  const veicoliDaMostrare = dateValide
    ? veicoliLiberiNelPeriodo(veicoli, dataInizioRicerca, dataFineRicerca, prenotazioni, holds)
    : r.liberiOggi;

  const veicoloDellaPrenotazione = (p) => {
    const v = veicoli.find((x) => x.targa && x.targa === p.targa);
    if (v) return `${nomeVeicolo(v)} · ${v.targa}`;
    return p.categoria ? `${p.categoria} (da assegnare)` : p.veicolo || '—';
  };

  const apriVeicolo = (veicolo, scheda = 'panoramica') =>
    navigate('/vehicles', { state: { apriVeicoloId: veicolo.id, scheda } });

  const stats = [
    { title: 'Flotta', value: r.flotta, sotto: `${r.liberiOggi.length} liberi oggi`, icon: <Car size={28} />, colorClass: 'blue' },
    { title: 'Noleggi in corso', value: r.inCorso.length, sotto: 'oggi', icon: <CalendarCheck size={28} />, colorClass: 'green' },
    { title: 'Prenotazioni in arrivo', value: r.inArrivo.length, sotto: 'da domani in poi', icon: <CalendarClock size={28} />, colorClass: 'yellow' },
    {
      title: 'Incasso del mese',
      value: euro(r.incassoMese),
      sotto: new Date().toLocaleString('it-IT', { month: 'long', year: 'numeric' }),
      icon: <Euro size={28} />,
      colorClass: 'purple',
    },
  ];

  const daFare = r.daAssegnare.length + r.danniDaRiparare.length + r.scadenze.length;

  const ElencoOggi = ({ titolo, Icona, voci, vuoto }) => (
    <div className="dash-gruppo">
      <h3 className="dash-gruppo-titolo">
        <Icona size={16} aria-hidden="true" /> {titolo}
        <span className="dash-contatore">{voci.length}</span>
      </h3>
      {voci.length > 0 ? (
        <ul className="dash-lista">
          {voci.map((p) => (
            <li key={p.id}>
              <button type="button" className="dash-riga" onClick={() => navigate('/booking')}>
                <span className="dash-riga-principale">{p.cliente || 'Cliente non indicato'}</span>
                <span className="dash-riga-secondaria">{veicoloDellaPrenotazione(p)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dash-vuoto">{vuoto}</p>
      )}
    </div>
  );

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>

      <div className="grid">
        {stats.map((stat) => (
          <div key={stat.title} className={`card ${stat.colorClass}`}>
            <div>
              <div className="title">{stat.title}</div>
              <div className="value">{stat.value}</div>
              <div className="sotto">{stat.sotto}</div>
            </div>
            <div className="icon">{stat.icon}</div>
          </div>
        ))}
      </div>

      <div className="dash-colonne">
        <section className="dash-box">
          <h2 className="dash-box-titolo">
            <CalendarDays size={18} aria-hidden="true" /> Oggi, {formattaData(oggi)}
          </h2>
          <ElencoOggi titolo="Ritiri" Icona={LogOut} voci={r.ritiriOggi} vuoto="Nessun ritiro oggi." />
          <ElencoOggi titolo="Riconsegne" Icona={LogIn} voci={r.riconsegneOggi} vuoto="Nessuna riconsegna oggi." />
        </section>

        <section className="dash-box">
          <h2 className="dash-box-titolo">
            <ClipboardList size={18} aria-hidden="true" /> Da fare
            {daFare > 0 && <span className="dash-contatore dash-contatore--allerta">{daFare}</span>}
          </h2>

          {daFare === 0 && (
            <p className="dash-tutto-ok">
              <CheckCircle2 size={18} aria-hidden="true" /> Tutto in ordine: niente da assegnare, riparare o rinnovare.
            </p>
          )}

          {r.daAssegnare.length > 0 && (
            <div className="dash-gruppo">
              <h3 className="dash-gruppo-titolo">
                <Car size={16} aria-hidden="true" /> Prenotazioni del sito da assegnare
                <span className="dash-contatore dash-contatore--allerta">{r.daAssegnare.length}</span>
              </h3>
              <ul className="dash-lista">
                {r.daAssegnare.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="dash-riga" onClick={() => navigate('/booking')}>
                      <span className="dash-riga-principale">
                        {formattaData(p.dataInizio)} → {formattaData(p.dataFine)} · {p.categoria || '—'}
                      </span>
                      <span className="dash-riga-secondaria">{p.cliente || 'Cliente non indicato'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.danniDaRiparare.length > 0 && (
            <div className="dash-gruppo">
              <h3 className="dash-gruppo-titolo">
                <Wrench size={16} aria-hidden="true" /> Danni da riparare
                <span className="dash-contatore dash-contatore--allerta">{r.danniDaRiparare.length}</span>
              </h3>
              <ul className="dash-lista">
                {r.danniDaRiparare.map((d, i) => (
                  <li key={i}>
                    <button type="button" className="dash-riga" onClick={() => apriVeicolo(d.veicolo, 'danni')}>
                      <span className="dash-riga-principale">{d.descrizione || 'Danno senza descrizione'}</span>
                      <span className="dash-riga-secondaria">
                        {nomeVeicolo(d.veicolo)} · {d.veicolo.targa}
                        {d.origine === 'riconsegna' ? ' · rilevato alla riconsegna' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.scadenze.length > 0 && (
            <div className="dash-gruppo">
              <h3 className="dash-gruppo-titolo">
                <Bell size={16} aria-hidden="true" /> Scadenze entro 30 giorni
                <span className="dash-contatore">{r.scadenze.length}</span>
              </h3>
              <ul className="dash-lista">
                {r.scadenze.map((s) => (
                  <li key={`${s.veicolo.id}-${s.nome}`}>
                    <button type="button" className="dash-riga" onClick={() => apriVeicolo(s.veicolo)}>
                      <span className="dash-riga-principale">
                        {s.nome} · {nomeVeicolo(s.veicolo)}
                      </span>
                      <span className={`dash-riga-secondaria ${s.giorni < 0 ? 'dash-scaduta' : ''}`}>
                        {formattaData(s.data)} · {testoGiorni(s.giorni)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="box-veicoli-dashboard">
        <h2>
          <Car size={20} style={{ marginRight: '6px' }} />
          {dateValide ? 'Veicoli liberi nel periodo' : 'Veicoli liberi oggi'}
        </h2>

        <div className="filtro-date">
          <label className="campo-data">
            <CalendarDays size={16} style={{ marginRight: '6px' }} color="#007bff" />
            Dal:
            <input type="date" value={dataInizioRicerca} onChange={(e) => setDataInizioRicerca(e.target.value)} />
          </label>
          <label className="campo-data">
            <CalendarDays size={16} style={{ marginRight: '6px' }} color="#007bff" />
            Al:
            <input type="date" value={dataFineRicerca} onChange={(e) => setDataFineRicerca(e.target.value)} />
          </label>
          {(dataInizioRicerca || dataFineRicerca) && (
            <button
              type="button"
              onClick={() => {
                setDataInizioRicerca('');
                setDataFineRicerca('');
              }}
            >
              Torna a oggi
            </button>
          )}
        </div>
        {dateInvertite && <p className="dash-avviso">La data di fine è prima di quella di inizio.</p>}

        <div className="scroll-veicoli">
          {veicoliDaMostrare.length > 0 ? (
            veicoliDaMostrare.map((v) => (
              <div
                key={v.id}
                className="card-veicolo-dashboard"
                onClick={() => {
                  setSelectedVeicolo(v);
                  setDetailModalOpen(true);
                }}
                style={{ cursor: 'pointer' }}
              >
                {v.immagine && <img src={v.immagine} className="img-card-veicolo" alt={nomeVeicolo(v)} />}
                <div className="info-card-veicolo">
                  <div className="titolo">{nomeVeicolo(v)}</div>
                  <div className="targa">{v.targa}</div>
                </div>
              </div>
            ))
          ) : (
            <p>Nessun veicolo libero {dateValide ? 'nel periodo scelto' : 'oggi'}.</p>
          )}
        </div>
      </div>

      <div className="graph">
        <div className="graph-card">
          <h3><LineChartIcon size={19} color="#007bff" /> Prenotazioni, ultimi 12 mesi</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mese" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="prenotazioni" name="Prenotazioni" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="graph-card">
          <h3><Euro size={16} color="#388e3c" /> Incasso, ultimi 12 mesi</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mese" />
              <YAxis />
              <Tooltip formatter={(valore) => euro(valore)} />
              <Line type="monotone" dataKey="incasso" name="Incasso" stroke="#28a745" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <VehicleDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedVeicolo(null);
        }}
        veicolo={selectedVeicolo}
        prenotazioni={prenotazioni}
        veicoli={veicoli}
        holds={holds}
        onUpdate={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onAddDamage={() => {}}
        onDeleteDamage={() => {}}
        damageModalOpen={false}
        setDamageModalOpen={() => {}}
        selectedDamagePhoto={null}
        setSelectedDamagePhoto={() => {}}
        nuovaManutenzione={{ data: '', descrizione: '', costo: '' }}
        setNuovaManutenzione={() => {}}
        onAddManutenzione={() => {}}
        modalLite
      />
    </div>
  );
}

export default Dashboard;
