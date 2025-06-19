import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import AutocompleteClienti from './AutocompleteClienti';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import './BookingForm.css';




const schema = yup.object().shape({
 cliente: yup.string().required("Il nome e cognome sono obbligatori"),
 codiceFiscale: yup
  .string()
  .matches(/^[A-Z0-9]{16}$/, "Codice fiscale non valido")
  .required("Il codice fiscale è obbligatorio"),
 patente: yup.string().required("Il numero della patente è obbligatorio"),
 veicolo: yup.string().required("Il modello del veicolo è obbligatorio"),
 targa: yup.string().required("La targa è obbligatoria"),
 dataInizio: yup.string().required("La data di inizio è obbligatoria"),
 dataFine: yup.string().required("La data di fine è obbligatoria"),
 prezzoGiornaliero: yup
  .number()
  .typeError("Inserisci un numero valido")
  .positive("Deve essere maggiore di zero")
  .required("Il prezzo giornaliero è obbligatorio"),
 emailCliente: yup
  .string()
  .email("Email non valida")
  .required("Email cliente obbligatoria"),
});


function BookingForm({ onSubmit, initialValues, availableVehicles, clienti = [], prenotazioni = [] }) {
 const [clienteSelezionato, setClienteSelezionato] = useState(null);
 const [disabledDates, setDisabledDates] = useState([]);

  const {
  register,
  handleSubmit,
  watch,
  reset,
  setValue,
  formState: { errors },
 } = useForm({
  resolver: yupResolver(schema),
  defaultValues: { ...initialValues }
 });

 console.log('BookingForm - Initial Values:', initialValues);
 console.log('BookingForm - Available Vehicles Prop:', availableVehicles);

 useEffect(() => {
  console.log('BookingForm - useEffect: Resettando il form con:', initialValues);
  reset({ ...initialValues });
 }, [initialValues, reset]);

 useEffect(() => {
  if (clienteSelezionato) {
    setValue("cliente", `${clienteSelezionato.nome} ${clienteSelezionato.cognome}`);
    setValue("emailCliente", clienteSelezionato.email || '');
    setValue("telefono", clienteSelezionato.telefono || '');
    setValue("documento", clienteSelezionato.documento || '');
    setValue("codiceFiscale", clienteSelezionato.codiceFiscale || '');
    setValue("patente", clienteSelezionato.patente || '');
  }
}, [clienteSelezionato, setValue]);


 // Aggiorna il modello del veicolo quando la targa cambia (opzionale, ma utile)
 const watchTarga = watch("targa");


 useEffect(() => {
  
  if (watchTarga && availableVehicles) {
   const selectedVehicle = availableVehicles.find(v => v.targa === watchTarga);
   if (selectedVehicle) {
  console.log('BookingForm - useEffect: Veicolo trovato per la targa:', selectedVehicle);
  setValue("veicolo", selectedVehicle.modello || '');
  setValue("prezzoGiornaliero", selectedVehicle.prezzo || ''); // ← Aggiungi questa riga
} else {
  console.log('BookingForm - useEffect: Nessun veicolo trovato per la targa, resettando modello.');
  setValue("veicolo", '');
  setValue("prezzoGiornaliero", ''); // ← E resetta anche il prezzo se la targa non combacia
}
  }
 }, [watchTarga, availableVehicles, setValue]);


useEffect(() => {
  if (!watchTarga || !prenotazioni?.length) {
    setDisabledDates([]);
    return;
  }

  const occupate = [];
  prenotazioni.forEach(p => {
    if (p.targa === watchTarga && p.status !== 'completata') {
      const start = new Date(p.dataInizio);
      const end = new Date(p.dataFine);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        occupate.push(new Date(d));
      }
    }
  });

  setDisabledDates(occupate);
}, [watchTarga, prenotazioni]);




// Forza il set del modello veicolo se inizialmente presente ma non ancora settato
useEffect(() => {
  console.log('BookingForm - useEffect: Resettando il form con:', initialValues);
  reset({ ...initialValues });
  
  // Forza il set del modello veicolo se inizialmente presente
  if (initialValues?.targa && availableVehicles?.length > 0) {
    const selected = availableVehicles.find(v => v.targa === initialValues.targa);
    if (selected) {
      setValue("veicolo", selected.modello || initialValues.veicolo || '');
      setValue("prezzoGiornaliero", selected.prezzo || initialValues.prezzoGiornaliero || '');
    }
  }
},

[initialValues, reset, availableVehicles, setValue]);
 const dataInizio = watch("dataInizio");
 const dataFine = watch("dataFine");
 const prezzoGiornaliero = watch("prezzoGiornaliero");

 const calcolaPrezzoTotale = () => {
  if (!dataInizio || !dataFine || !prezzoGiornaliero) return '';
  const start = new Date(dataInizio);
  const end = new Date(dataFine);
  const diff = end - start;
  const giorni = diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  return giorni * parseFloat(prezzoGiornaliero || 0);
 };

 return (
  <form onSubmit={handleSubmit(onSubmit)} className="booking-form">
<div className="form-group">
  <label>Seleziona Cliente</label>
  <AutocompleteClienti
    clienti={clienti}
    onSelect={(cliente) => setClienteSelezionato(cliente)}
  />
</div>

   <div className="form-group">
    <label>Codice Fiscale</label>
    <input {...register("codiceFiscale")} placeholder="Es. RSSMRA80A01H501U" />
    <p className="error">{errors.codiceFiscale?.message}</p>
   </div>

   <div className="form-group">
    <label>Numero Patente</label>
    <input {...register("patente")} placeholder="Es. AB1234567" />
    <p className="error">{errors.patente?.message}</p>
   </div>

   <div className="form-group">
    <label>Email Cliente</label>
    <input type="email" {...register("emailCliente")} placeholder="email@email.com" />
    <p className="error">{errors.emailCliente?.message}</p>
   </div>

   <div className="form-group">
    <label>Modello Veicolo</label>
    <input {...register("veicolo")} placeholder="Fiat Panda"  /> {/* Ora è readonly, si popola dalla targa */}
    <p className="error">{errors.veicolo?.message}</p>
   </div>

   <div className="form-group">
    <label htmlFor="targa">Targa Veicolo</label>
    <select {...register("targa")} disabled={!availableVehicles || availableVehicles.length === 0}>
     <option value="">Seleziona un veicolo</option>
     {[...availableVehicles, ...(initialValues?.targa
  ? availableVehicles.some(v => v.targa === initialValues.targa) ? [] : [{
      targa: initialValues.targa,
      modello: initialValues.veicolo || 'Veicolo Selezionato'
    }]
  : []
)].map(vehicle => (
  <option key={vehicle.targa} value={vehicle.targa}>
    {vehicle.targa} ({vehicle.modello})
  </option>
))}
    </select>
    <p className="error">{errors.targa?.message}</p>
   </div>

<div className="form-group">
  <label>Data Inizio</label>
<DatePicker
  selected={dataInizio ? new Date(dataInizio) : null}
 onChange={(date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString().split('T')[0];
  setValue("dataInizio", localDate);
}}

  excludeDates={disabledDates}
  dateFormat="dd-MM-yyyy"
  className="custom-datepicker"
/>

  <p className="error">{errors.dataInizio?.message}</p>
</div>


<div className="form-group">
  <label>Data Fine</label>
  <DatePicker
    selected={dataFine ? new Date(dataFine) : null}
    onChange={(date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString().split('T')[0];
  setValue("dataFine", localDate);
}}

    excludeDates={disabledDates}
    dateFormat="dd-MM-yyyy"
    className="custom-datepicker"
  />
  <p className="error">{errors.dataFine?.message}</p>
</div>



   <div className="form-group">
    <label>Prezzo Giornaliero (€)</label>
    <input type="number" step="0.01" {...register("prezzoGiornaliero")} placeholder="Es. 30" />
    <p className="error">{errors.prezzoGiornaliero?.message}</p>
   </div>

   <div className="form-group">
    <label>Prezzo Totale (€)</label>
    <input type="number" value={calcolaPrezzoTotale()} readOnly />
   </div>

   <button type="submit" className="full-width">Avanti</button>
  </form>

 );
}

export default BookingForm;