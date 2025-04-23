import React, {useEffect} from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

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

function BookingForm({ onSubmit,initialValues }) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: initialValues || {
      cliente: '',
      codiceFiscale: '',
      patente: '',
      veicolo: '',
      targa: '',
      dataInizio: '',
      dataFine: '',
      prezzoGiornaliero: '',
      emailCliente: '',
    }
  });
  
  useEffect(() => {
    if (initialValues) {
      reset(initialValues);
    }
  }, [initialValues, reset]);

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
    <label>Nome e Cognome</label>
    <input {...register("cliente")} placeholder="Es. Mario Rossi" />
    <p className="error">{errors.cliente?.message}</p>
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
    <input {...register("veicolo")} placeholder="Fiat Panda" />
    <p className="error">{errors.veicolo?.message}</p>
  </div>

  <div className="form-group">
    <label>Targa</label>
    <input {...register("targa")} placeholder="AB123CD" />
    <p className="error">{errors.targa?.message}</p>
  </div>

  <div className="form-group">
    <label>Data Inizio</label>
    <input type="date" {...register("dataInizio")} />
    <p className="error">{errors.dataInizio?.message}</p>
  </div>

  <div className="form-group">
    <label>Data Fine</label>
    <input type="date" {...register("dataFine")} />
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
