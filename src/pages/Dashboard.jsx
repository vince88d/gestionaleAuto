import './Dashboard.css';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'react-toastify';
import {
  Car, CalendarCheck, CalendarClock, Euro, CalendarDays, BarChart3,
  LogIn, LogOut, ClipboardList, Wrench, Bell, CheckCircle2, CalendarPlus,
} from 'lucide-react';
import { setVeicoli } from '../store/veicoliSlice';
import { setPrenotazioni } from '../store/prenotazioniSlice';
import { readPrenotazioni, isPrenotazioneVisibile } from '../lib/firestorePrenotazioni';
import { readVeicoli } from '../lib/firestoreVeicoli';
import { readHolds } from '../lib/firestoreHolds';
import { riepilogoDashboard, serieUltimi12Mesi, veicoliLiberiNelPeriodo } from '../utils/dashboard';
import { formattaData, giornoLocale } from '../utils/scadenze';
import VehicleDetailModal from '../components/VehicleDetailModal';
import { EVENTO_AZIENDA_AGGIORNATA } from '../components/Sidebar';

const euro = (valore) => `€ ${Number(valore || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })}`;
const nomeVeicolo = (v) => [v?.marca, v?.modello].filter(Boolean).join(' ') || 'Veicolo';

// Saluto secondo l'ora del giorno.
function saluto(ora = new Date().getHours()) {
  if (ora < 13) return 'Buongiorno';
  if (ora < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

// Stile comune dei due grafici a barre: sull'asse solo il mese, nel riquadro
// al passaggio del mouse anche l'anno.
const ASSE = { fill: '#95a3b1', fontSize: 12 };
const etichettaMese = (nome, payload) => payload?.[0]?.payload?.mese || nome;

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
  const [nomeAzienda, setNomeAzienda] = useState('');

  // Nome dell'azienda cliente (Impostazioni), come in testa alla sidebar.
  useEffect(() => {
    const leggi = async () => {
      try {
        const settings = await window.electronAPI?.getCompanySettings();
        setNomeAzienda(settings?.nome?.trim() || '');
      } catch (err) {
        console.error('Errore lettura nome azienda:', err);
      }
    };
    leggi();
    window.addEventListener(EVENTO_AZIENDA_AGGIORNATA, leggi);
    return () => window.removeEventListener(EVENTO_AZIENDA_AGGIORNATA, leggi);
  }, []);

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
    { title: 'Flotta', value: r.flotta, sotto: `${r.liberiOggi.length} liberi oggi`, Icona: Car, tono: 'blu' },
    { title: 'Noleggi in corso', value: r.inCorso.length, sotto: 'oggi', Icona: CalendarCheck, tono: 'verde' },
    { title: 'Prenotazioni in arrivo', value: r.inArrivo.length, sotto: 'da domani in poi', Icona: CalendarClock, tono: 'ambra' },
    {
      title: 'Incasso del mese',
      value: euro(r.incassoMese),
      sotto: new Date().toLocaleString('it-IT', { month: 'long', year: 'numeric' }),
      Icona: Euro,
      tono: 'viola',
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
    <div className="dash">
      {/* Intestazione: saluto, data e azienda al posto del vecchio banner blu. */}
      <header className="dash-testa">
        <div>
          <p className="dash-data">
            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {nomeAzienda ? ` · ${nomeAzienda}` : ''}
          </p>
          <h1 className="dash-saluto">{saluto()}</h1>
        </div>
        <button type="button" className="dash-btn dash-btn--primario" onClick={() => navigate('/booking')}>
          <CalendarPlus size={16} aria-hidden="true" /> Nuova prenotazione
        </button>
      </header>

      <div className="dash-stat">
        {stats.map(({ title, value, sotto, Icona, tono }) => (
          <div key={title} className="dash-stat-card">
            <span className={`dash-stat-icona dash-stat-icona--${tono}`} aria-hidden="true">
              <Icona size={20} />
            </span>
            <div className="dash-stat-testi">
              <span className="dash-stat-titolo">{title}</span>
              <span className="dash-stat-valore">{value}</span>
              <span className="dash-stat-sotto">{sotto}</span>
            </div>
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

      <section className="dash-box">
        <div className="dash-box-barra">
          <h2 className="dash-box-titolo">
            <Car size={18} aria-hidden="true" />
            {dateValide ? 'Veicoli liberi nel periodo' : 'Veicoli liberi oggi'}
            <span className="dash-contatore">{veicoliDaMostrare.length}</span>
          </h2>
          <div className="dash-filtro">
            <label className="dash-campo-data">
              <span>Dal</span>
              <input type="date" value={dataInizioRicerca} onChange={(e) => setDataInizioRicerca(e.target.value)} />
            </label>
            <label className="dash-campo-data">
              <span>Al</span>
              <input type="date" value={dataFineRicerca} onChange={(e) => setDataFineRicerca(e.target.value)} />
            </label>
            {(dataInizioRicerca || dataFineRicerca) && (
              <button
                type="button"
                className="dash-btn"
                onClick={() => {
                  setDataInizioRicerca('');
                  setDataFineRicerca('');
                }}
              >
                Torna a oggi
              </button>
            )}
          </div>
        </div>
        {dateInvertite && <p className="dash-avviso">La data di fine è prima di quella di inizio.</p>}

        {veicoliDaMostrare.length > 0 ? (
          <div className="dash-veicoli">
            {veicoliDaMostrare.map((v) => (
              <button
                key={v.id}
                type="button"
                className="dash-veicolo"
                onClick={() => {
                  setSelectedVeicolo(v);
                  setDetailModalOpen(true);
                }}
              >
                <span className="dash-veicolo-foto">
                  {v.immagine ? <img src={v.immagine} alt="" /> : <Car size={28} aria-hidden="true" />}
                </span>
                <span className="dash-veicolo-nome">{nomeVeicolo(v)}</span>
                <span className="dash-veicolo-meta">
                  {v.targa}
                  {v.categoria ? ` · ${v.categoria}` : ''}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="dash-vuoto">Nessun veicolo libero {dateValide ? 'nel periodo scelto' : 'oggi'}.</p>
        )}
      </section>

      <div className="dash-grafici">
        <section className="dash-box">
          <h2 className="dash-box-titolo">
            <BarChart3 size={18} aria-hidden="true" /> Prenotazioni, ultimi 12 mesi
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={serie} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#eef1f5" />
              <XAxis dataKey="nome" tick={ASSE} axisLine={false} tickLine={false} interval={0} />
              <YAxis allowDecimals={false} tick={ASSE} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f4f6f8' }} labelFormatter={etichettaMese} />
              <Bar dataKey="prenotazioni" name="Prenotazioni" fill="#3498db" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="dash-box">
          <h2 className="dash-box-titolo">
            <Euro size={18} aria-hidden="true" /> Incasso, ultimi 12 mesi
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={serie} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#eef1f5" />
              <XAxis dataKey="nome" tick={ASSE} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={ASSE} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
              <Tooltip cursor={{ fill: '#f4f6f8' }} formatter={(valore) => euro(valore)} labelFormatter={etichettaMese} />
              <Bar dataKey="incasso" name="Incasso" fill="#2ecc71" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </section>
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
