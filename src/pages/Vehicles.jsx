import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setVeicoli, addVeicolo, updateVeicolo, deleteVeicolo } from '../store/veicoliSlice';
import { toast } from 'react-toastify';
import Modal from 'react-modal';
import './Vehicle.css';

Modal.setAppElement('#root');


const emptyFormData = {
  id:'',
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
  danni:[],
  prenotazioni: [],
};

function Vehicles() {
  const veicoli = useSelector((state) => state.veicoli);
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
      setFormData(veicolo);
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
      const conferma = window.confirm('Hai modifiche non salvate. Vuoi chiudere comunque?');
      if (!conferma) return; // Se non conferma, NON chiudere il modal
    }
    setSelectedVeicolo(null);
  setOriginalVeicolo(null);
  setDetailModalOpen(false);
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
    if (!window.confirm('Sei sicuro di voler eliminare questo veicolo?')) return;
    try {
      const nuovaLista = veicoli.filter((v) => v.id !== id);
      dispatch(deleteVeicolo(id));
      await window.electronAPI.writeVeicoli(nuovaLista);
      toast.success('Veicolo eliminato!');
    } catch (error) {
      console.error('Errore eliminazione:', error);
      toast.error('Errore durante eliminazione.');
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
  
    const conferma = window.confirm('Sei sicuro di voler eliminare questa foto?');
    if (!conferma) return;
  
    // Aggiorna solo lo stato locale
    const danniAggiornati = selectedVeicolo.danni.filter((_, i) => i !== index);
    const aggiornato = { ...selectedVeicolo, danni: danniAggiornati };
    setSelectedVeicolo(aggiornato);
  
    toast.info('Foto eliminata. Ricorda di salvare le modifiche!');
  };
  const prenotazioni = useSelector((state) => state.prenotazioni);
const prenotazioniAttive = prenotazioni.filter(p => p.status !== 'completata');

const isDisponibile = (veicolo) => {
  const oggi = new Date().toISOString().split('T')[0];
  return !prenotazioniAttive.some(p =>
    p.targa === veicolo.targa &&
    p.dataInizio <= oggi &&
    p.dataFine >= oggi
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
    veicoli.filter((v) =>
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
<p><strong>Prezzo:</strong> {veicolo.prezzo}€</p>
<p><strong>Km:</strong> {veicolo.km}</p>
<p><strong>Colore:</strong> {veicolo.colore}</p>
<div className={`badge ${isDisponibile(veicolo) ? 'available' : 'unavailable'}`}>
  {isDisponibile(veicolo) ? '🟢 Disponibile' : '🔴 Occupato'}
</div>

      </div>
    ))
  )}
</div>
<Modal
  isOpen={detailModalOpen}
  onRequestClose={handleCloseDetailModal}
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
  {selectedVeicolo && (
    <div className="vehicle-detail">
       <button 
        onClick={handleCloseDetailModal}
        className="close-detail-modal-btn"
        style={{
          position: 'absolute',
          top: '15px',
          right: '15px',
          background: 'none',
          border: 'none',
          fontSize: '1.5rem',
          cursor: 'pointer',
          color: '#666',
          zIndex: 10
        }}
      >
        ✖
      </button>
      <h2>{selectedVeicolo.modello} - {selectedVeicolo.marca}</h2>

      {selectedVeicolo.immagine && (
        <img
          src={selectedVeicolo.immagine}
          alt="Immagine veicolo"
          className="vehicle-detail-image"
          style={{ maxHeight: '250px', objectFit: 'cover', borderRadius: '10px', marginBottom: '20px' }}
        />
      )}

      <div className="vehicle-info-grid">
        <p><strong>Targa:</strong> {selectedVeicolo.targa}</p>
        <p><strong>Anno:</strong> {selectedVeicolo.anno}</p>
        <p><strong>Prezzo Giornaliero:</strong> {selectedVeicolo.prezzo} €</p>
        <p><strong>Colore:</strong> {selectedVeicolo.colore}</p>
        <p><strong>KM:</strong> {selectedVeicolo.km}</p>
        <p><strong>Porte:</strong> {selectedVeicolo.porte}</p>
        <p><strong>Carburante:</strong> {selectedVeicolo.carburante}</p>
        <p><strong>Cambio:</strong> {selectedVeicolo.cambio}</p>
        <p><strong>Categoria:</strong> {selectedVeicolo.categoria}</p>
      </div>

      {selectedVeicolo.note && (
        <div className="vehicle-note">
          <h4>Note:</h4>
          <p>{selectedVeicolo.note}</p>
        </div>
      )}

      <div className="vehicle-damages-section">
      {selectedVeicolo.danni && selectedVeicolo.danni.length > 0 ? (
        <div className="damage-gallery">
  {selectedVeicolo.danni.map((danno, index) => (
    <div key={index} className="damage-photo-wrapper">
      <img
        src={danno}
        alt={`Danno ${index + 1}`}
        onClick={() => { setSelectedDamagePhoto(danno); setDamageModalOpen(true); }}
        className="damage-photo"
      />
      <button
        className="delete-damage-btn"
        onClick={() => handleDeleteDamagePhoto(index)}
      >
        ✖
      </button>
    </div>
  ))}
</div>
) : (
  <p>Nessun danno registrato.</p>
)}

        <h4>Danni del veicolo:</h4>
        {/* Qui poi inseriamo il caricamento immagini danni */}
        <button onClick={handleAddDamagePhoto} className="add-damage-btn">
          ➕ Aggiungi Foto Danno
        </button>
      </div>

      <div className="vehicle-actions">
        <button className="save-btn"
    onClick={async () => {
    try {
      // Aggiorna Redux e salva nel database
      dispatch(updateVeicolo(selectedVeicolo));
      const nuovaLista = veicoli.map((v) => 
        v.id === selectedVeicolo.id ? selectedVeicolo : v
      );
      await window.electronAPI.writeVeicoli(nuovaLista);

      toast.success('Modifiche salvate con successo!');
      handleCloseDetailModal();
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
      toast.error('Errore durante il salvataggio delle modifiche.');
    }
  }} 
  
>
  Salva 
        </button>
        <button onClick={() => { handleCloseDetailModal(); handleOpenModal(selectedVeicolo); }} className="edit-btn">Modifica</button>
        <button onClick={() => { handleDelete(selectedVeicolo.id); handleCloseDetailModal(); }} className="delete-btn">Elimina</button>
        
      </div>
    </div>
  )}
</Modal>
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
            <select name="categoria" value={formData.categoria} onChange={handleChange}>
              <option value="">Seleziona...</option>
              <option value="City Car">City Car</option>
              <option value="SUV">SUV</option>
              <option value="Furgone">Furgone</option>
              <option value="Lusso">Lusso</option>
              <option value="Sportiva">Sportiva</option>
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

          <button type="submit" className="save-btn">
            {editingVeicolo ? 'Salva Modifiche' : 'Aggiungi Veicolo'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

export default Vehicles;
