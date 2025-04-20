import React, { useState } from 'react';
import './Vehicle.css'

function Vehicles() {
  const [formData, setFormData] = useState({
    modello: '',
    targa: '',
    marca: '',
    anno: '',
    prezzo: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(formData);  // Qui potrai inviare i dati a un backend o salvarli nel tuo stato globale
    alert('Veicolo aggiunto!');
  };

  return (
    <div className="vehicles-wrapper">
    <h1>Aggiungi Veicolo</h1>
    <form onSubmit={handleSubmit} className="vehicle-form">
      <div className="form-group">
        <label htmlFor="modello">Modello</label>
        <input type="text" id="modello" name="modello" value={formData.modello} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label htmlFor="targa">Targa</label>
        <input type="text" id="targa" name="targa" value={formData.targa} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label htmlFor="marca">Marca</label>
        <input type="text" id="marca" name="marca" value={formData.marca} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label htmlFor="anno">Anno</label>
        <input type="number" id="anno" name="anno" value={formData.anno} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label htmlFor="prezzo">Prezzo al giorno (€)</label>
        <input type="number" id="prezzo" name="prezzo" value={formData.prezzo} onChange={handleChange} required />
      </div>
      <button type="submit">Aggiungi Veicolo</button>
    </form>
  </div>
  
  );
}

export default Vehicles;
