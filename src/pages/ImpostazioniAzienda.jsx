import React, { useState, useEffect } from 'react';
import './ImpostazioniAzienda.css';
import {
  Download, KeyRound, Clock, CheckCircle, AlertTriangle, Building2, Save, DatabaseBackup,
} from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAzienda, salvaAzienda } from '../lib/firestoreAzienda';
import { leggiDatiPerBackup } from '../lib/backupDati';
import {
  AZIENDA_VUOTA, validaAzienda, aziendeUguali, normalizzaAzienda, campiCambiati,
} from '../utils/azienda';
import { nomeFileBackup, riepilogoBackup } from '../utils/backup';

const CAMPI = [
  { nome: 'nome', etichetta: 'Nome azienda', obbligatorio: true, largo: true },
  { nome: 'partitaIva', etichetta: 'Partita IVA / Codice fiscale' },
  { nome: 'telefono', etichetta: 'Telefono', tipo: 'tel' },
  { nome: 'email', etichetta: 'Email', tipo: 'email' },
  { nome: 'pec', etichetta: 'PEC', tipo: 'email' },
  { nome: 'indirizzo', etichetta: 'Indirizzo', largo: true },
];
const ETICHETTE = Object.fromEntries(CAMPI.map((c) => [c.nome, c.etichetta]));

function ImpostazioniAzienda() {
  const { dati: datiSalvati, caricato, errore: erroreLettura } = useAzienda();

  // `base` = i dati da cui e' partita la modifica. Se quelli salvati cambiano
  // (un'altra postazione) mentre si sta scrivendo, e' un conflitto: non si
  // salva sopra in silenzio.
  const [form, setForm] = useState(AZIENDA_VUOTA);
  const [base, setBase] = useState(AZIENDA_VUOTA);
  const [errori, setErrori] = useState({});
  const [salvando, setSalvando] = useState(false);

  const modificato = !aziendeUguali(form, base);
  // Conflitto solo sui campi che si stanno modificando e che un'altra
  // postazione ha cambiato nel frattempo. Durante il salvataggio arriva la
  // nostra stessa modifica: non e' un conflitto.
  const campiInConflitto = salvando ? [] : campiCambiati(base, datiSalvati).filter((c) => campiCambiati(base, form).includes(c));
  const conflitto = campiInConflitto.length > 0;

  // Quando cambiano i dati salvati: i campi che non si stanno modificando
  // prendono subito il valore nuovo (anche a meta' modifica), quelli in
  // modifica restano come li si sta scrivendo.
  useEffect(() => {
    setForm((formAttuale) => {
      const toccati = campiCambiati(base, formAttuale);
      const unito = { ...datiSalvati };
      toccati.forEach((c) => { unito[c] = formAttuale[c]; });
      return unito;
    });
    setBase((baseAttuale) => {
      const nuova = { ...datiSalvati };
      campiCambiati(baseAttuale, form).forEach((c) => { nuova[c] = baseAttuale[c]; });
      return nuova;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datiSalvati]);

  const [licenzaAttiva, setLicenzaAttiva] = useState(false);
  const [codiceLicenza, setCodiceLicenza] = useState('');
  const [preparandoBackup, setPreparandoBackup] = useState(false);

  useEffect(() => {
    window.electronAPI.getLicenseStatus()
      .then((license) => setLicenzaAttiva(license?.status === 'licensed'))
      .catch(() => setLicenzaAttiva(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrori((prev) => ({ ...prev, [name]: undefined }));
  };

  const annullaModifiche = () => {
    setForm(datiSalvati);
    setBase(datiSalvati);
    setErrori({});
  };

  // Conflitto: nei campi contesi vincono le proprie modifiche.
  const tieniLeMie = () => setBase((prec) => {
    const nuova = { ...prec };
    campiInConflitto.forEach((c) => { nuova[c] = datiSalvati[c]; });
    return nuova;
  });

  const salvaDati = async () => {
    const trovati = validaAzienda(form);
    setErrori(trovati);
    if (Object.keys(trovati).length > 0) return;

    setSalvando(true);
    try {
      await salvaAzienda(form);
      const salvati = normalizzaAzienda(form);
      setForm(salvati);
      setBase(salvati);
      toast.success('Dati aziendali salvati.');
    } catch (error) {
      console.error('Errore salvataggio dati azienda:', error);
      toast.error('Non riesco a salvare i dati: controlla la connessione e riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const scaricaBackup = async () => {
    setPreparandoBackup(true);
    try {
      const backup = await leggiDatiPerBackup();
      const res = await window.electronAPI.salvaBackup({
        nomeFile: nomeFileBackup(),
        contenuto: JSON.stringify(backup, null, 2),
      });
      if (res.success) {
        toast.success(<div>Backup salvato ({riepilogoBackup(backup)}) in:<br />{res.path}</div>);
      } else if (!res.annullato) {
        toast.error(`Errore salvataggio backup: ${res.error}`);
      }
    } catch (error) {
      console.error('Errore backup:', error);
      toast.error('Non riesco a leggere i dati per il backup: controlla la connessione e riprova.');
    } finally {
      setPreparandoBackup(false);
    }
  };

  const attivaLicenza = async () => {
    const codice = codiceLicenza.trim();
    if (!codice) {
      toast.error('Inserisci un codice di licenza valido.');
      return;
    }

    // Nome gia' salvato, non quello eventualmente in modifica nel form.
    const res = await window.electronAPI.activateLicense(codice, datiSalvati.nome);
    if (res.success) {
      toast.success("Licenza attivata! Riavvia l'app per applicare le modifiche.");
      setLicenzaAttiva(true);
      return;
    }

    toast.error(`Errore attivazione licenza: ${res.error}`);
  };

  return (
    <div className="imp">
      <div className="imp-toolbar">
        <h1 className="imp-titolo">Impostazioni</h1>
      </div>
      <p className="imp-intro">Dati dell&apos;azienda, licenza e copia di sicurezza dei dati.</p>

      <section className="imp-sezione">
        <header className="imp-sezione-testa">
          <span className="imp-sezione-icona" aria-hidden="true"><Building2 size={18} /></span>
          <div>
            <h2>Dati dell&apos;azienda</h2>
            <p>Uguali su tutte le postazioni. Il nome compare in alto nel menu e nella Dashboard.</p>
          </div>
        </header>

        {erroreLettura && (
          <div className="imp-avviso imp-avviso--errore" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Non riesco a leggere i dati dell&apos;azienda: controlla la connessione.</span>
          </div>
        )}
        {conflitto && (
          <div className="imp-avviso" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <span>
                Mentre li modificavi, un&apos;altra postazione ha cambiato anche:{' '}
                {campiInConflitto.map((c) => `${ETICHETTE[c]} (ora "${datiSalvati[c] || 'vuoto'}")`).join(', ')}.
              </span>
              <div className="imp-avviso-azioni">
                <button type="button" className="imp-btn" onClick={annullaModifiche}>Carica i dati nuovi</button>
                <button type="button" className="imp-btn" onClick={tieniLeMie}>Tieni le mie modifiche</button>
              </div>
            </div>
          </div>
        )}

        <div className="imp-griglia">
          {CAMPI.map(({ nome, etichetta, tipo, obbligatorio, largo }) => (
            <label key={nome} className={`imp-campo${largo ? ' imp-campo--largo' : ''}`}>
              <span className="imp-etichetta">{etichetta}{obbligatorio && <span className="imp-obbligatorio"> *</span>}</span>
              <input
                name={nome}
                type={tipo || 'text'}
                className={`imp-input${errori[nome] ? ' imp-input--errore' : ''}`}
                value={form[nome]}
                onChange={handleChange}
                disabled={!caricato}
                aria-invalid={Boolean(errori[nome])}
              />
              {errori[nome] && <span className="imp-errore">{errori[nome]}</span>}
            </label>
          ))}
        </div>

        <div className="imp-piede">
          {modificato && (
            <button type="button" className="imp-btn" onClick={annullaModifiche} disabled={salvando}>
              Annulla modifiche
            </button>
          )}
          <button
            type="button"
            className="imp-btn imp-btn--primario"
            onClick={salvaDati}
            disabled={!modificato || conflitto || salvando}
          >
            <Save size={16} aria-hidden="true" /> {salvando ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </section>

      <section className="imp-sezione">
        <header className="imp-sezione-testa">
          <span className="imp-sezione-icona" aria-hidden="true"><KeyRound size={18} /></span>
          <div>
            <h2>Licenza</h2>
            <p>Licenza di questo computer.</p>
          </div>
          <span className={`imp-stato ${licenzaAttiva ? 'imp-stato--ok' : 'imp-stato--prova'}`}>
            {licenzaAttiva ? <CheckCircle size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
            {licenzaAttiva ? 'Attiva' : 'Versione di prova'}
          </span>
        </header>
        {!licenzaAttiva && (
          <div className="imp-riga">
            <input
              className="imp-input"
              value={codiceLicenza}
              onChange={(e) => setCodiceLicenza(e.target.value)}
              placeholder="Codice licenza"
              aria-label="Codice licenza"
            />
            <button type="button" className="imp-btn imp-btn--primario" onClick={attivaLicenza}>
              <KeyRound size={16} aria-hidden="true" /> Attiva
            </button>
          </div>
        )}
      </section>

      <section className="imp-sezione">
        <header className="imp-sezione-testa">
          <span className="imp-sezione-icona" aria-hidden="true"><DatabaseBackup size={18} /></span>
          <div>
            <h2>Backup dei dati</h2>
            <p>
              Scarica in un file una copia di veicoli, prenotazioni, clienti, categorie, tariffe e dati
              dell&apos;azienda. Le foto restano online: nel file ci sono i loro collegamenti.
            </p>
          </div>
        </header>
        <div className="imp-piede imp-piede--sinistra">
          <button type="button" className="imp-btn imp-btn--primario" onClick={scaricaBackup} disabled={preparandoBackup}>
            <Download size={16} aria-hidden="true" /> {preparandoBackup ? 'Preparazione…' : 'Scarica backup'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ImpostazioniAzienda;
