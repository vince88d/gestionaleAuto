import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Modal from 'react-modal';
import { X } from 'lucide-react';
import { calcolaGiorniNoleggio } from '../utils/giorniNoleggio';
import { confrontaConListino, devoApplicareListino, prezzoIniziale } from '../utils/prezzoListino';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import AutocompleteClienti from './AutocompleteClienti';
import ClientForm from './ClientForm';
import { addCliente } from '../store/clientiSlice';
import { writeClienti } from '../lib/firestoreClienti';
import DatePicker from 'react-datepicker';
import { it } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import { disponibiliPerCategoria } from '../utils/disponibilitaCategoria';
import './BookingForm.css';

const normalizzaCodiceFiscale = (value) => (value || '').trim().toUpperCase();

const emptyClientFormData = {
  nome: '',
  cognome: '',
  email: '',
  telefono: '',
  indirizzo: '',
  luogoNascita: '',
  dataNascita: '',
  tipoDocumento: '',
  tipoDocumentoAltro: '',
  documento: '',
  codiceFiscale: '',
  patente: '',
  piva: '',
};

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

function BookingForm({
  onSubmit,
  initialValues,
  availableVehicles,
  veicoli = [],
  holds = [],
  clienti = [],
  prenotazioni = [],
}) {
  const dispatch = useDispatch();
  const [clienteSelezionato, setClienteSelezionato] = useState(null);
  const [disabledDates, setDisabledDates] = useState([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [nuovoClienteData, setNuovoClienteData] = useState(emptyClientFormData);

  const handleNuovoClienteChange = (e) => {
    const { name, value } = e.target;
    setNuovoClienteData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNuovoClienteSubmit = async (e) => {
    e.preventDefault();

    const codiceFiscaleNormalizzato = normalizzaCodiceFiscale(nuovoClienteData.codiceFiscale);
    const patenteNormalizzata = (nuovoClienteData.patente || '').trim();

    if (!patenteNormalizzata) {
      toast.error('Inserisci la patente prima di salvare il cliente.');
      return;
    }

    const codiceFiscaleDuplicato = clienti.some(
      (cliente) => normalizzaCodiceFiscale(cliente.codiceFiscale) === codiceFiscaleNormalizzato
    );

    if (codiceFiscaleDuplicato) {
      toast.error('Esiste gia un cliente con questo codice fiscale.');
      return;
    }

    try {
      const tipoDocumentoFinale =
        nuovoClienteData.tipoDocumento === 'Altro'
          ? (nuovoClienteData.tipoDocumentoAltro || '').trim()
          : nuovoClienteData.tipoDocumento;
      const nuovoCliente = {
        ...nuovoClienteData,
        codiceFiscale: codiceFiscaleNormalizzato,
        patente: patenteNormalizzata,
        tipoDocumento: tipoDocumentoFinale,
        storicoDanni: [],
      };

      await writeClienti([...clienti, nuovoCliente]);
      dispatch(addCliente(nuovoCliente));
      toast.success('Cliente salvato con successo.');

      setClienteSelezionato(nuovoCliente);
      setNuovoClienteData(emptyClientFormData);
      setShowAddClient(false);
    } catch (error) {
      console.error('Errore salvataggio cliente:', error);
      toast.error('Errore durante il salvataggio del cliente');
    }
  };

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

  // Il prezzo giornaliero parte dal listino dell'auto ma il gestore può cambiarlo.
  // Il listino si applica solo quando sceglie un'auto diversa: aggiornare la lista
  // dei veicoli o riaprire una prenotazione non deve rimettere a listino il prezzo
  // concordato.
  const targaAllineata = useRef(initialValues?.targa || '');

  useEffect(() => {
    if (watchTarga && availableVehicles) {
      const selectedVehicle = availableVehicles.find((v) => v.targa === watchTarga);
      if (selectedVehicle) {
        setValue('veicolo', selectedVehicle.modello || '');
        if (devoApplicareListino({ targaScelta: watchTarga, targaAllineata: targaAllineata.current })) {
          setValue('prezzoGiornaliero', selectedVehicle.prezzo || '');
          targaAllineata.current = watchTarga;
        }
      } else {
        setValue('veicolo', '');
        setValue('prezzoGiornaliero', '');
        targaAllineata.current = '';
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
    targaAllineata.current = initialValues?.targa || '';

    if (initialValues?.targa && availableVehicles?.length > 0) {
      const selected = availableVehicles.find((v) => v.targa === initialValues.targa);
      if (selected) {
        setValue('veicolo', selected.modello || initialValues.veicolo || '');
        // Un prezzo già salvato (anche diverso dal listino) resta com'è.
        setValue(
          'prezzoGiornaliero',
          prezzoIniziale({ prezzoSalvato: initialValues.prezzoGiornaliero, listino: selected.prezzo }),
        );
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

  // Anche se questa targa specifica non ha conflitti diretti, la sua
  // categoria potrebbe essere già "esaurita" da hold/prenotazioni del sito
  // (che non sono legati a una targa precisa finché lo staff non la
  // assegna): in tal caso nessun veicolo di quella categoria va dato,
  // altrimenti si supera la flotta disponibile per quelle date.
  const categoriaSatura = (vehicle) => {
    if (!vehicle?.categoria || !dataInizio || !dataFine) return false;
    return (
      disponibiliPerCategoria(vehicle.categoria, dataInizio, dataFine, veicoli, prenotazioni, holds, {
        escludiPrenotazioneId: bookingId,
      }) <= 0
    );
  };

  // Listino dell'auto scelta (dall'elenco completo, non dalla voce di ripiego che
  // usa il prezzo della prenotazione) e scarto rispetto al prezzo applicato.
  const listinoAuto = (veicoli.find((v) => v.targa === watchTarga) || {}).prezzo;
  const confrontoListino = confrontaConListino(prezzoGiornaliero, listinoAuto);
  const euro = (valore) => `${Number(valore).toFixed(2).replace('.', ',')} €`;

  const calcolaPrezzoTotale = () => {
    if (!dataInizio || !dataFine || !prezzoGiornaliero) return '';
    const giorni = calcolaGiorniNoleggio(dataInizio, dataFine);
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
        <button type="button" className="add-client-link" onClick={() => setShowAddClient(true)}>
          + Aggiungi nuovo cliente
        </button>
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
            const categoriaEsaurita = !isUnavailable && categoriaSatura(vehicle);
            const nonSelezionabile = isUnavailable || categoriaEsaurita;
            return (
              <option
                key={vehicle.targa}
                value={vehicle.targa}
                disabled={nonSelezionabile && vehicle.targa !== initialValues?.targa}
              >
                {vehicle.modello} - {vehicle.targa}
                {dataInizio && dataFine
                  ? isUnavailable
                    ? ' | occupato nel periodo'
                    : categoriaEsaurita
                      ? ' | categoria esaurita (hold sul sito)'
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
        {confrontoListino.stato !== 'nessuno' && (
          <p className={`listino-info listino-${confrontoListino.stato}`}>
            Listino: {euro(confrontoListino.listino)} al giorno
            {confrontoListino.stato === 'sopra' && ` · prezzo concordato: +${euro(confrontoListino.differenza)} al giorno`}
            {confrontoListino.stato === 'sotto' && ` · prezzo concordato: ${euro(confrontoListino.differenza)} al giorno`}
          </p>
        )}
        <p className="error">{errors.prezzoGiornaliero?.message}</p>
      </div>

      <div className="form-group">
        <label>Prezzo Totale (EUR)</label>
        <input type="number" value={calcolaPrezzoTotale()} readOnly />
      </div>

      <button type="submit" className="full-width">Avanti</button>

      <Modal
        isOpen={showAddClient}
        onRequestClose={() => setShowAddClient(false)}
        contentLabel="Aggiungi Cliente"
        ariaHideApp={false}
        className="AddClientModal"
        overlayClassName="AddClientOverlay"
        style={{ content: {}, overlay: {} }}
      >
        <div className="modal-header">
          <h2>Aggiungi Cliente</h2>
          <button type="button" className="btn-close" onClick={() => setShowAddClient(false)}>
            <X size={22} />
          </button>
        </div>
        <div
          className="AddClientScrollArea"
          onWheel={(e) => {
            e.currentTarget.scrollTop += e.deltaY;
          }}
        >
          <ClientForm
            formData={nuovoClienteData}
            onChange={handleNuovoClienteChange}
            onSubmit={handleNuovoClienteSubmit}
          />
        </div>
      </Modal>
    </form>
  );
}

export default BookingForm;
