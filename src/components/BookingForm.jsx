import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import AutocompleteClienti from './AutocompleteClienti';
import DatePicker from 'react-datepicker';
import { it } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import './BookingForm.css';

const schema = yup.object().shape({
  cliente: yup.string().required('Il nome e cognome sono obbligatori'),
  codiceFiscale: yup
    .string()
    .matches(/^[A-Z0-9]{16}$/, 'Codice fiscale non valido')
    .required('Il codice fiscale e obbligatorio'),
  patente: yup.string().required('Il numero della patente e obbligatorio'),
  veicolo: yup.string().required('Il modello del veicolo e obbligatorio'),
  targa: yup.string().required('La targa e obbligatoria'),
  dataInizio: yup.string().required('La data di inizio e obbligatoria'),
  dataFine: yup.string().required('La data di fine e obbligatoria'),
  prezzoGiornaliero: yup
    .number()
    .typeError('Inserisci un numero valido')
    .positive('Deve essere maggiore di zero')
    .required('Il prezzo giornaliero e obbligatorio'),
  emailCliente: yup
    .string()
    .email('Email non valida')
    .required('Email cliente obbligatoria'),
});

function BookingForm({ onSubmit, initialValues, availableVehicles, clienti = [], prenotazioni = [] }) {
  const [clienteSelezionato, setClienteSelezionato] = useState(null);
  const [disabledDates, setDisabledDates] = useState([]);

  const veicoliSelezionabili = [
    ...(availableVehicles || []),
    ...(initialValues?.targa && !(availableVehicles || []).some((v) => v.targa === initialValues.targa)
      ? [
          {
            targa: initialValues.targa,
            modello: initialValues.veicolo || 'Veicolo selezionato',
            prezzo: initialValues.prezzoGiornaliero || '',
          },
        ]
      : []),
  ];

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { ...initialValues },
  });

  useEffect(() => {
    reset({ ...initialValues });
  }, [initialValues, reset]);

  useEffect(() => {
    if (clienteSelezionato) {
      setValue('cliente', `${clienteSelezionato.nome} ${clienteSelezionato.cognome}`);
      setValue('emailCliente', clienteSelezionato.email || '');
      setValue('codiceFiscale', clienteSelezionato.codiceFiscale || '');
      setValue('patente', clienteSelezionato.patente || '');
    }
  }, [clienteSelezionato, setValue]);

  const watchTarga = watch('targa');
  const dataInizio = watch('dataInizio');
  const dataFine = watch('dataFine');
  const prezzoGiornaliero = watch('prezzoGiornaliero');
  const bookingId = initialValues?.id;

  useEffect(() => {
    if (watchTarga && availableVehicles) {
      const selectedVehicle = availableVehicles.find((v) => v.targa === watchTarga);
      if (selectedVehicle) {
        setValue('veicolo', selectedVehicle.modello || '');
        setValue('prezzoGiornaliero', selectedVehicle.prezzo || '');
      } else {
        setValue('veicolo', '');
        setValue('prezzoGiornaliero', '');
      }
    }
  }, [watchTarga, availableVehicles, setValue]);

  useEffect(() => {
    if (!watchTarga || !prenotazioni?.length) {
      setDisabledDates([]);
      return;
    }

    const occupate = [];
    prenotazioni.forEach((prenotazione) => {
      if (
        prenotazione.targa === watchTarga &&
        prenotazione.status !== 'completata' &&
        prenotazione.id !== bookingId
      ) {
        const start = new Date(prenotazione.dataInizio);
        const end = prenotazione.dataRientroEffettiva
          ? new Date(prenotazione.dataRientroEffettiva)
          : new Date(prenotazione.dataFine);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          occupate.push(new Date(d));
        }
      }
    });

    setDisabledDates(occupate);
  }, [watchTarga, prenotazioni, bookingId]);

  useEffect(() => {
    reset({ ...initialValues });

    if (initialValues?.targa && availableVehicles?.length > 0) {
      const selected = availableVehicles.find((v) => v.targa === initialValues.targa);
      if (selected) {
        setValue('veicolo', selected.modello || initialValues.veicolo || '');
        setValue('prezzoGiornaliero', selected.prezzo || initialValues.prezzoGiornaliero || '');
      }
    }
  }, [initialValues, reset, availableVehicles, setValue]);

  const hasVehicleConflict = (vehicleTarga) => {
    if (!vehicleTarga || !dataInizio || !dataFine) return false;

    const start = new Date(dataInizio);
    const end = new Date(dataFine);

    return prenotazioni.some((prenotazione) => {
      if (prenotazione.id === bookingId) return false;
      if (prenotazione.targa !== vehicleTarga) return false;
      if (prenotazione.status === 'completata') return false;

      const bookedStart = new Date(prenotazione.dataInizio);
      const bookedEnd = prenotazione.dataRientroEffettiva
        ? new Date(prenotazione.dataRientroEffettiva)
        : new Date(prenotazione.dataFine);

      return start <= bookedEnd && end >= bookedStart;
    });
  };

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
          onInputChange={(value) => setValue('cliente', value, { shouldValidate: true })}
          initialValue={initialValues?.cliente || ''}
        />
        <input type="hidden" {...register('cliente')} />
        <p className="error">{errors.cliente?.message}</p>
      </div>

      <div className="form-group">
        <label>Codice Fiscale</label>
        <input {...register('codiceFiscale')} placeholder="Es. RSSMRA80A01H501U" />
        <p className="error">{errors.codiceFiscale?.message}</p>
      </div>

      <div className="form-group">
        <label>Numero Patente</label>
        <input {...register('patente')} placeholder="Es. AB1234567" />
        <p className="error">{errors.patente?.message}</p>
      </div>

      <div className="form-group">
        <label>Email Cliente</label>
        <input type="email" {...register('emailCliente')} placeholder="email@email.com" />
        <p className="error">{errors.emailCliente?.message}</p>
      </div>

      <div className="form-group">
        <label>Data Inizio</label>
        <DatePicker
          locale={it}
          selected={dataInizio ? new Date(dataInizio) : null}
          onChange={(date) => {
            const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
              .toISOString()
              .split('T')[0];
            setValue('dataInizio', localDate, { shouldValidate: true });
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
          locale={it}
          selected={dataFine ? new Date(dataFine) : null}
          onChange={(date) => {
            const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
              .toISOString()
              .split('T')[0];
            setValue('dataFine', localDate, { shouldValidate: true });
          }}
          excludeDates={disabledDates}
          dateFormat="dd-MM-yyyy"
          className="custom-datepicker"
        />
        <p className="error">{errors.dataFine?.message}</p>
      </div>

      <div className="form-group">
        <label htmlFor="targa">Veicolo</label>
        <select {...register('targa')} disabled={!availableVehicles || availableVehicles.length === 0}>
          <option value="">Seleziona un veicolo</option>
          {veicoliSelezionabili.map((vehicle) => {
            const isUnavailable = hasVehicleConflict(vehicle.targa);
            return (
              <option
                key={vehicle.targa}
                value={vehicle.targa}
                disabled={isUnavailable && vehicle.targa !== initialValues?.targa}
              >
                {vehicle.modello} - {vehicle.targa}
                {dataInizio && dataFine
                  ? isUnavailable
                    ? ' | occupato nel periodo'
                    : ' | disponibile'
                  : ''}
              </option>
            );
          })}
        </select>
        <small className="availability-hint">
          Prima scegli il periodo, poi seleziona il veicolo disponibile.
        </small>
        <p className="error">{errors.targa?.message}</p>
      </div>

      <div className="form-group">
        <label>Modello Veicolo</label>
        <input {...register('veicolo')} placeholder="Fiat Panda" readOnly />
        <p className="error">{errors.veicolo?.message}</p>
      </div>

      <div className="form-group">
        <label>Prezzo Giornaliero (EUR)</label>
        <input type="number" step="0.01" {...register('prezzoGiornaliero')} placeholder="Es. 30" />
        <p className="error">{errors.prezzoGiornaliero?.message}</p>
      </div>

      <div className="form-group">
        <label>Prezzo Totale (EUR)</label>
        <input type="number" value={calcolaPrezzoTotale()} readOnly />
      </div>

      <button type="submit" className="full-width">Avanti</button>
    </form>
  );
}

export default BookingForm;
