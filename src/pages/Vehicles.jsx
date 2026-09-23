import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setVeicoli, addVeicolo, updateVeicolo, deleteVeicolo } from '../store/veicoliSlice';
import { toast } from 'react-toastify';
import Modal from 'react-modal';
import VehicleDetailModal from '../components/VehicleDetailModal';
import { setPrenotazioni } from '../store/prenotazioniSlice';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Search } from 'lucide-react';
import VehicleCard from '../components/VeichleCard';
import VehicleForm from '../components/VehicleForm';
import { readVeicoli, salvaVeicolo, eliminaVeicolo } from '../lib/firestoreVeicoli';
import { readCategorie } from '../lib/firestoreCategorie';
import { caricaFotoVeicolo, caricaFotoDanno } from '../lib/storageFoto';
import { readPrenotazioni, isPrenotazioneVisibile } from '../lib/firestorePrenotazioni';
import { readHolds } from '../lib/firestoreHolds';
import { veicoloLibero } from '../utils/disponibilitaCategoria';
import { cambiaStatoRiparazione } from '../utils/danniVeicolo';
import { coloreScadenza, giornoLocale } from '../utils/scadenze';
import { validaVeicolo, preparaVeicolo } from '../utils/validaVeicolo';
import './Vehicle.css';

Modal.setAppElement('#root');


const emptyFormData = {
  id: '',
  modello: '',
  marca: '',
  targa: '',
  anno: '',
  prezzo: '',
  colore: '',
  carburante: '',
  km: '',
  porte: '',
  cambio: '',
  categoria: '',
  note: '',
  immagine: '',
  danni: [],
  storicoRiparazioni:[],
  prenotazioni: [],
  scadenze: {
    assicurazione: '',
    bollo: '',
    revisione: '',
  },
  manutenzioni: [], 
};

function Vehicles() {
  const veicoli = useSelector((state) => state.veicoli);
  const prenotazioni = useSelector((state) => state.prenotazioni);
  const dispatch = useDispatch();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVeicolo, setEditingVeicolo] = useState(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedVeicolo, setSelectedVeicolo] = useState(null); 
  const [selectedDamagePhoto, setSelectedDamagePhoto] = useState(null);
  const [damageModalOpen, setDamageModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [nuovaManutenzione, setNuovaManutenzione] = useState({
    data: '',
    descrizione: '',
    costo: ''
  });
  
   const [confirmDialog, setConfirmDialog] = useState({ open: false, message: '', onConfirm: null });
   const [categorie, setCategorie] = useState([]);
   const [holds, setHolds] = useState([]);
   const [erroriForm, setErroriForm] = useState({});
   const [salvandoForm, setSalvandoForm] = useState(false);
   const [schedaIniziale, setSchedaIniziale] = useState('panoramica');
   const location = useLocation();
   const navigate = useNavigate();






  useEffect(() => {
    const caricaVeicoli = async () => {
      try {
        const dati = await readVeicoli();
        dispatch(setVeicoli(dati));
        setCategorie(await readCategorie(dati));
      } catch (error) {
        console.error('Errore nel caricamento veicoli:', error);
      }
    };

    caricaVeicoli();
  }, [dispatch]);


  useEffect(() => {
  const caricaPrenotazioni = async () => {
    try {
      const dati = await readPrenotazioni();
      dispatch(setPrenotazioni(dati));
    } catch (error) {
      console.error('Errore caricamento prenotazioni:', error);
    }
  };

  caricaPrenotazioni();
}, [dispatch]);


  useEffect(() => {
    readHolds().then(setHolds).catch((error) => {
      console.error('Errore caricamento hold del sito:', error);
    });
  }, []);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // L'errore di un campo sparisce appena lo si corregge.
    setErroriForm((prev) => {
      if (!prev[name]) return prev;
      const { [name]: _tolto, ...resto } = prev;
      return resto;
    });
  };

  const handleOpenModal = (veicolo = null) => {
    if (veicolo) {
      setEditingVeicolo(veicolo);
      setFormData({
        ...emptyFormData,
        ...veicolo,
        scadenze: {
          ...emptyFormData.scadenze,
          ...(veicolo.scadenze || {})
        }
      });
    } else {
      setEditingVeicolo(null);
      setFormData(emptyFormData);
    }
    
    setModalOpen(true);
  };

  // Chiudendo il form di modifica (anche con Annulla) si torna alla scheda del
  // veicolo da cui si era partiti.
  const handleCloseModal = (veicoloDaRiaprire = editingVeicolo) => {
    setModalOpen(false);
    setEditingVeicolo(null);
    setFormData(emptyFormData);
    setErroriForm({});
    if (veicoloDaRiaprire) handleOpenDetailModal(veicoloDaRiaprire);
  };
  const handleOpenDetailModal = (veicolo, scheda = 'panoramica') => {
    setSchedaIniziale(scheda);
    setSelectedVeicolo(veicolo);
    setDetailModalOpen(true);
  };

  // Dalla Dashboard (danni, scadenze) si arriva qui con il veicolo da aprire e
  // la scheda da mostrare. Si pulisce lo stato per non riaprirlo al ritorno.
  useEffect(() => {
    const { apriVeicoloId, scheda } = location.state || {};
    if (!apriVeicoloId || veicoli.length === 0) return;
    const veicolo = veicoli.find((v) => v.id === apriVeicoloId);
    if (veicolo) handleOpenDetailModal(veicolo, scheda);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, veicoli]);

  // Nella scheda ogni azione salva subito, quindi alla chiusura non c'e'
  // nulla da confermare.
  const handleCloseDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedVeicolo(null);
  };


  // Salva solo il veicolo aggiunto o modificato (prima si riscriveva tutta la
  // flotta con la copia locale, cancellando i veicoli aggiunti nel frattempo da
  // un'altra postazione). Lo stato si aggiorna dopo che Firestore ha risposto.
  const salvaForm = async () => {
    const dati = preparaVeicolo(formData);
    const targaPrecedente = editingVeicolo?.targa;
    setSalvandoForm(true);
    try {
      if (editingVeicolo) {
        const salvato = await salvaVeicolo({ ...dati, id: editingVeicolo.id }, { targaPrecedente });
        dispatch(updateVeicolo(salvato));
        if (targaPrecedente && targaPrecedente !== salvato.targa) {
          dispatch(setPrenotazioni(prenotazioni.map((p) =>
            p.targa === targaPrecedente ? { ...p, targa: salvato.targa } : p)));
        }
        toast.success('Veicolo aggiornato!');
        handleCloseModal(salvato);
      } else {
        const salvato = await salvaVeicolo({ ...dati, id: crypto.randomUUID(), danni: [] });
        dispatch(addVeicolo(salvato));
        toast.success('Veicolo aggiunto!');
        handleCloseModal(null);
      }
    } catch (error) {
      console.error('Errore salvataggio:', error);
      toast.error('Errore nel salvataggio.');
    } finally {
      setSalvandoForm(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (salvandoForm) return;

    const errori = validaVeicolo(formData, veicoli, editingVeicolo?.id);
    setErroriForm(errori);
    if (Object.keys(errori).length > 0) {
      toast.error('Controlla i campi segnati in rosso.');
      return;
    }

    // Cambio di targa: le prenotazioni sono legate al veicolo solo dalla targa,
    // quindi vengono spostate sulla nuova. Prima si chiede conferma.
    const targaNuova = preparaVeicolo(formData).targa;
    const targaVecchia = editingVeicolo?.targa;
    const daSpostare = targaVecchia && targaVecchia !== targaNuova
      ? prenotazioni.filter((p) => p.targa === targaVecchia).length
      : 0;
    if (daSpostare > 0) {
      setConfirmDialog({
        open: true,
        message: `Cambi la targa da ${targaVecchia} a ${targaNuova}: ${daSpostare === 1 ? 'la sua prenotazione passa' : `le sue ${daSpostare} prenotazioni passano`} alla nuova targa. Continuare?`,
        onConfirm: () => {
          setConfirmDialog({ open: false, message: '', onConfirm: null });
          salvaForm();
        },
      });
      return;
    }
    salvaForm();
  };

const handleDelete = async (id) => {
  try {
    await eliminaVeicolo(id);
    dispatch(deleteVeicolo(id));
    toast.success('Veicolo eliminato!');
    return true; // Indica che l'eliminazione è avvenuta con successo
  } catch (error) {
    console.error('Errore eliminazione:', error);
    toast.error('Errore durante eliminazione.');
    return false;
  }
};

  // La foto del veicolo va su Firebase Storage (non più sul computer), così la vede
  // anche il sito: si salva nel veicolo l'indirizzo web della foto.
  const handleImageSelect = () => {
    const scelta = document.createElement('input');
    scelta.type = 'file';
    scelta.accept = 'image/jpeg,image/png,image/webp';
    scelta.onchange = async () => {
      const file = scelta.files && scelta.files[0];
      if (!file) return;
      const caricamento = toast.loading('Carico la foto…');
      try {
        const indirizzo = await caricaFotoVeicolo(file);
        setFormData((prev) => ({ ...prev, immagine: indirizzo }));
        toast.update(caricamento, { render: 'Foto caricata.', type: 'success', isLoading: false, autoClose: 2500 });
      } catch (error) {
        console.error('Errore caricamento foto:', error);
        toast.update(caricamento, {
          render: error.message || 'Non sono riuscito a caricare la foto. Riprova.',
          type: 'error',
          isLoading: false,
          autoClose: 5000,
        });
      }
    };
    scelta.click();
  };


const handleDeleteDamagePhoto = (index) => {
  if (!selectedVeicolo) return;

  setConfirmDialog({
    open: true,
    message: 'Sei sicuro di voler eliminare questa foto?',
    onConfirm: () => {
      const danniAggiornati = selectedVeicolo.danni.filter((_, i) => i !== index);
      const aggiornato = { ...selectedVeicolo, danni: danniAggiornati };
      setConfirmDialog({ open: false, message: '', onConfirm: null });
      handleUpdate(aggiornato, 'Danno eliminato.');
    }
  });
};



const prenotazioniAttive = prenotazioni.filter(p => p.status !== 'completata' && isPrenotazioneVisibile(p));

// Libero oggi: stessa regola della Dashboard (targa + categoria piena per
// hold e prenotazioni del sito non ancora assegnate).
const isDisponibile = (veicolo) => {
  const oggi = giornoLocale();
  return veicoloLibero(veicolo, oggi, oggi, veicoli, prenotazioniAttive, holds);
};
const handleDeleteManutenzione = (index) => {
  setConfirmDialog({
    open: true,
    message: 'Eliminare questa manutenzione?',
    onConfirm: () => {
      setConfirmDialog({ open: false, message: '', onConfirm: null });
      handleUpdate(
        { ...selectedVeicolo, manutenzioni: selectedVeicolo.manutenzioni.filter((_, i) => i !== index) },
        'Manutenzione eliminata.'
      );
    },
  });
};

const handleAddManutenzione = async () => {
  if (
    !nuovaManutenzione.data ||
    !nuovaManutenzione.descrizione ||
    !nuovaManutenzione.costo
  ) {
    toast.error("Compila tutti i campi");
    return;
  }

  const nuova = {
    ...nuovaManutenzione,
    costo: parseFloat(nuovaManutenzione.costo),
  };

  const salvato = await handleUpdate(
    { ...selectedVeicolo, manutenzioni: [...(selectedVeicolo.manutenzioni || []), nuova] },
    'Manutenzione aggiunta.'
  );
  if (salvato) setNuovaManutenzione({ data: '', descrizione: '', costo: '' });
};


const handleEdit = () => {
  handleCloseDetailModal();
  handleOpenModal(selectedVeicolo);
};


// Salva il veicolo aperto nella scheda. Ogni azione della scheda (danni,
// riparazioni, manutenzioni) passa da qui e salva subito: non c'e' piu' un
// pulsante "Salva" da ricordarsi. Restituisce true se il salvataggio e' andato.
const handleUpdate = async (veicoloAggiornato = selectedVeicolo, messaggio = 'Modifiche salvate!') => {
  try {
    // Trova il veicolo originale
    const originale = veicoli.find((v) => v.id === veicoloAggiornato.id);
    if (!originale) throw new Error("Veicolo non trovato");

    // Merge completo: solo le proprietà aggiornate sovrascrivono
    const veicoloCompleto = {
      ...originale,
      ...veicoloAggiornato,
      danni: veicoloAggiornato.danni || originale.danni || [],
      storicoRiparazioni: veicoloAggiornato.storicoRiparazioni || originale.storicoRiparazioni || [],
      manutenzioni: veicoloAggiornato.manutenzioni || originale.manutenzioni || [],
      prenotazioni: veicoloAggiornato.prenotazioni || originale.prenotazioni || [],
      scadenze: {
        ...originale.scadenze,
        ...veicoloAggiornato.scadenze,
      },
    };

    const salvato = await salvaVeicolo(veicoloCompleto);
    dispatch(updateVeicolo(salvato));
    setSelectedVeicolo(salvato);
    toast.success(messaggio);
    return true;
  } catch (error) {
    console.error("Errore durante l'aggiornamento:", error);
    toast.error("Errore salvataggio.");
    return false;
  }
};

  // Calcola disponibilità consecutiva da oggi
const calcolaDisponibilitaConsecutiva = (veicolo) => {
  const oggi = new Date();
  let giorniLiberi = 0;

  for (let i = 0; i < 30; i++) {
    const giorno = new Date(oggi);
    giorno.setDate(oggi.getDate() + i);
    const data = giornoLocale(giorno);

    const occupato = prenotazioniAttive.some(p =>
      p.targa === veicolo.targa &&
      p.dataInizio <= data &&
      p.dataFine >= data
    );

    if (occupato) break;
    giorniLiberi++;
  }

  return giorniLiberi;
};

// Applica l’ordinamento ai veicoli
const veicoliOrdinati = [...veicoli].sort((a, b) => {
  const giorniA = calcolaDisponibilitaConsecutiva(a);
  const giorniB = calcolaDisponibilitaConsecutiva(b);
  return giorniB - giorniA; // ordine decrescente
});


// Ricerca per parole: ogni parola scritta deve comparire in almeno uno tra
// marca, modello, targa e categoria. Cosi' "citroen c3" trova la Citroen
// C3 anche se marca e modello sono campi separati. Tollerante ai campi
// mancanti (prima un veicolo senza marca mandava in errore la pagina).
const paroleCercate = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
const veicoliFiltrati = paroleCercate.length
  ? veicoliOrdinati.filter((v) => {
      const testoVeicolo = [v.marca, v.modello, v.targa, v.categoria]
        .map((campo) => (campo || '').toString().toLowerCase())
        .join(' ');
      return paroleCercate.every((parola) => testoVeicolo.includes(parola));
    })
  : veicoliOrdinati;

const getScadenzaColor = coloreScadenza;


// Nuovo danno dalla scheda: la foto va su Storage (cartella danni/), nel
// veicolo resta solo il suo indirizzo. Restituisce true se e' andato tutto bene.
const handleAddManualDamage = async ({ file, ...dati }) => {
  if (!selectedVeicolo) return false;
  const caricamento = toast.loading('Carico la foto del danno…');
  try {
    const immagine = await caricaFotoDanno(file);
    toast.dismiss(caricamento);
    return handleUpdate(
      { ...selectedVeicolo, danni: [...(selectedVeicolo.danni || []), { ...dati, immagine }] },
      'Danno aggiunto.'
    );
  } catch (error) {
    console.error('Errore caricamento foto danno:', error);
    toast.update(caricamento, {
      render: error.message || 'Non sono riuscito a caricare la foto. Riprova.',
      type: 'error',
      isLoading: false,
      autoClose: 5000,
    });
    return false;
  }
};


// Riparato / da riparare: la regola sta in utils/danniVeicolo (testata).
const handleToggleRepairStatus = (index) => {
  const danno = selectedVeicolo.danni?.[index];
  const aggiornato = cambiaStatoRiparazione(selectedVeicolo, index);
  if (!aggiornato) return;
  handleUpdate(
    aggiornato,
    danno.daRiparare ? 'Danno spostato nello storico delle riparazioni.' : 'Danno segnato da riparare.'
  );
};



  return (
    
    <div className="vehicles-wrapper">
      {/* Barra in alto: titolo e conteggio a sinistra, ricerca e bottone a
          destra. Layout flex normale (prima il bottone era position:absolute
          senza coordinate orizzontali e si spostava col ridimensionamento). */}
      <div className="veicoli-toolbar">
        <div className="veicoli-intestazione">
          <h1 className="veicoli-titolo">Veicoli</h1>
          <span className="veicoli-conteggio">
            {veicoli.length} {veicoli.length === 1 ? 'veicolo' : 'veicoli'} in flotta
          </span>
        </div>
        <div className="veicoli-azioni">
          <label className="veicoli-cerca">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Cerca marca, modello, targa, categoria…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cerca veicoli"
            />
          </label>
          <button type="button" onClick={() => handleOpenModal()} className="veicoli-aggiungi">
            <Plus size={18} aria-hidden="true" /> Aggiungi veicolo
          </button>
        </div>
      </div>

      {veicoli.length === 0 ? (
        <p className="veicoli-vuoto">Nessun veicolo in flotta. Aggiungi il primo con il bottone qui sopra.</p>
      ) : veicoliFiltrati.length === 0 ? (
        <p className="veicoli-vuoto">Nessun veicolo corrisponde a “{search}”.</p>
      ) : (
        <div className="vehicle-list">
          {veicoliFiltrati.map((veicolo) => (
            <VehicleCard
              key={veicolo.id}
              veicolo={veicolo}
              onClick={() => handleOpenDetailModal(veicolo)}
              calcolaDisponibilitaConsecutiva={calcolaDisponibilitaConsecutiva}
              isDisponibile={isDisponibile}
              getScadenzaColor={getScadenzaColor}
            />
          ))}
        </div>
      )}

<VehicleDetailModal
  isOpen={detailModalOpen}
  onClose={handleCloseDetailModal}
  veicolo={selectedVeicolo}
  prenotazioni={prenotazioni}
  veicoli={veicoli}
  holds={holds}
  schedaIniziale={schedaIniziale}
  onUpdate={handleUpdate}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onAddDamage={handleAddManualDamage}
  onDeleteDamage={handleDeleteDamagePhoto}
  damageModalOpen={damageModalOpen}
  setDamageModalOpen={setDamageModalOpen}
  selectedDamagePhoto={selectedDamagePhoto}
  setSelectedDamagePhoto={setSelectedDamagePhoto}
  nuovaManutenzione={nuovaManutenzione}
  setNuovaManutenzione={setNuovaManutenzione}
  onAddManutenzione={handleAddManutenzione}
  onDeleteManutenzione={handleDeleteManutenzione}
  onToggleRepairStatus={handleToggleRepairStatus}
/>



      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onRequestClose={() => handleCloseModal()}
        className={{
          base: 'Modal vf-modal',
          afterOpen: 'Modal--after-open',
          beforeClose: 'Modal--before-close',
        }}
        overlayClassName={{
          base: 'Overlay',
          afterOpen: 'Overlay--after-open',
          beforeClose: 'Overlay--before-close',
        }}
      >      

<VehicleForm
  formData={formData}
  onChange={handleChange}
  onSubmit={handleSubmit}
  onClose={() => handleCloseModal()}
  onImageSelect={handleImageSelect}
  isEditing={!!editingVeicolo}
  setFormData={setFormData}
  categorie={categorie}
  errori={erroriForm}
  salvando={salvandoForm}
/>

      </Modal>



      <ConfirmDialog
        open={confirmDialog.open}
        message={confirmDialog.message}
        onCancel={() => setConfirmDialog({ open: false, message: '', onConfirm: null })}
        onConfirm={() => confirmDialog.onConfirm && confirmDialog.onConfirm()}
      />
    </div>    
  );
}

export default Vehicles;
