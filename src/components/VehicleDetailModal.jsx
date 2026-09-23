import React from "react";
import Modal from "react-modal";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import itLocale from "@fullcalendar/core/locales/it";
import { useNavigate } from "react-router-dom";
import {
  Car, CalendarPlus, Pencil, Trash2, X, Plus, ImageOff, AlertTriangle,
  CalendarDays, Gauge, Palette, Fuel, Cog, DoorOpen, Euro, Wrench,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import "../styles/VehicleDetailModal.css";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { updatePrenotazione } from "../store/prenotazioniSlice";
import { isPrenotazioneVisibile, segnaDannoPrenotazioneRiparato } from "../lib/firestorePrenotazioni";
import { disponibiliPerCategoria } from "../utils/disponibilitaCategoria";
import { SCADENZE_VEICOLO, coloreScadenza, testoScadenza, formattaData } from "../utils/scadenze";

// Schede della finestra. Danni e Manutenzioni solo nella versione completa
// (dalla Dashboard la scheda si apre in sola consultazione, `modalLite`).
const SCHEDE = [
  { id: "panoramica", etichetta: "Panoramica" },
  { id: "calendario", etichetta: "Calendario" },
  { id: "danni", etichetta: "Danni", soloCompleta: true },
  { id: "manutenzioni", etichetta: "Manutenzioni", soloCompleta: true },
];

// Data locale in formato YYYY-MM-DD. toISOString() userebbe l'ora UTC: in
// Italia la mezzanotte del giorno diventerebbe le 22 del giorno prima.
const giornoLocale = (data) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;

const CLASSI_MODALE = (base) => ({
  base,
  afterOpen: "Modal--after-open",
  beforeClose: "Modal--before-close",
});

const CLASSI_OVERLAY = {
  base: "Overlay",
  afterOpen: "Overlay--after-open",
  beforeClose: "Overlay--before-close",
};

const DANNO_VUOTO = () => ({
  file: null,
  anteprima: "",
  descrizione: "",
  daRiparare: false,
  data: giornoLocale(new Date()),
});

const VehicleDetailModal = ({
  isOpen,
  onClose,
  veicolo,
  onUpdate,
  onEdit,
  onDelete,
  onAddDamage,
  onDeleteDamage,
  damageModalOpen,
  setDamageModalOpen,
  selectedDamagePhoto,
  setSelectedDamagePhoto,
  nuovaManutenzione,
  setNuovaManutenzione,
  onAddManutenzione,
  onDeleteManutenzione,
  onToggleRepairStatus,
  modalLite = false,
  prenotazioni,
  veicoli = [],
  holds = [],
}) => {
  const navigate = useNavigate();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [scheda, setScheda] = React.useState("panoramica");
  const [formDannoAperto, setFormDannoAperto] = React.useState(false);
  const [nuovoDanno, setNuovoDanno] = React.useState(DANNO_VUOTO);
  const [salvandoDanno, setSalvandoDanno] = React.useState(false);
  const fileInputRef = React.useRef();
  const dispatch = useDispatch();

  // Ogni veicolo si apre sulla Panoramica, con il form del danno chiuso.
  React.useEffect(() => {
    setScheda("panoramica");
    setFormDannoAperto(false);
  }, [veicolo?.id]);

  // Prima cambiava solo lo stato a schermo e si perdeva riaprendo il
  // gestionale: ora scrive su Firestore e poi aggiorna lo stato.
  const handleTogglePrenotazioneRepair = async (prenotazioneId) => {
    const prenotazione = prenotazioni.find((p) => p.id === prenotazioneId);
    if (!prenotazione) return;

    try {
      const campi = await segnaDannoPrenotazioneRiparato(prenotazioneId);
      dispatch(updatePrenotazione({ ...prenotazione, ...campi }));
      toast.success("Danno della prenotazione segnato come riparato.");
    } catch (error) {
      console.error("Errore salvataggio riparazione:", error);
      toast.error("Non sono riuscito a salvare la riparazione. Riprova.");
    }
  };

  const onRestoreFromRepairHistory = (index) => {
    const danno = veicolo.storicoRiparazioni[index];
    const storicoRestante = veicolo.storicoRiparazioni.filter((_, i) => i !== index);
    const aggiornato = {
      ...veicolo,
      danni: [...(veicolo.danni || []), { ...danno, daRiparare: true }],
      storicoRiparazioni: storicoRestante,
    };
    onUpdate(aggiornato, "Danno riportato tra quelli da riparare.");
  };

  const scegliFotoDanno = (file) => {
    if (!file) return;
    if (nuovoDanno.anteprima) URL.revokeObjectURL(nuovoDanno.anteprima);
    setNuovoDanno((prev) => ({ ...prev, file, anteprima: URL.createObjectURL(file) }));
  };

  const togliFotoDanno = () => {
    if (nuovoDanno.anteprima) URL.revokeObjectURL(nuovoDanno.anteprima);
    setNuovoDanno((prev) => ({ ...prev, file: null, anteprima: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const salvaNuovoDanno = async () => {
    if (!nuovoDanno.file || !nuovoDanno.descrizione || salvandoDanno) return;
    setSalvandoDanno(true);
    const { anteprima, ...dati } = nuovoDanno;
    const ok = await onAddDamage(dati);
    setSalvandoDanno(false);
    if (ok) {
      if (anteprima) URL.revokeObjectURL(anteprima);
      setNuovoDanno(DANNO_VUOTO());
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFormDannoAperto(false);
    }
  };

  if (!veicolo) return null;

  // Prenotazioni che occupano davvero il veicolo: niente annullate, richieste
  // del sito non pagate/scadute (prima coloravano di rosso giorni liberi) e
  // noleggi gia' conclusi.
  const prenotazioniValide = prenotazioni.filter(
    (p) => p.status !== "completata" && isPrenotazioneVisibile(p)
  );

  // Un giorno e' occupato se c'e' una prenotazione su questa targa, oppure se
  // la categoria e' piena quel giorno per hold/prenotazioni del sito non ancora
  // assegnati a un veicolo (stessa regola dell'etichetta sulla card). Il
  // controllo di categoria serve la flotta: senza (es. dalla Dashboard) si
  // guarda solo la targa.
  const isGiornoOccupato = (dateStr) => {
    const perTarga = prenotazioniValide.some(
      (p) => p.targa === veicolo.targa && p.dataInizio <= dateStr && p.dataFine >= dateStr
    );
    if (perTarga) return true;
    if (!veicolo.categoria || veicoli.length === 0) return false;
    return disponibiliPerCategoria(veicolo.categoria, dateStr, dateStr, veicoli, prenotazioniValide, holds) === 0;
  };

  // Calendario: si colorano le celle del giorno (libero / occupato /
  // passato) invece di sovrapporre blocchi colorati.
  const classiGiorno = (info) => {
    if (info.isOther) return [];
    const giorno = giornoLocale(info.date);
    if (giorno < giornoLocale(new Date())) return ["vd-giorno--passato"];
    return [isGiornoOccupato(giorno) ? "vd-giorno--occupato" : "vd-giorno--libero"];
  };

  const apriPrenotazioneDaData = (dateStr) => {
    if (!dateStr) return;

    if (dateStr < giornoLocale(new Date())) {
      toast.info("Non si può prenotare un giorno già passato.");
      return;
    }

    if (isGiornoOccupato(dateStr)) {
      toast.info("Questo giorno non è prenotabile per il veicolo selezionato.");
      return;
    }

    navigate("/booking", {
      state: {
        targaSelezionata: veicolo.targa,
        modelloSelezionato: veicolo.modello,
        prezzoSelezionato: veicolo.prezzo,
        dataSelezionata: dateStr,
      },
    });
  };

  const handleCalendarDateClick = (info) => {
    apriPrenotazioneDaData(info.dateStr);
  };


  const nuovaPrenotazione = () => {
    navigate("/booking", {
      state: {
        targaSelezionata: veicolo.targa,
        modelloSelezionato: veicolo.modello,
        prezzoSelezionato: veicolo.prezzo,
      },
    });
  };

  const apriFoto = (immagine) => {
    if (!immagine) return;
    setSelectedDamagePhoto(immagine);
    setDamageModalOpen(true);
  };

  const oggi = giornoLocale(new Date());
  const nome = [veicolo.marca, veicolo.modello].filter(Boolean).join(" ") || "Veicolo senza nome";
  const liberoOggi = !isGiornoOccupato(oggi);
  const prezzoDaTariffa = "prezzoVeicolo" in veicolo && veicolo.categoria;

  const prossimePrenotazioni = prenotazioniValide
    .filter((p) => p.targa === veicolo.targa && p.dataFine >= oggi)
    .sort((a, b) => String(a.dataInizio).localeCompare(String(b.dataInizio)));

  const danni = veicolo.danni || [];
  const storico = veicolo.storicoRiparazioni || [];
  const danniRiconsegne = prenotazioni.filter(
    (p) => p.targa === veicolo.targa && p.status === "completata" && (p.descrizioneDanno || p.fotoDanni)
  );
  const daRiparare =
    danni.filter((d) => d.daRiparare).length + danniRiconsegne.filter((p) => p.daRiparare).length;

  const manutenzioni = veicolo.manutenzioni || [];
  const totaleManutenzioni = manutenzioni.reduce((acc, m) => acc + parseFloat(m.costo || 0), 0);

  const schede = SCHEDE.filter((s) => !modalLite || !s.soloCompleta);

  const datiVeicolo = [
    { etichetta: "Anno", valore: veicolo.anno, Icona: CalendarDays },
    { etichetta: "Km", valore: veicolo.km ? Number(veicolo.km).toLocaleString("it-IT") : "", Icona: Gauge },
    { etichetta: "Colore", valore: veicolo.colore, Icona: Palette },
    { etichetta: "Carburante", valore: veicolo.carburante, Icona: Fuel },
    { etichetta: "Cambio", valore: veicolo.cambio, Icona: Cog },
    { etichetta: "Porte", valore: veicolo.porte, Icona: DoorOpen },
  ];

  const euro = (valore) =>
    `€ ${Number(valore || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const aggiungiManutenzione = (e) => {
    if (e.key && e.key !== "Enter") return;
    e.preventDefault?.();
    onAddManutenzione();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onRequestClose={onClose}
        className={CLASSI_MODALE("Modal vd-modal")}
        overlayClassName={CLASSI_OVERLAY}
      >
        <div className="vd">
          {/* Intestazione fissa: chi e' il veicolo, com'e' messo oggi e le
              azioni principali, sempre visibili senza scorrere. */}
          <header className="vd-testa">
            <div className="vd-foto">
              {veicolo.immagine ? (
                <img src={veicolo.immagine} alt={nome} />
              ) : (
                <Car size={30} aria-hidden="true" />
              )}
            </div>
            <div className="vd-titoli">
              <h2 className="vd-nome">{nome}</h2>
              <div className="vd-meta">
                {veicolo.targa && <span className="vd-targa">{veicolo.targa}</span>}
                {veicolo.categoria && <span className="vd-categoria">{veicolo.categoria}</span>}
                <span className={`vd-stato ${liberoOggi ? "vd-stato--libero" : "vd-stato--occupato"}`}>
                  {liberoOggi ? "Disponibile oggi" : "Occupato oggi"}
                </span>
              </div>
            </div>
            <div className="vd-azioni">
              <button type="button" className="vd-btn vd-btn--primario" onClick={nuovaPrenotazione}>
                <CalendarPlus size={16} aria-hidden="true" /> Nuova prenotazione
              </button>
              {!modalLite && (
                <>
                  <button type="button" className="vd-btn" onClick={onEdit}>
                    <Pencil size={16} aria-hidden="true" /> Modifica
                  </button>
                  <button
                    type="button"
                    className="vd-btn vd-btn--icona vd-btn--pericolo"
                    onClick={() => setConfirmDeleteOpen(true)}
                    title="Elimina veicolo"
                    aria-label="Elimina veicolo"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </>
              )}
              <button type="button" className="vd-chiudi" onClick={onClose} aria-label="Chiudi">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="vd-schede" role="tablist">
            {schede.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={scheda === s.id}
                className={`vd-scheda ${scheda === s.id ? "attiva" : ""}`}
                onClick={() => setScheda(s.id)}
              >
                {s.etichetta}
                {s.id === "danni" && daRiparare > 0 && (
                  <span className="vd-contatore vd-contatore--allerta">{daRiparare}</span>
                )}
                {s.id === "manutenzioni" && manutenzioni.length > 0 && (
                  <span className="vd-contatore">{manutenzioni.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="vd-contenuto" role="tabpanel">
            {scheda === "panoramica" && (
              <>
                {!modalLite && daRiparare > 0 && (
                  <button type="button" className="vd-avviso" onClick={() => setScheda("danni")}>
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>
                      {daRiparare === 1 ? "1 danno da riparare" : `${daRiparare} danni da riparare`}
                    </span>
                    <span className="vd-avviso-link">Vedi danni →</span>
                  </button>
                )}

                <section className="vd-sezione">
                  <h3 className="vd-titolo-sezione">Dati del veicolo</h3>
                  <div className="vd-dati">
                    {datiVeicolo.map(({ etichetta, valore, Icona }) => (
                      <div key={etichetta} className="vd-dato">
                        <span className="vd-dato-icona" aria-hidden="true"><Icona size={18} /></span>
                        <span className="vd-dato-testi">
                          <span className="vd-dato-etichetta">{etichetta}</span>
                          <span className={`vd-dato-valore ${valore ? "" : "vd-dato-valore--vuoto"}`}>
                            {valore || "Non indicato"}
                          </span>
                        </span>
                      </div>
                    ))}
                    <div className="vd-dato vd-dato--prezzo">
                      <span className="vd-dato-icona" aria-hidden="true"><Euro size={18} /></span>
                      <span className="vd-dato-testi">
                        <span className="vd-dato-etichetta">Prezzo al giorno</span>
                        <span className="vd-dato-valore">
                          {veicolo.prezzo ? `€ ${Number(veicolo.prezzo).toLocaleString("it-IT")}` : "Non indicato"}
                        </span>
                        {prezzoDaTariffa && (
                          <span className="prezzo-da-tariffa">tariffa {veicolo.categoria}</span>
                        )}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="vd-sezione">
                  <h3 className="vd-titolo-sezione">Scadenze</h3>
                  <ul className="vd-scadenze">
                    {SCADENZE_VEICOLO.map(({ chiave, nome: nomeScadenza }) => {
                      const data = veicolo.scadenze?.[chiave];
                      return (
                        <li key={chiave} className={`vd-scadenza vd-scadenza--${coloreScadenza(data)}`}>
                          <span className="vd-scadenza-nome">{nomeScadenza}</span>
                          <span className="vd-scadenza-data">{formattaData(data)}</span>
                          <span className="vd-scadenza-stato">{testoScadenza(data)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                {veicolo.note && (
                  <section className="vd-sezione">
                    <h3 className="vd-titolo-sezione">Note</h3>
                    <p className="vd-note">{veicolo.note}</p>
                  </section>
                )}
              </>
            )}

            {scheda === "calendario" && (
              <>
                <section className="vd-sezione">
                  <div className="vd-calendario">
                    <FullCalendar
                      plugins={[dayGridPlugin]}
                      initialView="dayGridMonth"
                      headerToolbar={{ left: "title", center: "", right: "today prev,next" }}
                      locale={itLocale}
                      buttonText={{ today: "Oggi" }}
                      height="auto"
                      fixedWeekCount={false}
                      showNonCurrentDates={true}
                      dayCellClassNames={classiGiorno}
                      dateClick={handleCalendarDateClick}
                    />
                  </div>
                  <div className="vd-legenda">
                    <span><i className="vd-legenda-punto vd-legenda-punto--libero" /> Libero</span>
                    <span><i className="vd-legenda-punto vd-legenda-punto--occupato" /> Occupato</span>
                    <span><i className="vd-legenda-punto vd-legenda-punto--oggi" /> Oggi</span>
                    <span className="vd-legenda-nota">Clicca un giorno libero per creare una prenotazione.</span>
                  </div>
                </section>

                <section className="vd-sezione">
                  <h3 className="vd-titolo-sezione">Prossime prenotazioni</h3>
                  {prossimePrenotazioni.length > 0 ? (
                    <ul className="vd-prenotazioni">
                      {prossimePrenotazioni.map((p) => (
                        <li key={p.id}>
                          <span className="vd-periodo">
                            {formattaData(p.dataInizio)} → {formattaData(p.dataFine)}
                          </span>
                          <span className="vd-cliente">{p.cliente || "Cliente non indicato"}</span>
                          {p.dataInizio <= oggi && <span className="vd-etichetta vd-etichetta--info">In corso</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="vd-vuoto">Nessuna prenotazione in arrivo per questo veicolo.</p>
                  )}
                </section>
              </>
            )}

            {scheda === "danni" && !modalLite && (
              <>
                <section className="vd-sezione">
                  <div className="vd-barra-sezione">
                    <h3 className="vd-titolo-sezione">Danni sul veicolo</h3>
                    {!formDannoAperto && (
                      <button type="button" className="vd-btn" onClick={() => setFormDannoAperto(true)}>
                        <Plus size={16} aria-hidden="true" /> Aggiungi danno
                      </button>
                    )}
                  </div>

                  {formDannoAperto && (
                    <div className="vd-form-danno">
                      <div className="vd-form-danno-foto">
                        {nuovoDanno.anteprima ? (
                          <>
                            <img src={nuovoDanno.anteprima} alt="Anteprima del danno" />
                            <button type="button" className="vd-link vd-link--pericolo" onClick={togliFotoDanno}>
                              Togli foto
                            </button>
                          </>
                        ) : (
                          <button type="button" className="vd-scegli-foto" onClick={() => fileInputRef.current?.click()}>
                            <Plus size={20} aria-hidden="true" />
                            Scegli foto
                          </button>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          ref={fileInputRef}
                          hidden
                          onChange={(e) => scegliFotoDanno(e.target.files[0])}
                        />
                      </div>
                      <div className="vd-form-danno-campi">
                        <label className="vd-campo">
                          <span>Descrizione</span>
                          <input
                            type="text"
                            placeholder="Es. graffio sul paraurti posteriore"
                            value={nuovoDanno.descrizione}
                            onChange={(e) => setNuovoDanno((prev) => ({ ...prev, descrizione: e.target.value }))}
                          />
                        </label>
                        <label className="vd-spunta">
                          <input
                            type="checkbox"
                            checked={nuovoDanno.daRiparare}
                            onChange={(e) => setNuovoDanno((prev) => ({ ...prev, daRiparare: e.target.checked }))}
                          />
                          Da riparare (altrimenti resta come danno preesistente)
                        </label>
                        <div className="vd-form-azioni">
                          <button type="button" className="vd-btn" onClick={() => setFormDannoAperto(false)} disabled={salvandoDanno}>
                            Annulla
                          </button>
                          <button
                            type="button"
                            className="vd-btn vd-btn--primario"
                            onClick={salvaNuovoDanno}
                            disabled={!nuovoDanno.file || !nuovoDanno.descrizione || salvandoDanno}
                          >
                            {salvandoDanno ? "Salvataggio…" : "Salva danno"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {danni.length > 0 ? (
                    <div className="vd-griglia-danni">
                      {danni.map((danno, i) => (
                        <article key={i} className="vd-danno">
                          <button
                            type="button"
                            className="vd-danno-foto"
                            onClick={() => apriFoto(danno.immagine)}
                            aria-label="Ingrandisci la foto del danno"
                          >
                            {danno.immagine ? <img src={danno.immagine} alt="" /> : <ImageOff size={22} aria-hidden="true" />}
                          </button>
                          <div className="vd-danno-corpo">
                            <span className={`vd-etichetta ${danno.daRiparare ? "vd-etichetta--allerta" : "vd-etichetta--neutra"}`}>
                              {danno.daRiparare ? "Da riparare" : "Preesistente"}
                            </span>
                            <p className="vd-danno-desc">{danno.descrizione || "—"}</p>
                            {danno.data && <span className="vd-danno-data">{formattaData(danno.data)}</span>}
                            <div className="vd-danno-azioni">
                              <button type="button" className="vd-link" onClick={() => onToggleRepairStatus(i)}>
                                {danno.daRiparare ? "Segna come riparato" : "Segna da riparare"}
                              </button>
                              <button type="button" className="vd-link vd-link--pericolo" onClick={() => onDeleteDamage(i)}>
                                Elimina
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="vd-vuoto">Nessun danno registrato sul veicolo.</p>
                  )}
                </section>

                <section className="vd-sezione">
                  <h3 className="vd-titolo-sezione">Danni rilevati alle riconsegne</h3>
                  {danniRiconsegne.length > 0 ? (
                    <div className="vd-griglia-danni">
                      {danniRiconsegne.map((p) => {
                        const foto = p.fotoDanni ? (Array.isArray(p.fotoDanni) ? p.fotoDanni : [p.fotoDanni]) : [];
                        return (
                          <article key={p.id} className="vd-danno">
                            <button
                              type="button"
                              className="vd-danno-foto"
                              onClick={() => apriFoto(foto[0])}
                              aria-label="Ingrandisci la foto del danno"
                            >
                              {foto[0] ? <img src={foto[0]} alt="" /> : <ImageOff size={22} aria-hidden="true" />}
                              {foto.length > 1 && <span className="vd-danno-altre">+{foto.length - 1}</span>}
                            </button>
                            <div className="vd-danno-corpo">
                              <span className={`vd-etichetta ${p.daRiparare ? "vd-etichetta--allerta" : "vd-etichetta--ok"}`}>
                                {p.daRiparare ? "Da riparare" : "Riparato"}
                              </span>
                              <p className="vd-danno-desc">{p.descrizioneDanno || "Danno senza descrizione"}</p>
                              <span className="vd-danno-data">
                                Noleggio {formattaData(p.dataInizio)} → {formattaData(p.dataFine)}
                                {p.cliente ? ` · ${p.cliente}` : ""}
                              </span>
                              {p.daRiparare && (
                                <div className="vd-danno-azioni">
                                  <button type="button" className="vd-link" onClick={() => handleTogglePrenotazioneRepair(p.id)}>
                                    Segna come riparato
                                  </button>
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="vd-vuoto">Nessun danno segnalato alla riconsegna.</p>
                  )}
                </section>

                <section className="vd-sezione">
                  <h3 className="vd-titolo-sezione">Storico riparazioni</h3>
                  {storico.length > 0 ? (
                    <div className="vd-griglia-danni">
                      {storico.map((danno, i) => (
                        <article key={i} className="vd-danno">
                          <button
                            type="button"
                            className="vd-danno-foto"
                            onClick={() => apriFoto(danno.immagine)}
                            aria-label="Ingrandisci la foto del danno"
                          >
                            {danno.immagine ? <img src={danno.immagine} alt="" /> : <ImageOff size={22} aria-hidden="true" />}
                          </button>
                          <div className="vd-danno-corpo">
                            <span className="vd-etichetta vd-etichetta--ok">Riparato</span>
                            <p className="vd-danno-desc">{danno.descrizione || "—"}</p>
                            <span className="vd-danno-data">Riparato il {formattaData(danno.riparatoIn)}</span>
                            <div className="vd-danno-azioni">
                              <button type="button" className="vd-link" onClick={() => onRestoreFromRepairHistory(i)}>
                                Riporta tra i danni
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="vd-vuoto">Nessuna riparazione registrata.</p>
                  )}
                </section>
              </>
            )}

            {scheda === "manutenzioni" && !modalLite && (
              <>
                <section className="vd-sezione">
                  <h3 className="vd-titolo-sezione">Nuova manutenzione</h3>
                  {/* Un div e non un <form>: le regole generiche ".Modal form" di
                      schedaModal.css metterebbero tutto in colonna. Invio aggiunge. */}
                  <div className="vd-nuova-manutenzione" onKeyDown={aggiungiManutenzione}>
                    <label className="vd-campo">
                      <span>Data</span>
                      <input
                        type="date"
                        value={nuovaManutenzione.data}
                        onChange={(e) => setNuovaManutenzione((prev) => ({ ...prev, data: e.target.value }))}
                      />
                    </label>
                    <label className="vd-campo">
                      <span>Descrizione</span>
                      <input
                        type="text"
                        placeholder="Es. tagliando, cambio gomme…"
                        value={nuovaManutenzione.descrizione}
                        onChange={(e) => setNuovaManutenzione((prev) => ({ ...prev, descrizione: e.target.value }))}
                      />
                    </label>
                    <label className="vd-campo">
                      <span>Costo (€)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={nuovaManutenzione.costo}
                        onChange={(e) => setNuovaManutenzione((prev) => ({ ...prev, costo: e.target.value }))}
                      />
                    </label>
                    <button type="button" className="vd-btn vd-btn--primario" onClick={aggiungiManutenzione}>
                      <Plus size={16} aria-hidden="true" /> Aggiungi
                    </button>
                  </div>
                </section>

                <section className="vd-sezione">
                  <h3 className="vd-titolo-sezione">Storico manutenzioni</h3>
                  {manutenzioni.length > 0 ? (
                    <table className="vd-tabella">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Descrizione</th>
                          <th className="vd-num">Costo</th>
                          <th aria-label="Azioni" />
                        </tr>
                      </thead>
                      <tbody>
                        {manutenzioni.map((m, i) => (
                          <tr key={i}>
                            <td className="vd-tabella-data">{formattaData(m.data)}</td>
                            <td>{m.descrizione}</td>
                            <td className="vd-num">{euro(m.costo)}</td>
                            <td className="vd-num">
                              <button
                                type="button"
                                className="vd-btn vd-btn--icona vd-btn--pericolo vd-btn--piccolo"
                                onClick={() => onDeleteManutenzione(i)}
                                title="Elimina manutenzione"
                                aria-label="Elimina manutenzione"
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2}>Totale ({manutenzioni.length})</td>
                          <td className="vd-num">{euro(totaleManutenzioni)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <div className="vd-vuoto">
                      <Wrench size={22} aria-hidden="true" />
                      Nessuna manutenzione registrata.
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={damageModalOpen}
        onRequestClose={() => setDamageModalOpen(false)}
        className={CLASSI_MODALE("Modal vd-modal-foto")}
        overlayClassName={CLASSI_OVERLAY}
      >
        <div className="vd-foto-grande">
          {selectedDamagePhoto && <img src={selectedDamagePhoto} alt="Foto del danno" />}
          <button type="button" className="vd-btn" onClick={() => setDamageModalOpen(false)}>
            Chiudi
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          await onDelete(veicolo.id);
          setConfirmDeleteOpen(false);
          onClose();
        }}
        message={`Eliminare ${nome}${veicolo.targa ? ` (${veicolo.targa})` : ""}? Verranno persi anche danni e manutenzioni registrati.`}
        title="Elimina veicolo"
        confirmLabel="Elimina"
        tone="danger"
      />
    </>
  );
};

export default VehicleDetailModal;
