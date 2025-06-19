import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setVeicoli, addVeicolo, updateVeicolo, deleteVeicolo } from '../store/veicoliSlice';
import { toast } from 'react-toastify';
import Modal from 'react-modal';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import VehicleDetailModal from '../components/VehicleDetailModal';
import { setPrenotazioni } from '../store/prenotazioniSlice';
import ConfirmDialog from '../components/ConfirmDialog';
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
"danni": [
  {
    "id": "abc123",
    "data": "2025-06-03",
    "descrizione": "graffio paraurti posteriore",
    "immagine": "base64...",
    "daPrenotazione": true,
    "prenotazioneId": "idPrenotazione123",
    "stato": "attivo",
    "riparatoIn": null
  }
],
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
  const [originalVeicolo, setOriginalVeicolo] = useState(null);
  const [search, setSearch] = useState('');
  const [mostraManutenzioni, setMostraManutenzioni] = useState(false);
  const [nuovaManutenzione, setNuovaManutenzione] = useState({
    data: '',
    descrizione: '',
    costo: ''
  });
  
  const manutenzioneRef = useRef(null);
   const [confirmDialog, setConfirmDialog] = useState({ open: false, message: '', onConfirm: null });



 useEffect(()=>{
  if (mostraManutenzioni && manutenzioneRef.current) {
    manutenzioneRef.current.scrollIntoView({ behavior: 'smooth' });
  }
 },[mostraManutenzioni]);


  useEffect(() => {
    const caricaVeicoli = async () => {
      try {
        const dati = await window.electronAPI.readVeicoli();
        dispatch(setVeicoli(dati));
      } catch (error) {
        console.error('Errore nel caricamento veicoli:', error);
      }
    };

    caricaVeicoli();
  }, [dispatch]);


  useEffect(() => {
  const caricaPrenotazioni = async () => {
    try {
      const dati = await window.electronAPI.readPrenotazioni();
      dispatch(setPrenotazioni(dati));
    } catch (error) {
      console.error('Errore caricamento prenotazioni:', error);
    }
  };

  caricaPrenotazioni();
}, [dispatch]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingVeicolo(null);
    setFormData(emptyFormData);
  };
  const handleOpenDetailModal = (veicolo) => {
    setSelectedVeicolo(veicolo);
    setOriginalVeicolo(veicolo); 
    setDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    if (selectedVeicolo && JSON.stringify(selectedVeicolo) !== JSON.stringify(originalVeicolo)) {
      setConfirmDialog({
        open: true,
        message: 'Hai modifiche non salvate. Vuoi chiudere comunque?',
        onConfirm: () => {
          setDetailModalOpen(false);
          setSelectedVeicolo(null);
          setOriginalVeicolo(null);
          setMostraManutenzioni(false);
          setConfirmDialog({ open: false, message: '', onConfirm: null });
        }
      });
    } else {
      setDetailModalOpen(false);
      setSelectedVeicolo(null);
      setOriginalVeicolo(null);
      setMostraManutenzioni(false);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let nuovaLista;
      if (editingVeicolo) {
        const aggiornato = { ...formData, id: editingVeicolo.id };
        dispatch(updateVeicolo(aggiornato));
        nuovaLista = veicoli.map((v) => (v.id === aggiornato.id ? aggiornato : v));
        toast.success('Veicolo aggiornato!');
      } else {
        const nuovo = { ...formData, id: crypto.randomUUID(), danni: [] };
        dispatch(addVeicolo(nuovo));
        nuovaLista = [...veicoli, nuovo];
        toast.success('Veicolo aggiunto!');
      }
      await window.electronAPI.writeVeicoli(nuovaLista);
      handleCloseModal();
    } catch (error) {
      console.error('Errore salvataggio:', error);
      toast.error('Errore nel salvataggio.');
    }
  };

const handleDelete = async (id) => {
  try {
    const nuovaLista = veicoli.filter((v) => v.id !== id);
    dispatch(deleteVeicolo(id));
    await window.electronAPI.writeVeicoli(nuovaLista);
    toast.success('Veicolo eliminato!');
    return true; // Indica che l'eliminazione è avvenuta con successo
  } catch (error) {
    console.error('Errore eliminazione:', error);
    toast.error('Errore durante eliminazione.');
    return false;
  }
};

  const handleImageSelect = async () => {
    try {
      const paths = await window.electronAPI.selezionaImmagine();
      if (paths && paths.length > 0) {
        const savedPath = await window.electronAPI.salvaImmagineLocale(paths[0]);
        if (savedPath) {
          setFormData(prev => ({ ...prev, immagine: savedPath }));
        }
      }
    } catch (error) {
      console.error('Errore selezione immagine:', error);
    }
  };


  const handleAddDamagePhoto = async () => {
    if (!selectedVeicolo) return;
    try {
      const paths = await window.electronAPI.selezionaImmagine();
      if (paths && paths.length > 0) {
        const savedPath = await window.electronAPI.salvaImmagineLocale(paths[0]);
        if (savedPath) {
          const aggiornato = {
            ...selectedVeicolo,
            danni: [...(selectedVeicolo.danni || []), savedPath],
          };
  
          // Aggiorna solo lo stato locale del veicolo selezionato
          setSelectedVeicolo(aggiornato);
          
          // Mostra il messaggio di successo
          toast.success('Foto danno aggiunta con successo!');
        }
      }
    } catch (error) {
      console.error('Errore aggiunta foto danno:', error);
      toast.error('Errore durante l\'aggiunta della foto del danno.');
    }
  };
  

const handleDeleteDamagePhoto = (index) => {
  if (!selectedVeicolo) return;

  setConfirmDialog({
    open: true,
    message: 'Sei sicuro di voler eliminare questa foto?',
    onConfirm: () => {
      const danniAggiornati = selectedVeicolo.danni.filter((_, i) => i !== index);
      const aggiornato = { ...selectedVeicolo, danni: danniAggiornati };
      setSelectedVeicolo(aggiornato);
      handleUpdate(aggiornato); // <-- salva su file
      toast.info('Foto eliminata.');
      setConfirmDialog({ open: false, message: '', onConfirm: null });
    }
  });
};



const prenotazioniAttive = prenotazioni.filter(p => p.status !== 'completata');

const isDisponibile = (veicolo) => {
  const oggi = new Date().toISOString().split('T')[0];
  return !prenotazioniAttive.some(p =>
    p.targa === veicolo.targa &&
    p.dataInizio <= oggi &&
    p.dataFine >= oggi
  );
};
const handleDeleteManutenzione = (index) => {
  const aggiornato = {
    ...selectedVeicolo,
    manutenzioni: selectedVeicolo.manutenzioni.filter((_, i) => i !== index),
  };
  setSelectedVeicolo(aggiornato);
  toast.info("Manutenzione rimossa. Ricorda di salvare!");
};

const handleAddManutenzione = () => {
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

  setSelectedVeicolo((prev) => ({
    ...prev,
    manutenzioni: [...(prev.manutenzioni || []), nuova],
  }));

  setNuovaManutenzione({ data: '', descrizione: '', costo: '' });
  toast.success("Manutenzione aggiunta!");
};


const handleEdit = () => {
  handleCloseDetailModal();
  handleOpenModal(selectedVeicolo);
};


const handleUpdate = async (veicoloAggiornato = selectedVeicolo) => {
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

    dispatch(updateVeicolo(veicoloCompleto));

    const nuovaLista = veicoli.map((v) =>
      v.id === veicoloCompleto.id ? veicoloCompleto : v
    );

    await window.electronAPI.writeVeicoli(nuovaLista);
    setSelectedVeicolo(veicoloCompleto);
    toast.success("Modifiche salvate!");
  } catch (error) {
    console.error("Errore durante l'aggiornamento:", error);
    toast.error("Errore salvataggio.");
  }
};



  // Calcola disponibilità consecutiva da oggi
const calcolaDisponibilitaConsecutiva = (veicolo) => {
  const oggi = new Date();
  let giorniLiberi = 0;

  for (let i = 0; i < 30; i++) {
    const giorno = new Date(oggi);
    giorno.setDate(oggi.getDate() + i);
    const data = giorno.toISOString().split('T')[0];

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


const getScadenzaColor = (dataStr) => {
  if (!dataStr) return 'grigio';
  const oggi = new Date();
  const data = new Date(dataStr);
  const diffGiorni = Math.floor((data - oggi) / (1000 * 60 * 60 * 24));

  if (diffGiorni < 0) return 'rosso';
  if (diffGiorni <= 30) return 'giallo';
  return 'verde';
};

const handleAddManualDamage = (nuovoDanno) => {
  if (!selectedVeicolo) return;

  const danniAggiornati = [...(selectedVeicolo.danni || []), nuovoDanno];
  const aggiornato = { ...selectedVeicolo, danni: danniAggiornati };
  setSelectedVeicolo(aggiornato);

  toast.success("Danno aggiunto. Ricorda di salvare!");
};


const getEventiDisponibilità = (veicolo) => {
  const oggi = new Date();
  const giorniFuturi = 30;
  const eventi = [];

  for (let i = 0; i < giorniFuturi; i++) {
    const giorno = new Date(oggi);
    giorno.setDate(oggi.getDate() + i);
    const iso = giorno.toISOString().split('T')[0];

    const occupato = prenotazioniAttive.some(p =>
      p.targa === veicolo.targa &&
      p.dataInizio <= iso &&
      p.dataFine >= iso
    );

    eventi.push({
      start: iso,
      end: iso,
      display: 'background',
      color: occupato ? '#ffcccc' : '#ccffcc', // rosso chiaro / verde chiaro
    });
  }

  return eventi;
};


const handleToggleRepairStatus = (index) => {
  const danno = selectedVeicolo.danni[index];
  if (!danno) return;

  const danniRestanti = selectedVeicolo.danni.filter((_, i) => i !== index);
  const storicoCorrente = selectedVeicolo.storicoRiparazioni || [];

  const aggiornato = {
    ...selectedVeicolo,
    danni: danno.daRiparare
      ? danniRestanti
      : [...danniRestanti, { ...danno, daRiparare: true }],
    storicoRiparazioni: danno.daRiparare
      ? [...storicoCorrente, { ...danno, daRiparare: false, riparatoIn: new Date().toISOString() }]
      : storicoCorrente.filter((_, i) => i !== index)
  };

  setSelectedVeicolo(aggiornato);
  handleUpdate(aggiornato); // <-- Salva subito su file
  toast.success(
    danno.daRiparare
      ? 'Danno spostato nello storico delle riparazioni.'
      : 'Danno riportato tra quelli da riparare.'
  );
};



  return (
    
    <div className="vehicles-wrapper">
      <input
  type="text"
  placeholder="Cerca per modello, targa, marca..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="vehicle-search"
/>

      <h1>Gestione Veicoli</h1>
      <button onClick={() => handleOpenModal()} className="add-vehicle-btn">
        ➕ Aggiungi Veicolo 
      </button>

      <div className="vehicle-list">
  {veicoli.length === 0 ? (
    <p>Nessun veicolo disponibile.</p>
  ) : (
    veicoliOrdinati.filter((v) =>
      v.modello.toLowerCase().includes(search.toLowerCase()) ||
      v.marca.toLowerCase().includes(search.toLowerCase()) ||
      v.targa.toLowerCase().includes(search.toLowerCase())
    ).map((veicolo) => (
      <div
        key={veicolo.id}
        className="vehicle-card"
        onClick={() => handleOpenDetailModal(veicolo)} // Apre il modal con i dettagli
        style={{ cursor: 'pointer' }}
      >
        {veicolo.immagine && (
          <img
            src={veicolo.immagine}
            alt="Veicolo"
            className="vehicle-image"
            style={{
              maxHeight: '140px',
              width: '100%',
              objectFit: 'cover',
              borderRadius: '8px',
            }}
          />
        )}
        <h3>{veicolo.modello}</h3>
<div className="vehicle-info-grid-card">
  <div><strong>Prezzo:</strong> {veicolo.prezzo}€</div>
  <div><strong>Km:</strong> {veicolo.km}</div>
  <div><strong>Colore:</strong> {veicolo.colore}</div>
  <div><strong>Anno:</strong> {veicolo.anno}</div>
</div>
<div className="scadenze-label">Scadenze</div>
  <div className="scadenze-indicatori">
    <span className={`pallino ${getScadenzaColor(veicolo.scadenze?.assicurazione)}`} title="Assicurazione"></span>
    <span className={`pallino ${getScadenzaColor(veicolo.scadenze?.bollo)}`} title="Bollo"></span>
    <span className={`pallino ${getScadenzaColor(veicolo.scadenze?.revisione)}`} title="Revisione"></span>
  </div>

<div className={`badge ${isDisponibile(veicolo) ? 'available' : 'unavailable'}`}>
  {isDisponibile(veicolo) ? '🟢 Disponibile oggi' : '🔴 Occupato oggi'}
</div>
<div className="badge info">
  🕒 Libero per {calcolaDisponibilitaConsecutiva(veicolo)} giorni
</div>

      </div>
    ))
  )}
</div>

<VehicleDetailModal
  isOpen={detailModalOpen}
  onClose={handleCloseDetailModal}
  veicolo={selectedVeicolo}
  prenotazioni={prenotazioni}
  onUpdate={handleUpdate}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onAddDamage={handleAddManualDamage}
  onDeleteDamage={handleDeleteDamagePhoto}
  damageModalOpen={damageModalOpen}
  setDamageModalOpen={setDamageModalOpen}
  selectedDamagePhoto={selectedDamagePhoto}
  setSelectedDamagePhoto={setSelectedDamagePhoto}
  mostraManutenzioni={mostraManutenzioni}
  setMostraManutenzioni={setMostraManutenzioni}
  manutenzioneRef={manutenzioneRef}
  nuovaManutenzione={nuovaManutenzione}
  setNuovaManutenzione={setNuovaManutenzione}
  onAddManutenzione={handleAddManutenzione}
  onDeleteManutenzione={handleDeleteManutenzione}
  onToggleRepairStatus={handleToggleRepairStatus}
/>



{/* Modal per la visualizzazione della foto del danno */}
<Modal
  isOpen={damageModalOpen}
  onRequestClose={() => setDamageModalOpen(false)}
  className={{
    base: 'Modal',
    afterOpen: 'Modal--after-open',
    beforeClose: 'Modal--before-close',
  }}
  overlayClassName={{
    base: 'Overlay',
    afterOpen: 'Overlay--after-open',
    beforeClose: 'Overlay--before-close',
  }}
>
  <div style={{ textAlign: 'center' }}>
    {selectedDamagePhoto && (
      <img
        src={selectedDamagePhoto}
        alt="Foto Danno"
        style={{ maxWidth: '90%', maxHeight: '90vh', borderRadius: '10px' }}
      />
    )}
    <button onClick={() => setDamageModalOpen(false)} className="close-damage-modal-btn" style={{ marginTop: '20px' }}>
      Chiudi
    </button>
  </div>
</Modal>


      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onRequestClose={handleCloseModal}
        className={{
          base: 'Modal',
          afterOpen: 'Modal--after-open',
          beforeClose: 'Modal--before-close',
        }}
        overlayClassName={{
          base: 'Overlay',
          afterOpen: 'Overlay--after-open',
          beforeClose: 'Overlay--before-close',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{editingVeicolo ? 'Modifica Veicolo' : 'Aggiungi Veicolo'}</h2>
          <button
            onClick={handleCloseModal}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            ✖
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vehicle-form two-columns">
          {/* Bottone Carica Immagine */}
          <div className="form-group full-width">
            <label>Immagine Veicolo</label>
            <button
              type="button"
              onClick={handleImageSelect}
              style={{
                padding: '10px 16px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '10px'
              }}
            >
              📁 Carica Immagine
            </button>

            {formData.immagine && (
              <img
                src={formData.immagine}
                alt="Anteprima"
                style={{
                  marginTop: '10px',
                  maxWidth: '100%',
                  borderRadius: '8px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                }}
              />
            )}
          </div>

          {/* Altri campi input */}
          <div className="form-group"><label>Modello</label><input type="text" name="modello" value={formData.modello} onChange={handleChange} required /></div>
          <div className="form-group"><label>Marca</label><input type="text" name="marca" value={formData.marca} onChange={handleChange} /></div>
          <div className="form-group"><label>Targa</label><input type="text" name="targa" value={formData.targa} onChange={handleChange} /></div>
          <div className="form-group"><label>Anno</label><input type="number" name="anno" value={formData.anno} onChange={handleChange} /></div>
          <div className="form-group"><label>Prezzo Giornaliero</label><input type="number" name="prezzo" value={formData.prezzo} onChange={handleChange} /></div>
          <div className="form-group"><label>Colore</label><input type="text" name="colore" value={formData.colore} onChange={handleChange} /></div>
          <div className="form-group"><label>KM</label><input type="number" name="km" value={formData.km} onChange={handleChange} /></div>
          <div className="form-group"><label>Porte</label><input type="number" name="porte" value={formData.porte} onChange={handleChange} /></div>

          {/* Select Carburante */}
          <div className="form-group">
            <label>Carburante</label>
            <select name="carburante" value={formData.carburante} onChange={handleChange}>
              <option value="">Seleziona...</option>
              <option value="Benzina">Benzina</option>
              <option value="Diesel">Diesel</option>
              <option value="GPL">GPL</option>
              <option value="Elettrico">Elettrico</option>
              <option value="Ibrido">Ibrido</option>
            </select>
          </div>

          {/* Select Cambio */}
          <div className="form-group">
            <label>Cambio</label>
            <select name="cambio" value={formData.cambio} onChange={handleChange}>
              <option value="">Seleziona...</option>
              <option value="Manuale">Manuale</option>
              <option value="Automatico">Automatico</option>
              <option value="Semi-automatico">Semi-automatico</option>
            </select>
          </div>

          {/* Select Categoria */}
          <div className="form-group">
  <label>Categoria</label>
  <select
    name="categoria"
    value={formData.categoria}
    onChange={handleChange}
  >
    <option value="">Seleziona...</option>
    <option value="City Car">City Car</option>
    <option value="SUV">SUV</option>
    <option value="Furgone">Furgone</option>
    <option value="Lusso">Lusso</option>
    <option value="Sportiva">Sportiva</option>
    <option value="Motociclo">Motociclo</option>
    <option value="Imbarcazione">Imbarcazione</option>
    <option value="Acquascooter">Acquascooter</option>
    <option value="Mini Van">Mini Van</option>
    <option value="Utilitaria">Utilitaria</option>
    <option value="Berlina">Berlina</option>
    <option value="Elettrica">Elettrica</option>
    <option value="Ibrida">Ibrida</option>
  </select>
</div>

             

          {/* Note */}
          <div className="form-group full-width">
            <label>Note</label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows="3"
              style={{ width: '100%', borderRadius: '6px', padding: '10px', fontSize: '14px' }}
            />
          </div>

          {/* Date Scadenze */}
<div className="form-group full-width">
  <label>Scadenza Assicurazione</label>
  <input
    type="date"
    name="assicurazione"
    value={formData.scadenze.assicurazione}
    onChange={(e) => setFormData(prev => ({
      ...prev,
      scadenze: { ...prev.scadenze, assicurazione: e.target.value }
    }))}
  />
</div>

<div className="form-group full-width">
  <label>Scadenza Bollo</label>
  <input
    type="date"
    name="bollo"
    value={formData.scadenze.bollo}
    onChange={(e) => setFormData(prev => ({
      ...prev,
      scadenze: { ...prev.scadenze, bollo: e.target.value }
    }))}
  />
</div>

<div className="form-group full-width">
  <label>Scadenza Revisione</label>
  <input
    type="date"
    name="revisione"
    value={formData.scadenze.revisione}
    onChange={(e) => setFormData(prev => ({
      ...prev,
      scadenze: { ...prev.scadenze, revisione: e.target.value }
    }))}
  />
</div>


          <button type="submit" className="save-btn">
            {editingVeicolo ? 'Salva Modifiche' : 'Aggiungi Veicolo'}
          </button>
        </form>
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
