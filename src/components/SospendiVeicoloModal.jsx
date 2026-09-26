import React, { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { PauseCircle, AlertTriangle } from 'lucide-react';
import { sovraprenotazioniCategoria, prenotazioniSuVeicoloSospeso } from '../utils/disponibilitaCategoria';
import { formattaData } from '../utils/scadenze';
import './BookingModal.css';
import './SospendiVeicoloModal.css';

// Sospendere un'auto non tocca le prenotazioni gia' prese: questa finestra fa
// vedere prima dove il gestore dovra' intervenire (auto superiore, altro
// noleggiatore...), calcolandolo come se l'auto fosse gia' sospesa.
function SospendiVeicoloModal({ isOpen, veicolo, veicoli, prenotazioni, holds, oggi, onCancel, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMotivo('');
      setSalvando(false);
    }
  }, [isOpen, veicolo?.id]);

  const { daRiassegnare, sovraprenotazioni } = useMemo(() => {
    if (!isOpen || !veicolo) return { daRiassegnare: [], sovraprenotazioni: [] };
    const conSospeso = (veicoli || []).map((v) => (v.id === veicolo.id ? { ...v, sospeso: true } : v));
    return {
      daRiassegnare: prenotazioniSuVeicoloSospeso(conSospeso, prenotazioni, oggi),
      sovraprenotazioni: veicolo.categoria
        ? sovraprenotazioniCategoria(veicolo.categoria, conSospeso, prenotazioni, holds, oggi)
        : [],
    };
  }, [isOpen, veicolo, veicoli, prenotazioni, holds, oggi]);

  if (!veicolo) return null;
  const nome = [veicolo.marca, veicolo.modello].filter(Boolean).join(' ') || veicolo.targa;

  const conferma = async () => {
    setSalvando(true);
    try {
      await onConfirm(motivo);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(aperto) => { if (!aperto && !salvando) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="DialogOverlay" />
        <Dialog.Content className="DialogContent confirm-dialog sosp">
          <Dialog.Title className="confirm-dialog-title">
            <PauseCircle size={20} aria-hidden="true" /> Sospendi {nome}
          </Dialog.Title>
          <p className="confirm-dialog-message">
            L&apos;auto esce dal noleggio finché non la riattivi: non viene proposta sul sito né scelta nelle nuove
            prenotazioni. Le prenotazioni già prese restano come sono.
          </p>

          <label className="sosp-campo">
            <span>Motivo (facoltativo, lo vede solo chi usa il gestionale)</span>
            <input
              type="text"
              value={motivo}
              maxLength={120}
              placeholder="Es. incidente, in officina, fermo per revisione"
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>

          {daRiassegnare.length > 0 && (
            <div className="sosp-avviso">
              <p className="sosp-avviso-titolo">
                <AlertTriangle size={16} aria-hidden="true" />
                {daRiassegnare.length === 1
                  ? ' 1 prenotazione ha questa targa: va riassegnata a un altro mezzo'
                  : ` ${daRiassegnare.length} prenotazioni hanno questa targa: vanno riassegnate a un altro mezzo`}
              </p>
              <ul>
                {daRiassegnare.map((p) => (
                  <li key={p.id}>
                    {formattaData(p.dataInizio)} → {formattaData(p.dataFine)} · {p.cliente || 'Cliente non indicato'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sovraprenotazioni.length > 0 && (
            <div className="sosp-avviso">
              <p className="sosp-avviso-titolo">
                <AlertTriangle size={16} aria-hidden="true" /> Categoria {veicolo.categoria}: in questi giorni ci sono più
                impegni che auto noleggiabili
              </p>
              <ul>
                {sovraprenotazioni.map((i) => (
                  <li key={i.da}>
                    {i.da === i.a ? formattaData(i.da) : `${formattaData(i.da)} → ${formattaData(i.a)}`}
                    {`: ${i.occupati} impegni, ${i.disponibili} ${i.disponibili === 1 ? 'auto noleggiabile' : 'auto noleggiabili'}`}
                  </li>
                ))}
              </ul>
              <p className="sosp-nota">Ci pensi tu: auto di categoria superiore o un altro noleggiatore. Non cambio nulla in automatico.</p>
            </div>
          )}

          <div className="confirm-dialog-actions">
            <button type="button" onClick={onCancel} disabled={salvando} className="confirm-dialog-btn confirm-dialog-btn-secondary">
              Annulla
            </button>
            <button type="button" onClick={conferma} disabled={salvando} className="confirm-dialog-btn confirm-dialog-btn-primary">
              {salvando ? 'Salvo…' : 'Sospendi dal noleggio'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default SospendiVeicoloModal;
