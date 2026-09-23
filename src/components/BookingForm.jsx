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
import { creaCliente, messaggioErroreCliente } from '../lib/firestoreClienti';
import DatePicker from 'react-datepicker';
import { it } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import { giorniOccupati } from '../utils/regolePrenotazione';
import SceltaVeicolo from './SceltaVeicolo';
import { preparaCliente, validaCliente } from '../utils/validaCliente';
import './BookingForm.css';
import '../styles/Prenotazione.css';


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
  cliente: yup.string().required('Scrivi o cerca il cliente'),
  codiceFiscale: yup
    .string()
    .required('Il codice fiscale è obbligatorio')
    .matches(/^[A-Z0-9]{16}$/i, 'Codice fiscale non valido: servono 16 lettere e numeri'),
  patente: yup.string().required('Il numero della patente è obbligatorio'),
  veicolo: yup.string().required('Scegli un veicolo'),
  targa: yup.string().required('Scegli un veicolo'),
  dataInizio: yup.string().required('Scegli il giorno del ritiro'),
  dataFine: yup.string().required('Scegli il giorno della riconsegna'),
  prezzoGiornaliero: yup
    .number()
    .typeError('Inserisci un numero valido')
    .positive('Deve essere maggiore di zero')
    .required('Il prezzo al giorno è obbligatorio'),
  emailCliente: yup
    .string()
    .email('Email non valida')
    .required('L’email è obbligatoria'),
});

function BookingForm({
  onSubmit,
  initialValues,
  availableVehicles,
  veicoli = [],
  holds = [],
  clienti = [],
  prenotazioni = [],
  salvando = false,
  onAnnulla,
}) {
  const dispatch = useDispatch();
  const [clienteSelezionato, setClienteSelezionato] = useState(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [nuovoClienteData, setNuovoClienteData] = useState(emptyClientFormData);

  const handleNuovoClienteChange = (e) => {
    const { name, value } = e.target;
    setNuovoClienteData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNuovoClienteSubmit = async (e) => {
    e.preventDefault();
    // La finestra del nuovo cliente e' dentro questo form nell'albero React:
    // senza fermarlo, il submit arriverebbe anche alla prenotazione e la salverebbe.
    e.stopPropagation();

    // Stessi controlli della pagina Clienti.
    const nuovoCliente = preparaCliente(nuovoClienteData);
    const errori = validaCliente(nuovoCliente, clienti);
    if (Object.keys(errori).length > 0) {
      toast.error(Object.values(errori)[0]);
      return;
    }

    try {
      // Salva solo il nuovo cliente (prima si riscrivevano tutti i clienti).
      const salvato = await creaCliente(nuovoCliente);
      dispatch(addCliente(salvato));
      toast.success('Cliente salvato con successo.');

      setClienteSelezionato(salvato);
      setNuovoClienteData(emptyClientFormData);
      setShowAddClient(false);
    } catch (error) {
      console.error('Errore salvataggio cliente:', error);
      toast.error(messaggioErroreCliente(error, 'Errore durante il salvataggio del cliente'));
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

  // Giorni gia' noleggiati per il veicolo scelto: non si possono scegliere nel
  // calendario. Contano solo le prenotazioni attive (non le annullate o i
  // pagamenti del sito falliti/scaduti, che prima bloccavano le date).
  const disabledDates = giorniOccupati({ targa: watchTarga, prenotazioni, idEscluso: bookingId })
    .map((g) => new Date(`${g}T12:00:00`));

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

  const giorni = dataInizio && dataFine ? calcolaGiorniNoleggio(dataInizio, dataFine) : 0;
  const totale = calcolaPrezzoTotale();
  const erroriPresenti = Object.keys(errors).length > 0;
  const classeCampo = (nome) => `pz-campo ${errors[nome] ? 'pz-campo--errore' : ''}`;
  const errore = (nome) => errors[nome] && <p className="pz-errore" role="alert">{errors[nome].message}</p>;
  const scegliData = (campo) => (date) => {
    if (!date) {
      setValue(campo, '', { shouldValidate: true });
      return;
    }
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];
    setValue(campo, localDate, { shouldValidate: true });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pz pz-form" noValidate>
      <header className="pz-testa">
        <div>
          <h2 className="pz-titolo">{bookingId ? 'Modifica prenotazione' : 'Nuova prenotazione'}</h2>
          <span className="pz-sottotitolo">
            Km, carburante, accessori e contratto si compilano il giorno del ritiro, con «Consegna».
          </span>
        </div>
      </header>

      <div className="pz-corpo">
        <section className="pz-sezione">
          <h3 className="pz-titolo-sezione">Cliente</h3>
          <div className="pz-griglia pz-griglia--2">
            <div className={`${classeCampo('cliente')} pz-intera`}>
              <span className="pz-etichetta">Nome e cognome <span className="pz-obbligatorio">*</span></span>
              <AutocompleteClienti
                clienti={clienti}
                onSelect={(cliente) => setClienteSelezionato(cliente)}
                onInputChange={(value) => setValue('cliente', value, { shouldValidate: true })}
                initialValue={initialValues?.cliente || ''}
              />
              <input type="hidden" {...register('cliente')} />
              {errore('cliente') || (
                <button type="button" className="pz-link" onClick={() => setShowAddClient(true)}>
                  + Nuovo cliente in anagrafica
                </button>
              )}
            </div>
            <label className={classeCampo('codiceFiscale')}>
              <span className="pz-etichetta">Codice fiscale <span className="pz-obbligatorio">*</span></span>
              <input {...register('codiceFiscale')} placeholder="Es. RSSMRA80A01H501U" style={{ textTransform: 'uppercase' }} />
              {errore('codiceFiscale')}
            </label>
            <label className={classeCampo('patente')}>
              <span className="pz-etichetta">Numero patente <span className="pz-obbligatorio">*</span></span>
              <input {...register('patente')} placeholder="Es. AB1234567" />
              {errore('patente')}
            </label>
            <label className={`${classeCampo('emailCliente')} pz-intera`}>
              <span className="pz-etichetta">Email <span className="pz-obbligatorio">*</span></span>
              <input type="email" {...register('emailCliente')} placeholder="nome@esempio.it" />
              {errore('emailCliente')}
            </label>
          </div>
        </section>

        <section className="pz-sezione">
          <h3 className="pz-titolo-sezione">Periodo e veicolo</h3>
          <div className="pz-griglia pz-griglia--2">
            <label className={classeCampo('dataInizio')}>
              <span className="pz-etichetta">Ritiro <span className="pz-obbligatorio">*</span></span>
              <DatePicker
                locale={it}
                selected={dataInizio ? new Date(dataInizio) : null}
                onChange={scegliData('dataInizio')}
                excludeDates={disabledDates}
                dateFormat="dd/MM/yyyy"
                placeholderText="gg/mm/aaaa"
              />
              {errore('dataInizio')}
            </label>
            <label className={classeCampo('dataFine')}>
              <span className="pz-etichetta">Riconsegna <span className="pz-obbligatorio">*</span></span>
              <DatePicker
                locale={it}
                selected={dataFine ? new Date(dataFine) : null}
                onChange={scegliData('dataFine')}
                excludeDates={disabledDates}
                minDate={dataInizio ? new Date(dataInizio) : null}
                dateFormat="dd/MM/yyyy"
                placeholderText="gg/mm/aaaa"
              />
              {errore('dataFine')}
            </label>
            <div className={`${classeCampo('targa')} pz-intera`}>
              <span className="pz-etichetta">Veicolo <span className="pz-obbligatorio">*</span></span>
              <SceltaVeicolo
                veicoli={veicoliSelezionabili.map((v) => veicoli.find((x) => x.targa === v.targa) || v)}
                targaScelta={watchTarga}
                targaIniziale={initialValues?.targa}
                onScegli={(v) => setValue('targa', v.targa, { shouldValidate: true, shouldDirty: true })}
                inizio={dataInizio}
                fine={dataFine}
                prenotazioni={prenotazioni}
                holds={holds}
                idEscluso={bookingId}
              />
              <input type="hidden" {...register('targa')} />
              <input type="hidden" {...register('veicolo')} />
              {errore('targa')}
            </div>
          </div>
        </section>

        <section className="pz-sezione">
          <h3 className="pz-titolo-sezione">Prezzo</h3>
          <div className="pz-griglia pz-griglia--2">
            <label className={classeCampo('prezzoGiornaliero')}>
              <span className="pz-etichetta">Prezzo al giorno (€) <span className="pz-obbligatorio">*</span></span>
              <input type="number" step="0.01" min="0" {...register('prezzoGiornaliero')} placeholder="Es. 30" />
              {errore('prezzoGiornaliero') || (confrontoListino.stato !== 'nessuno' && (
                <p className={`pz-aiuto listino-${confrontoListino.stato}`}>
                  Listino: {euro(confrontoListino.listino)} al giorno
                  {confrontoListino.stato === 'sopra' && ` · concordato +${euro(confrontoListino.differenza)}`}
                  {confrontoListino.stato === 'sotto' && ` · concordato ${euro(confrontoListino.differenza)}`}
                </p>
              ))}
            </label>
            <label className="pz-campo">
              <span className="pz-etichetta">Totale{giorni ? ` · ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}` : ''}</span>
              <input readOnly value={totale === '' ? '' : euro(totale)} placeholder="—" />
            </label>
          </div>
        </section>
      </div>

      <footer className="pz-piede">
        {erroriPresenti && <span className="pz-piede-nota pz-piede-nota--errore">Controlla i campi segnati in rosso.</span>}
        {onAnnulla && (
          <button type="button" className="vd-btn" onClick={onAnnulla} disabled={salvando}>Annulla</button>
        )}
        <button type="submit" className="vd-btn vd-btn--primario" disabled={salvando}>
          {salvando ? 'Salvataggio…' : bookingId ? 'Salva modifiche' : 'Salva prenotazione'}
        </button>
      </footer>

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
