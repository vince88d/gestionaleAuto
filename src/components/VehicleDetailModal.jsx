import React from "react";
import Modal from "react-modal";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { useNavigate } from "react-router-dom";
import { Car } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import "../styles/VehicleDetailModal.css";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { updatePrenotazione } from "../store/prenotazioniSlice";

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
  mostraManutenzioni,
  setMostraManutenzioni,
  manutenzioneRef,
  nuovaManutenzione,
  setNuovaManutenzione,
  onAddManutenzione,
  onDeleteManutenzione,
  onToggleRepairStatus,
  modalLite = false,
  prenotazioni,
}) => {
  const navigate = useNavigate();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [showDanni, setShowDanni] = React.useState(false);
  const [showManualDanni, setShowManualDanni] = React.useState(false);
  const [nuovoDanno, setNuovoDanno] = React.useState({
    immagine: "",
    descrizione: "",
    daRiparare: false,
    data: new Date().toISOString().split("T")[0],
  });
  const fileInputRef = React.useRef();
  const dispatch = useDispatch();

  const handleAddDamage = (e) => {
    e.preventDefault();
    if (!nuovoDanno.immagine || !nuovoDanno.descrizione) {
      toast.error("Inserisci almeno una foto e una descrizione per il danno");
      return;
    }

    onAddDamage(nuovoDanno);
    setNuovoDanno({
      immagine: "",
      descrizione: "",
      daRiparare: false,
      data: new Date().toISOString().split("T")[0],
    });
    fileInputRef.current.value = "";
    toast.success("Danno aggiunto con successo");
  };

  const handleTogglePrenotazioneRepair = (prenotazioneId) => {
    const prenotazione = prenotazioni.find((p) => p.id === prenotazioneId);
    if (!prenotazione) return;

    const prenotazioneAggiornata = {
      ...prenotazione,
      daRiparare: false,
      riparatoIn: new Date().toISOString(),
    };

    dispatch(updatePrenotazione(prenotazioneAggiornata));
    toast.success("Danno della prenotazione segnato come riparato.");
  };

  const onRestoreFromRepairHistory = (index) => {
    const danno = veicolo.storicoRiparazioni[index];
    const storicoRestante = veicolo.storicoRiparazioni.filter(
      (_, i) => i !== index
    );
    const aggiornato = {
      ...veicolo,
      danni: [...veicolo.danni, { ...danno, daRiparare: true }],
      storicoRiparazioni: storicoRestante,
    };
    onUpdate(aggiornato);
    toast.info("Danno riportato tra quelli da riparare.");
  };

  if (!veicolo) return null;

  const getEventiDisponibilità = (veicolo, viewStart, viewEnd) => {
    // Filtra le prenotazioni per questo veicolo (usando la targa)
    const prenotazioniVeicolo = prenotazioni.filter(
      (p) => p.targa === veicolo.targa && p.status !== "completata"
    );

    // Crea un array di tutti i giorni nel range della vista
    const giorni = [];
    const giornoCorrente = new Date(viewStart);

    while (giornoCorrente <= viewEnd) {
      giorni.push(new Date(giornoCorrente));
      giornoCorrente.setDate(giornoCorrente.getDate() + 1);
    }

    // Per ogni giorno, verifica se è occupato da una prenotazione
    return giorni.map((giorno) => {
      const giornoStr = giorno.toISOString().split("T")[0];

      const isOccupato = prenotazioniVeicolo.some((p) => {
        const start = new Date(p.dataInizio);
        const end = new Date(p.dataFine);
        const current = new Date(giornoStr);

        return current >= start && current <= end;
      });

      return {
        start: giornoStr,
        end: giornoStr,
        display: "background",
        backgroundColor: isOccupato ? "#ef9a9a" : "#a5d6a7",
        borderColor: isOccupato ? "#e57373" : "#81c784",
        overlap: false,
      };
    });
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onRequestClose={onClose}
        className={{
          base: "Modal",
          afterOpen: "Modal--after-open",
          beforeClose: "Modal--before-close",
        }}
        overlayClassName={{
          base: "Overlay",
          afterOpen: "Overlay--after-open",
          beforeClose: "Overlay--before-close",
        }}
      >
        <div className="vehicle-detail">
          <button
            onClick={onClose}
            className="close-detail-modal-btn"
            style={{
              position: "absolute",
              top: "15px",
              right: "15px",
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "#666",
              zIndex: 10,
            }}
          >
            ✖
          </button>

          <h2>
            {veicolo.modello} - {veicolo.marca}
          </h2>

          {veicolo.immagine && (
            <img
              src={veicolo.immagine}
              alt="Immagine veicolo"
              className="vehicle-detail-image"
              style={{
                maxHeight: "250px",
                objectFit: "cover",
                borderRadius: "10px",
                marginBottom: "20px",
              }}
            />
          )}

          <div className="vehicle-info-grid">
            <p>
              <strong>Targa:</strong> {veicolo.targa}
            </p>
            <p>
              <strong>Anno:</strong> {veicolo.anno}
            </p>
            <p>
              <strong>Prezzo Giornaliero:</strong> {veicolo.prezzo} €
            </p>
            <p>
              <strong>Colore:</strong> {veicolo.colore}
            </p>
            <p>
              <strong>KM:</strong> {veicolo.km}
            </p>
            <p>
              <strong>Porte:</strong> {veicolo.porte}
            </p>
            <p>
              <strong>Carburante:</strong> {veicolo.carburante}
            </p>
            <p>
              <strong>Cambio:</strong> {veicolo.cambio}
            </p>
            <p>
              <strong>Categoria:</strong> {veicolo.categoria}
            </p>
            <p>
              <strong>Assicurazione:</strong>{" "}
              {veicolo.scadenze?.assicurazione || "—"}
            </p>
            <p>
              <strong>Bollo:</strong> {veicolo.scadenze?.bollo || "—"}
            </p>
            <p>
              <strong>Revisione:</strong> {veicolo.scadenze?.revisione || "—"}
            </p>
          </div>

          {veicolo.note && (
            <div className="vehicle-note">
              <h4>Note:</h4>
              <p>{veicolo.note}</p>
            </div>
          )}

          <div className="vehicle-calendar-wrapper">
            <FullCalendar
              plugins={[dayGridPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,dayGridWeek,dayGridDay",
              }}
              eventSources={[
                {
                  events: (info, successCallback) => {
                    const viewStart = new Date(info.startStr);
                    const viewEnd = new Date(info.endStr);
                    const eventi = getEventiDisponibilità(
                      veicolo,
                      viewStart,
                      viewEnd
                    );
                    successCallback(eventi); // ✅ callback richiesto da FullCalendar
                  },
                },
              ]}
              height="auto"
              dayMaxEventRows={false}
              selectable={false}
              fixedWeekCount={false}
            />
          </div>

          {modalLite ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "30px",
              }}
            >
              <button
                onClick={() => {
                  onClose();
                  navigate("/booking", {
                    state: {
                      targaSelezionata: veicolo.targa,
                      modelloSelezionato: veicolo.modello,
                      prezzoSelezionato: veicolo.prezzo,
                    },
                  });
                }}
                className="prenota-btn"
                style={{
                  backgroundColor: "#007bff",
                  color: "#fff",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  border: "none",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                }}
                onMouseOver={(e) =>
                  (e.target.style.backgroundColor = "#0056b3")
                }
                onMouseOut={(e) => (e.target.style.backgroundColor = "#007bff")}
              >
                <Car size={20} style={{ marginRight: "8px" }} />
                Prenota questo veicolo
              </button>
            </div>
          ) : (
            <>
              <div className="vehicle-damages-toggle">
                <button
                  className="toggle-section-btn"
                  onClick={() => setShowDanni((prev) => !prev)}
                >
                  {showDanni ? "▲ Nascondi Danni" : "▼ Mostra Danni"}
                </button>

                {showDanni && (
                  <div className="vehicle-damages-section">
                    {/* --- Sezione: Danni da prenotazioni concluse --- */}
                    <h4 style={{ marginTop: "20px" }}>
                      🧾 Danni riscontrati durante prenotazioni concluse:
                    </h4>
                    {prenotazioni
                      .filter(
                        (p) =>
                          p.targa === veicolo.targa &&
                          p.status === "completata" &&
                          (p.descrizioneDanno || p.fotoDanni)
                      )
                      .map((p, idx) => (
                        <div key={idx} className="damage-box">
                          <p>
                            <strong>Periodo:</strong> {p.dataInizio} →{" "}
                            {p.dataFine}
                          </p>
                          {p.descrizioneDanno && (
                            <p>
                              <strong>Descrizione:</strong> {p.descrizioneDanno}
                            </p>
                          )}
                          {p.daRiparare && (
                            <div style={{ marginTop: "6px" }}>
                              <p style={{ color: "red", fontWeight: 600 }}>
                                ⚠️ Richiede riparazione
                              </p>
                              <button
                                className="toggle-repair-btn"
                                onClick={() =>
                                  handleTogglePrenotazioneRepair(p.id)
                                }
                              >
                                Segna come riparato
                              </button>
                            </div>
                          )}

                          {p.fotoDanni && (
                            <div className="damage-gallery">
                              {(Array.isArray(p.fotoDanni)
                                ? p.fotoDanni
                                : [p.fotoDanni]
                              ).map((img, i) => (
                                <img
                                  key={i}
                                  src={img}
                                  alt={`Foto danno ${i + 1}`}
                                  onClick={() => {
                                    setSelectedDamagePhoto(img);
                                    setDamageModalOpen(true);
                                  }}
                                  className="damage-photo"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                    {/* --- Sezione: Danni manuali toggle --- */}
                    <button
                      className="toggle-subsection-btn"
                      onClick={() => setShowManualDanni((prev) => !prev)}
                    >
                      {showManualDanni
                        ? "▲ Nascondi Danni Manuali"
                        : "▼ Mostra Danni Manuali / Preesistenti"}
                    </button>

                    {showManualDanni && (
                      <>
                        <h4>Danni manuali / preesistenti:</h4>

                        {/* Lista dei danni esistenti */}
                        {veicolo.danni?.length > 0 ? (
                          <div className="damage-gallery">
                            {veicolo.danni.map((danno, i) => (
                              <div key={i} className="damage-photo-wrapper">
                                <img
                                  src={danno.immagine}
                                  alt={`Danno ${i + 1}`}
                                  onClick={() => {
                                    setSelectedDamagePhoto(danno.immagine);
                                    setDamageModalOpen(true);
                                  }}
                                  className="damage-photo"
                                />
                                <p className="damage-desc">
                                  {danno.descrizione || "—"}
                                </p>
                                {danno.daRiparare && (
                                  <p className="repair-warning">
                                    ⚠️ Da riparare
                                  </p>
                                )}
                                <div className="damage-controls">
                                  <p className="repair-status">
                                    Stato:{" "}
                                    <strong>
                                      {danno.daRiparare
                                        ? "⚠️ Da riparare"
                                        : "✅ Riparato"}
                                    </strong>
                                  </p>
                                  <button
                                    className="toggle-repair-btn"
                                    onClick={() => onToggleRepairStatus(i)}
                                  >
                                    {danno.daRiparare
                                      ? "Segna come riparato"
                                      : "Riporta tra i danni da riparare"}
                                  </button>
                                  <button
                                    className="delete-damage-btn"
                                    onClick={() => onDeleteDamage(i)}
                                  >
                                    ✖
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p>Nessun danno manuale registrato.</p>
                        )}

                        {/* Form per aggiungere nuovo danno */}
                        <div
                          className="add-damage-form"
                          style={{ marginTop: "20px" }}
                        >
                          <div style={{ marginBottom: "10px" }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current.click();
                              }}
                              style={{
                                padding: "8px 12px",
                                backgroundColor: "#f0f0f0",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              Scegli Foto
                            </button>
                            <input
                              type="file"
                              accept="image/*"
                              ref={fileInputRef}
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    setNuovoDanno((prev) => ({
                                      ...prev,
                                      immagine: event.target.result,
                                    }));
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </div>

                          {nuovoDanno.immagine && (
                            <div style={{ marginBottom: "10px" }}>
                              <img
                                src={nuovoDanno.immagine}
                                alt="Anteprima"
                                style={{
                                  maxWidth: "200px",
                                  maxHeight: "200px",
                                  borderRadius: "6px",
                                }}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNuovoDanno((prev) => ({
                                    ...prev,
                                    immagine: "",
                                  }));
                                  fileInputRef.current.value = "";
                                }}
                                style={{
                                  display: "block",
                                  marginTop: "5px",
                                  background: "#ff4444",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  padding: "2px 8px",
                                  cursor: "pointer",
                                }}
                              >
                                Rimuovi foto
                              </button>
                            </div>
                          )}

                          <input
                            type="text"
                            placeholder="Descrizione danno"
                            value={nuovoDanno.descrizione}
                            onChange={(e) =>
                              setNuovoDanno((prev) => ({
                                ...prev,
                                descrizione: e.target.value,
                              }))
                            }
                            style={{
                              width: "100%",
                              padding: "8px",
                              marginBottom: "10px",
                              border: "1px solid #ccc",
                              borderRadius: "4px",
                            }}
                          />

                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              marginBottom: "10px",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={nuovoDanno.daRiparare}
                              onChange={(e) =>
                                setNuovoDanno((prev) => ({
                                  ...prev,
                                  daRiparare: e.target.checked,
                                }))
                              }
                              style={{ marginRight: "8px" }}
                            />
                            Richiede riparazione
                          </label>

                          <button
                            type="button"
                            className="add-damage-btn"
                            disabled={
                              !nuovoDanno.immagine || !nuovoDanno.descrizione
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (
                                nuovoDanno.immagine &&
                                nuovoDanno.descrizione
                              ) {
                                onAddDamage(nuovoDanno);
                                setNuovoDanno({
                                  immagine: "",
                                  descrizione: "",
                                  daRiparare: false,
                                  data: new Date().toISOString().split("T")[0],
                                });
                                fileInputRef.current.value = "";
                              }
                            }}
                            style={{
                              padding: "10px 15px",
                              backgroundColor: "#4CAF50",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              opacity:
                                !nuovoDanno.immagine || !nuovoDanno.descrizione
                                  ? 0.5
                                  : 1,
                            }}
                          >
                            Salva danno
                          </button>
                        </div>

                        {veicolo.storicoRiparazioni?.length > 0 && (
                          <>
                            <h4 style={{ marginTop: "30px" }}>
                              🛠️ Storico Riparazioni
                            </h4>
                            <div className="damage-gallery">
                              {veicolo.storicoRiparazioni.map((danno, i) => (
                                <div key={i} className="damage-photo-wrapper">
                                  <img
                                    src={danno.immagine}
                                    alt={`Riparazione ${i + 1}`}
                                    className="damage-photo"
                                  />
                                  <p className="damage-desc">
                                    {danno.descrizione || "—"}
                                  </p>
                                  <p className="repair-done">
                                    Riparato il:{" "}
                                    {new Date(
                                      danno.riparatoIn
                                    ).toLocaleDateString()}
                                  </p>
                                  <div className="damage-controls">
                                    <button
                                      onClick={() =>
                                        onRestoreFromRepairHistory(i)
                                      }
                                    >
                                      🔄 Riporta tra danni
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* --- Sezione: Manutenzioni --- */}

              <div className="vehicle-maintenance-toggle">
                <button
                  onClick={() => setMostraManutenzioni((prev) => !prev)}
                  className="toggle-maintenance-btn"
                >
                  {mostraManutenzioni
                    ? "▲ Nascondi Manutenzioni"
                    : "▼ Visualizza Manutenzioni"}
                </button>

                {mostraManutenzioni && (
                  <div
                    className="vehicle-maintenance-section"
                    ref={manutenzioneRef}
                  >
                    <h4>Storico Manutenzioni</h4>
                    {veicolo.manutenzioni?.length > 0 ? (
                      <>
                        <table className="maintenance-table">
                          <thead>
                            <tr>
                              <th>Data</th>
                              <th>Descrizione</th>
                              <th>Costo (€)</th>
                              <th>Azioni</th>
                            </tr>
                          </thead>
                          <tbody>
                            {veicolo.manutenzioni.map((m, i) => (
                              <tr key={i}>
                                <td>{m.data}</td>
                                <td>{m.descrizione}</td>
                                <td>{parseFloat(m.costo).toFixed(2)}</td>
                                <td>
                                  <button
                                    onClick={() => onDeleteManutenzione(i)}
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      color: "red",
                                      fontWeight: "bold",
                                      cursor: "pointer",
                                    }}
                                  >
                                    ✖
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <p className="maintenance-total">
                          Totale:{" "}
                          <strong>
                            {veicolo.manutenzioni
                              .reduce(
                                (acc, m) => acc + parseFloat(m.costo || 0),
                                0
                              )
                              .toFixed(2)}{" "}
                            €
                          </strong>
                        </p>
                      </>
                    ) : (
                      <p>Nessuna manutenzione registrata.</p>
                    )}

                    <div
                      className="maintenance-form"
                      style={{ marginTop: "20px" }}
                    >
                      <h5>Aggiungi nuova manutenzione:</h5>
                      <input
                        type="date"
                        value={nuovaManutenzione.data}
                        onChange={(e) =>
                          setNuovaManutenzione((prev) => ({
                            ...prev,
                            data: e.target.value,
                          }))
                        }
                        placeholder="Data"
                        style={{ marginRight: "10px" }}
                      />
                      <input
                        type="text"
                        value={nuovaManutenzione.descrizione}
                        onChange={(e) =>
                          setNuovaManutenzione((prev) => ({
                            ...prev,
                            descrizione: e.target.value,
                          }))
                        }
                        placeholder="Descrizione"
                        style={{ marginRight: "10px" }}
                      />
                      <input
                        type="number"
                        value={nuovaManutenzione.costo}
                        onChange={(e) =>
                          setNuovaManutenzione((prev) => ({
                            ...prev,
                            costo: e.target.value,
                          }))
                        }
                        placeholder="Costo (€)"
                        style={{ width: "100px", marginRight: "10px" }}
                      />
                      <button
                        onClick={onAddManutenzione}
                        className="add-maintenance-btn"
                      >
                        ➕ Aggiungi
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="vehicle-actions">
                <button className="save-btn" onClick={() => onUpdate(veicolo)}>
                  Salva
                </button>

                <button className="edit-btn" onClick={onEdit}>
                  Modifica
                </button>
                <button
                  className="delete-btn"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  Elimina
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={damageModalOpen}
        onRequestClose={() => setDamageModalOpen(false)}
        className={{
          base: "Modal",
          afterOpen: "Modal--after-open",
          beforeClose: "Modal--before-close",
        }}
        overlayClassName={{
          base: "Overlay",
          afterOpen: "Overlay--after-open",
          beforeClose: "Overlay--before-close",
        }}
      >
        <div style={{ textAlign: "center" }}>
          {selectedDamagePhoto && (
            <img
              src={selectedDamagePhoto}
              alt="Foto Danno"
              style={{
                maxWidth: "90%",
                maxHeight: "90vh",
                borderRadius: "10px",
              }}
            />
          )}
          <button
            onClick={() => setDamageModalOpen(false)}
            className="close-damage-modal-btn"
            style={{ marginTop: "20px" }}
          >
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
        message="Sei sicuro di voler eliminare questo veicolo?"
      />
    </>
  );
};

export default VehicleDetailModal;
