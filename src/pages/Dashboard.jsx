import './Dashboard.css';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'react-toastify';
import {
  Car, CalendarCheck, CalendarClock, Euro, BarChart3, CheckCircle2, KeyRound, LogIn, ChevronRight,
} from 'lucide-react';
import { setVeicoli } from '../store/veicoliSlice';
import { updatePrenotazione } from '../store/prenotazioniSlice';
import { isPrenotazioneVisibile, segnaDannoPrenotazioneRiparato } from '../lib/firestorePrenotazioni';
import { readVeicoli, salvaVeicolo } from '../lib/firestoreVeicoli';
import { useHolds } from '../lib/firestoreHolds';
import { riepilogoDashboard, serieUltimi12Mesi, veicoliLiberiNelPeriodo } from '../utils/dashboard';
import { cambiaStatoRiparazione } from '../utils/danniVeicolo';
import { formattaData, giornoLocale } from '../utils/scadenze';
import VehicleDetailModal from '../components/VehicleDetailModal';
import RinnovaScadenzaModal from '../components/RinnovaScadenzaModal';
import { useAzienda } from '../lib/firestoreAzienda';

const euro = (valore) => `€ ${Number(valore || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })}`;
const nomeVeicolo = (v) => [v?.marca, v?.modello].filter(Boolean).join(' ') || 'Veicolo';
const giorniTra = (da, a) => Math.round((Date.parse(String(a).slice(0, 10)) - Date.parse(String(da).slice(0, 10))) / 86400000);
// Righe mostrate per gruppo in "Da sistemare" prima di "Mostra le altre".
const RIGHE_VISIBILI = 3;

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

function testoGiorni(giorni, femminile = true) {
  const finale = femminile ? 'a' : 'o';
  if (giorni < 0) return `scadut${finale} da ${-giorni} ${giorni === -1 ? 'giorno' : 'giorni'}`;
  if (giorni === 0) return 'scade oggi';
  return `scade tra ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`;
}

// Titolo di un gruppo: pallino colorato (il colore aiuta ma non e' l'unico
// segnale), testo normale (niente maiuscolo, si legge meglio) e conteggio.
function TitoloGruppo({ tono, children, conto, allerta = false }) {
  return (
    <h3 className="dash-gruppo-titolo">
      <span className={`dash-pallino dash-pallino--${tono}`} aria-hidden="true" />
      {children}
      <span className={`dash-contatore ${allerta ? 'dash-contatore--allerta' : ''}`}>{conto}</span>
    </h3>
  );
}

// Riga con testo a sinistra (cliccabile per aprire i dettagli) e un pulsante
// d'azione a destra.
function Riga({ tono, principale, secondaria, secondariaAllerta, onApri, azione, nome = false }) {
  return (
    <li className={`dash-riga dash-riga--${tono}`}>
      <button type="button" className="dash-riga-testi" onClick={onApri}>
        <span className={`dash-riga-principale ${nome ? 'dash-riga-principale--nome' : ''}`}>{principale}</span>
        <span className={`dash-riga-secondaria ${secondariaAllerta ? 'dash-scaduta' : ''}`}>{secondaria}</span>
      </button>
      {azione}
    </li>
  );
}

function Dashboard() {
  const veicoli = useSelector((state) => state.veicoli);
  const tuttePrenotazioni = useSelector((state) => state.prenotazioni);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const holds = useHolds();
  const [dataInizioRicerca, setDataInizioRicerca] = useState('');
  const [dataFineRicerca, setDataFineRicerca] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedVeicolo, setSelectedVeicolo] = useState(null);
  const [daRinnovare, setDaRinnovare] = useState(null);
  const [inSalvataggio, setInSalvataggio] = useState(null);
  // Gruppi di "Da sistemare" aperti per intero.
  const [aperti, setAperti] = useState({});
  // Nome dell'azienda cliente (Impostazioni), come in testa alla sidebar.
  const nomeAzienda = useAzienda().dati.nome;

  // Stessi dati delle altre pagine (store condiviso). Le prenotazioni
  // arrivano in tempo reale da App.js, gli hold del sito da useHolds.
  useEffect(() => {
    readVeicoli()
      .then((datiVeicoli) => dispatch(setVeicoli(datiVeicoli)))
      .catch((err) => {
        console.error('Errore dashboard:', err);
        toast.error('Errore nel caricamento dei veicoli.');
      });
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
    ? veicoliLiberiNelPeriodo(veicoli, dataInizioRicerca, dataFineRicerca, prenotazioni, holds, oggi)
    : r.liberiOggi;

  const veicoloDellaPrenotazione = (p) => {
    const v = veicoli.find((x) => x.targa && x.targa === p.targa);
    return v ? `${nomeVeicolo(v)} · ${v.targa}` : p.veicolo || p.targa || '—';
  };

  const apriVeicolo = (veicolo, scheda = 'panoramica') =>
    navigate('/vehicles', { state: { apriVeicoloId: veicolo.id, scheda } });
  // Apre la pagina Prenotazioni direttamente sulla finestra giusta.
  // Le finestre aperte da qui (consegna, ricevi, dettagli), chiudendosi,
  // riportano alla Dashboard (`da`).
  const vaiAPrenotazioni = (state) => navigate('/booking', { state: { ...state, da: '/' } });

  // Salvataggi dalla Dashboard: si rilegge il veicolo appena prima, cosi' non
  // si sovrascrive con una copia vecchia quello che un'altra postazione ha
  // cambiato nel frattempo.
  const aggiornaVeicolo = async (id, modifica) => {
    const tutti = await readVeicoli();
    const attuale = tutti.find((v) => v.id === id);
    const aggiornato = attuale && modifica(attuale);
    if (!aggiornato) throw new Error('veicolo cambiato');
    await salvaVeicolo(aggiornato);
    dispatch(setVeicoli(tutti.map((v) => (v.id === id ? aggiornato : v))));
  };

  const salvaRinnovo = async (nuovaData) => {
    const s = daRinnovare;
    try {
      await aggiornaVeicolo(s.veicolo.id, (v) => ({ ...v, scadenze: { ...(v.scadenze || {}), [s.chiave]: nuovaData } }));
      toast.success(`${s.nome} di ${nomeVeicolo(s.veicolo)}: nuova scadenza ${formattaData(nuovaData)}.`);
      setDaRinnovare(null);
    } catch (err) {
      console.error('Errore rinnovo scadenza:', err);
      toast.error('Non sono riuscito a salvare la nuova scadenza. Riprova.');
    }
  };

  const segnaRiparato = async (d) => {
    const chiave = d.prenotazione ? `p-${d.prenotazione.id}` : `v-${d.veicolo.id}-${d.indice}`;
    setInSalvataggio(chiave);
    try {
      if (d.prenotazione) {
        const campi = await segnaDannoPrenotazioneRiparato(d.prenotazione.id);
        dispatch(updatePrenotazione({ ...d.prenotazione, ...campi }));
      } else {
        // Il danno deve essere ancora quello, nella stessa posizione.
        await aggiornaVeicolo(d.veicolo.id, (v) => {
          const danno = v.danni?.[d.indice];
          if (!danno?.daRiparare || danno.descrizione !== d.descrizione) return null;
          return cambiaStatoRiparazione(v, d.indice);
        });
      }
      toast.success('Danno segnato come riparato: lo trovi nello storico del veicolo.');
    } catch (err) {
      console.error('Errore riparazione:', err);
      toast.error('Non sono riuscito a segnare il danno come riparato. Riprova dalla scheda del veicolo.');
    } finally {
      setInSalvataggio(null);
    }
  };

  const meseCorrente = new Date().toLocaleString('it-IT', { month: 'long' });
  const stats = [
    {
      titolo: 'Auto libere oggi', valore: r.liberiOggi.length, extra: `su ${r.flotta}`,
      link: 'Vedi auto', Icona: Car, tono: 'blu', onClick: () => navigate('/vehicles'),
    },
    {
      titolo: 'Auto noleggiate ora', valore: r.fuori.length,
      link: 'Vedi noleggi', Icona: CalendarCheck, tono: 'verde', onClick: () => vaiAPrenotazioni({ filtro: 'in-corso', vista: 'elenco' }),
    },
    {
      titolo: 'Prenotazioni in arrivo', valore: r.inArrivo.length,
      link: 'Vedi calendario', Icona: CalendarClock, tono: 'ambra', onClick: () => vaiAPrenotazioni({ vista: 'calendario' }),
    },
    {
      titolo: `Incasso di ${meseCorrente}`, valore: euro(r.incassoMese),
      link: 'Vedi archivio', Icona: Euro, tono: 'viola', onClick: () => navigate('/archivio-prenotazione'),
    },
  ];

  const daSistemare = r.daAssegnare.length + r.suVeicoloSospeso.length + r.danniDaRiparare.length
    + r.scadute.length + r.inScadenza.length;

  // Primi RIGHE_VISIBILI elementi di un gruppo, o tutti se aperto.
  const visibili = (nome, elenco) => (aperti[nome] ? elenco : elenco.slice(0, RIGHE_VISIBILI));
  const MostraAltre = ({ nome, elenco }) => {
    if (elenco.length <= RIGHE_VISIBILI) return null;
    const aperto = aperti[nome];
    return (
      <button type="button" className="dash-mostra" onClick={() => setAperti((a) => ({ ...a, [nome]: !aperto }))}>
        {aperto ? 'Mostra meno' : `Mostra le altre ${elenco.length - RIGHE_VISIBILI}`}
      </button>
    );
  };

  const rigaScadenza = (s, tono) => (
    <Riga
      key={`${s.veicolo.id}-${s.chiave}`}
      tono={tono}
      principale={`${s.nome} · ${nomeVeicolo(s.veicolo)}`}
      secondaria={`${testoGiorni(s.giorni, s.nome !== 'Bollo')} (${formattaData(s.data)})`}
      secondariaAllerta={s.giorni < 0}
      onApri={() => apriVeicolo(s.veicolo)}
      azione={
        <button type="button" className="dash-azione" onClick={() => setDaRinnovare(s)}>
          {s.nome === 'Bollo' ? 'Segna rinnovato' : 'Segna rinnovata'}
        </button>
      }
    />
  );

  return (
    <div className="dash">
      {/* Intestazione: saluto, data e azienda. "Nuova prenotazione" e' in cima
          al menu laterale, uguale su ogni pagina. */}
      <header className="dash-testa">
        <p className="dash-data">
          {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {nomeAzienda ? ` · ${nomeAzienda}` : ''}
        </p>
        <h1 className="dash-saluto">{saluto()}</h1>
      </header>

      <div className="dash-stat">
        {stats.map(({ titolo, valore, extra, link, Icona, tono, onClick }) => (
          <button key={titolo} type="button" className="dash-stat-card" onClick={onClick}>
            <span className={`dash-stat-icona dash-stat-icona--${tono}`} aria-hidden="true">
              <Icona size={24} />
            </span>
            <span className="dash-stat-testi">
              <span className="dash-stat-titolo">{titolo}</span>
              <span className="dash-stat-valore">
                {valore}
                {extra && <span className="dash-stat-extra"> {extra}</span>}
              </span>
              <span className="dash-stat-link">{link} <ChevronRight size={15} aria-hidden="true" /></span>
            </span>
          </button>
        ))}
      </div>

      <div className="dash-colonne">
        <section className="dash-box">
          <h2 className="dash-box-titolo">Oggi con i clienti</h2>

          <div className="dash-gruppo">
            <TitoloGruppo tono="blu" conto={r.daConsegnare.length}>Da consegnare al cliente</TitoloGruppo>
            {r.daConsegnare.length > 0 ? (
              <ul className="dash-lista">
                {r.daConsegnare.map((p) => {
                  const ritardo = giorniTra(p.dataInizio, oggi);
                  return (
                    <Riga
                      key={p.id}
                      tono="blu"
                      nome
                      principale={p.cliente || 'Cliente non indicato'}
                      secondaria={`${veicoloDellaPrenotazione(p)} · ${
                        ritardo > 0 ? `doveva uscire il ${formattaData(p.dataInizio)}` : `fino al ${formattaData(p.dataFine)}`
                      }`}
                      secondariaAllerta={ritardo > 0}
                      onApri={() => vaiAPrenotazioni({ azione: 'dettagli', id: p.id })}
                      azione={
                        <button type="button" className="dash-azione dash-azione--primaria" onClick={() => vaiAPrenotazioni({ azione: 'consegna', id: p.id })}>
                          <KeyRound size={16} aria-hidden="true" /> Consegna l&apos;auto
                        </button>
                      }
                    />
                  );
                })}
              </ul>
            ) : (
              <p className="dash-vuoto">Oggi non c&apos;è nessuna auto da consegnare.</p>
            )}
          </div>

          <div className="dash-gruppo">
            <TitoloGruppo tono="verde" conto={r.daRicevere.length}>Da ricevere indietro</TitoloGruppo>
            {r.daRicevere.length > 0 ? (
              <ul className="dash-lista">
                {r.daRicevere.map((p) => {
                  const ritardo = giorniTra(p.dataFine, oggi);
                  return (
                    <Riga
                      key={p.id}
                      tono="verde"
                      nome
                      principale={p.cliente || 'Cliente non indicato'}
                      secondaria={`${veicoloDellaPrenotazione(p)} · ${
                        ritardo > 0 ? `doveva rientrare il ${formattaData(p.dataFine)}` : 'rientra oggi'
                      }`}
                      secondariaAllerta={ritardo > 0}
                      onApri={() => vaiAPrenotazioni({ azione: 'dettagli', id: p.id })}
                      azione={
                        <button type="button" className="dash-azione dash-azione--verde" onClick={() => vaiAPrenotazioni({ azione: 'concludi', id: p.id })}>
                          <LogIn size={16} aria-hidden="true" /> Ricevi l&apos;auto
                        </button>
                      }
                    />
                  );
                })}
              </ul>
            ) : (
              <p className="dash-vuoto">Oggi non rientra nessuna auto.</p>
            )}
          </div>
        </section>

        <section className="dash-box">
          <h2 className="dash-box-titolo">
            Da sistemare
            {daSistemare > 0 && <span className="dash-contatore dash-contatore--pieno">{daSistemare}</span>}
          </h2>

          {daSistemare === 0 && (
            <p className="dash-tutto-ok">
              <CheckCircle2 size={18} aria-hidden="true" /> Tutto in ordine: niente da assegnare, riparare o rinnovare.
            </p>
          )}

          {r.daAssegnare.length > 0 && (
            <div className="dash-gruppo">
              <TitoloGruppo tono="rosso" conto={r.daAssegnare.length} allerta>Prenotazioni del sito senza auto</TitoloGruppo>
              <ul className="dash-lista">
                {visibili('assegnare', r.daAssegnare).map((p) => (
                  <Riga
                    key={p.id}
                    tono="rosso"
                    nome
                    principale={p.cliente || 'Cliente non indicato'}
                    secondaria={`${p.categoria || '—'} · dal ${formattaData(p.dataInizio)} al ${formattaData(p.dataFine)}`}
                    onApri={() => vaiAPrenotazioni({ azione: 'dettagli', id: p.id })}
                    azione={
                      <button type="button" className="dash-azione" onClick={() => vaiAPrenotazioni({ filtro: 'tutte', vista: 'elenco' })}>
                        Scegli l&apos;auto
                      </button>
                    }
                  />
                ))}
              </ul>
              <MostraAltre nome="assegnare" elenco={r.daAssegnare} />
            </div>
          )}

          {r.suVeicoloSospeso.length > 0 && (
            <div className="dash-gruppo">
              <TitoloGruppo tono="rosso" conto={r.suVeicoloSospeso.length} allerta>Prenotazioni su auto sospese</TitoloGruppo>
              <ul className="dash-lista">
                {visibili('sospese', r.suVeicoloSospeso).map((p) => (
                  <Riga
                    key={p.id}
                    tono="rosso"
                    nome
                    principale={p.cliente || 'Cliente non indicato'}
                    secondaria={`${p.veicolo || p.categoria || '—'} · ${p.targa} · dal ${formattaData(p.dataInizio)}`}
                    onApri={() => vaiAPrenotazioni({ azione: 'dettagli', id: p.id })}
                    azione={
                      <button type="button" className="dash-azione" onClick={() => vaiAPrenotazioni({ azione: 'dettagli', id: p.id })}>
                        Cambia auto
                      </button>
                    }
                  />
                ))}
              </ul>
              <MostraAltre nome="sospese" elenco={r.suVeicoloSospeso} />
            </div>
          )}

          {r.scadute.length > 0 && (
            <div className="dash-gruppo">
              <TitoloGruppo tono="rosso" conto={r.scadute.length} allerta>Scadenze già passate</TitoloGruppo>
              <ul className="dash-lista">{visibili('scadute', r.scadute).map((s) => rigaScadenza(s, 'rosso'))}</ul>
              <MostraAltre nome="scadute" elenco={r.scadute} />
            </div>
          )}

          {r.danniDaRiparare.length > 0 && (
            <div className="dash-gruppo">
              <TitoloGruppo tono="arancio" conto={r.danniDaRiparare.length}>Danni da riparare</TitoloGruppo>
              <ul className="dash-lista">
                {visibili('danni', r.danniDaRiparare).map((d) => {
                  const chiave = d.prenotazione ? `p-${d.prenotazione.id}` : `v-${d.veicolo.id}-${d.indice}`;
                  return (
                    <Riga
                      key={chiave}
                      tono="arancio"
                      principale={d.descrizione || 'Danno senza descrizione'}
                      secondaria={`${nomeVeicolo(d.veicolo)} · ${d.veicolo.targa}${d.origine === 'riconsegna' ? ' · visto alla riconsegna' : ''}`}
                      onApri={() => apriVeicolo(d.veicolo, 'danni')}
                      azione={
                        <button type="button" className="dash-azione" disabled={inSalvataggio === chiave} onClick={() => segnaRiparato(d)}>
                          {inSalvataggio === chiave ? 'Salvo…' : 'Segna riparato'}
                        </button>
                      }
                    />
                  );
                })}
              </ul>
              <MostraAltre nome="danni" elenco={r.danniDaRiparare} />
            </div>
          )}

          {r.inScadenza.length > 0 && (
            <div className="dash-gruppo">
              <TitoloGruppo tono="ambra" conto={r.inScadenza.length}>In scadenza nei prossimi 30 giorni</TitoloGruppo>
              <ul className="dash-lista">{visibili('inScadenza', r.inScadenza).map((s) => rigaScadenza(s, 'ambra'))}</ul>
              <MostraAltre nome="inScadenza" elenco={r.inScadenza} />
            </div>
          )}
        </section>
      </div>

      <section className="dash-box">
        <div className="dash-box-barra">
          <h2 className="dash-box-titolo">
            <Car size={18} aria-hidden="true" />
            {dateValide ? 'Auto libere nel periodo' : 'Cerca un\'auto libera'}
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

      <RinnovaScadenzaModal scadenza={daRinnovare} onCancel={() => setDaRinnovare(null)} onConfirm={salvaRinnovo} />

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
        periodoScelto={dateValide ? { dataInizio: dataInizioRicerca, dataFine: dataFineRicerca } : null}
      />
    </div>
  );
}

export default Dashboard;
