import React, { useEffect, useState } from 'react';
import { CircleAlert, CirclePlus, Euro, Gauge, Globe, Shield, User } from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmDialog from '../components/ConfirmDialog';
import ComeFunziona from '../components/ComeFunziona';
import Aiuto from '../components/Aiuto';
import { ascoltaModalitaSito, salvaModalitaSito } from '../lib/firestoreSito';
import Tariffe from './Tariffe';
import ChilometriFormule from './ChilometriFormule';
import CatalogoOptional from './CatalogoOptional';
import ProtezioniCategorie from './ProtezioniCategorie';
import AddebitiRientro from './AddebitiRientro';
import EtaConducenti from './EtaConducenti';
import './TariffeEOptional.css';

const SCHEDE = [
  { id: 'tariffe', etichetta: 'Prezzo al giorno', Icona: Euro },
  { id: 'km', etichetta: 'Chilometri', Icona: Gauge },
  { id: 'optional', etichetta: 'Extra', Icona: CirclePlus },
  { id: 'protezioni', etichetta: 'Protezioni e cauzione', Icona: Shield },
  { id: 'eta', etichetta: 'Età dei conducenti', Icona: User },
  { id: 'addebiti', etichetta: 'Penali e addebiti', Icona: CircleAlert },
];

const SCELTE_SITO = [
  {
    id: 'pagamento',
    titolo: 'Prenota e paga online',
    testo: "Il cliente vede il prezzo, sceglie l'auto e paga con la carta. La prenotazione è subito confermata.",
    etichetta: 'Come un noleggio online',
  },
  {
    id: 'richiesta',
    titolo: 'Solo richieste, senza prezzi',
    testo: "Il cliente sceglie auto e date e ti manda una richiesta. Tu lo chiami, gli dici il prezzo e la confermi.",
    etichetta: 'I prezzi restano tuoi',
  },
];

// Pagina "Tariffe e optional": tutto quello che il cliente paga, deciso dallo
// staff, e cosa puo' fare il cliente sul sito (prezzi visibili o solo richieste).
// Mockup: formiarent-documenti/mockup/gestionale-aiuti-e-richieste.html (parte B)
function TariffeEOptional() {
  const [scheda, setScheda] = useState('tariffe');
  const [prezziNonSalvati, setPrezziNonSalvati] = useState(false);
  const [schedaInAttesa, setSchedaInAttesa] = useState(null);
  // null = in caricamento
  const [modalita, setModalita] = useState(null);
  const [modalitaInAttesa, setModalitaInAttesa] = useState(null);

  useEffect(() => ascoltaModalitaSito(setModalita, (err) => {
    console.error('Errore lettura modalità del sito:', err);
    setModalita('pagamento');
  }), []);

  const vaiA = (id) => {
    if (id === scheda) return;
    if (scheda === 'tariffe' && prezziNonSalvati) { setSchedaInAttesa(id); return; }
    setScheda(id);
  };

  const cambiaModalita = async () => {
    const nuova = modalitaInAttesa;
    setModalitaInAttesa(null);
    try {
      await salvaModalitaSito(nuova);
      toast.success(nuova === 'richiesta' ? 'Fatto: sul sito i prezzi non si vedono più.' : 'Fatto: sul sito si vedono i prezzi e si paga online.');
    } catch (err) {
      console.error('Errore salvataggio modalità del sito:', err);
      toast.error('Non sono riuscito a cambiare il sito, riprova.');
    }
  };

  const soloRichieste = modalita === 'richiesta';

  return (
    <div className="teo">
      <header className="teo-testata">
        <span className="teo-testata-icona" aria-hidden="true"><Euro size={24} /></span>
        <div>
          <h1 className="teo-titolo">Tariffe e optional</h1>
          <p className="teo-intro">I tuoi prezzi: quanto costa ogni auto al giorno, gli extra, le protezioni.</p>
        </div>
      </header>

      <ComeFunziona
        passi={[
          'Scrivi qui i tuoi prezzi una volta sola.',
          'Quando fai una prenotazione, il gestionale li mette da solo (puoi sempre cambiarli).',
          soloRichieste
            ? <><b>Sul sito i prezzi non si vedono</b>: il cliente manda solo una richiesta e tu lo chiami.</>
            : <><b>Sul sito il cliente vede questi prezzi</b> e paga online con la carta.</>,
        ]}
        dettagli="Se cambi un prezzo, le prenotazioni già fatte restano con il prezzo vecchio. Vale solo per quelle nuove."
      />

      <section className="teo-card" aria-labelledby="teo-sito-titolo">
        <h2 className="teo-card-titolo" id="teo-sito-titolo">
          <Globe size={20} aria-hidden="true" /> Prezzi sul sito
          <Aiuto titolo="Chi vede i miei prezzi?" esempio="Puoi cambiare idea quando vuoi: il sito si aggiorna subito.">
            Con «Solo richieste» i prezzi restano dentro il gestionale: sul sito non compaiono da nessuna parte, neanche per chi sa guardare «sotto».
          </Aiuto>
        </h2>
        <p className="teo-card-sotto">Scegli cosa può fare il cliente sul tuo sito.</p>
        <div className="teo-scelte" role="radiogroup" aria-labelledby="teo-sito-titolo">
          {SCELTE_SITO.map((s) => {
            const attiva = modalita === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={attiva}
                disabled={modalita === null}
                className={`teo-scelta ${attiva ? 'teo-scelta--attiva' : ''}`}
                onClick={() => { if (!attiva) setModalitaInAttesa(s.id); }}
              >
                <span className="teo-pallino" aria-hidden="true" />
                <span className="teo-scelta-testi">
                  <b>{s.titolo}</b>
                  <span>{s.testo}</span>
                  <span className="teo-scelta-eti">{attiva ? 'Attiva ora' : s.etichetta}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="teo-schede" role="tablist" aria-label="Sezioni">
        {SCHEDE.map(({ id, etichetta, Icona }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={scheda === id}
            className={`teo-scheda ${scheda === id ? 'teo-scheda--attiva' : ''}`}
            onClick={() => vaiA(id)}
          >
            <Icona size={18} aria-hidden="true" /> {etichetta}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {scheda === 'tariffe' && <Tariffe incorporata onModifiche={setPrezziNonSalvati} />}
        {scheda === 'km' && <ChilometriFormule onVaiAPenali={() => setScheda('addebiti')} />}
        {scheda === 'optional' && <CatalogoOptional />}
        {scheda === 'protezioni' && <ProtezioniCategorie />}
        {scheda === 'eta' && <EtaConducenti />}
        {scheda === 'addebiti' && <AddebitiRientro />}
      </div>
      <ConfirmDialog
        open={schedaInAttesa !== null}
        title="Prezzi non salvati"
        message="Hai cambiato dei prezzi e non li hai ancora salvati. Se cambi scheda le modifiche si perdono."
        cancelLabel="Resta qui"
        confirmLabel="Esci senza salvare"
        tone="danger"
        onCancel={() => setSchedaInAttesa(null)}
        onConfirm={() => { setPrezziNonSalvati(false); setScheda(schedaInAttesa); setSchedaInAttesa(null); }}
      />
      <ConfirmDialog
        open={modalitaInAttesa !== null}
        title={modalitaInAttesa === 'richiesta' ? 'Togliere i prezzi dal sito?' : 'Mostrare i prezzi sul sito?'}
        message={modalitaInAttesa === 'richiesta'
          ? "Da subito il sito non mostra più prezzi e non fa pagare: i clienti ti mandano una richiesta, che trovi in Prenotazioni. Le prenotazioni già fatte non cambiano."
          : "Da subito il sito mostra i prezzi di questa pagina e i clienti prenotano pagando con la carta. Le richieste già arrivate restano da confermare."}
        cancelLabel="No, lascia così"
        confirmLabel="Sì, cambia il sito"
        onCancel={() => setModalitaInAttesa(null)}
        onConfirm={cambiaModalita}
      />
    </div>
  );
}

export default TariffeEOptional;
