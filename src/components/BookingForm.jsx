import React from 'react';

function BookingForm({ formData, onChange, onSubmit, handleChange }) {
  return (
    <form onSubmit={onSubmit} className="booking-form">
      <div className="form-group">
        <label>Nome e Cognome</label>
        <input
          type="text"
          name="cliente"
          placeholder="Es. Mario Rossi"
          value={formData.cliente}
          onChange={onChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Codice Fiscale</label>
        <input
          type="text"
          name="codiceFiscale"
          placeholder="Es. RSSMRA80A01H501U"
          value={formData.codiceFiscale}
          onChange={onChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Numero Patente</label>
        <input
          type="text"
          name="patente"
          placeholder="Es. AB1234567"
          value={formData.patente}
          onChange={onChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Modello Veicolo</label>
        <input
          type="text"
          name="veicolo"
          placeholder="Es. Fiat Panda"
          value={formData.veicolo}
          onChange={onChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Targa</label>
        <input
          type="text"
          name="targa"
          placeholder="Es. AB123CD"
          value={formData.targa}
          onChange={onChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Data Inizio</label>
        <input
          type="date"
          name="dataInizio"
          value={formData.dataInizio}
          onChange={onChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Data Fine</label>
        <input
          type="date"
          name="dataFine"
          value={formData.dataFine}
          onChange={onChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Prezzo Giornaliero (€)</label>
        <input
          type="number"
          name="prezzoGiornaliero"
          placeholder="Es. 30"
          value={formData.prezzoGiornaliero}
          onChange={onChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Prezzo Totale (€)</label>
        <input
          type="number"
          name="prezzoTotale"
          value={formData.prezzoTotale}
          readOnly
        />
      </div>
      <div className="form-group">
        <label >Email Cliente</label>
        <input
  type="email"
  name="emailCliente"
  value={formData.emailCliente}
  onChange={onChange}
  placeholder="Email del Cliente"
  required
/>

      </div>

      <button type="submit">Salva</button>
    </form>
  );
}

export default BookingForm;
