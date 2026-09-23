// Cambio di stato di un danno del veicolo (elenco `danni`):
// - da riparare -> riparato: esce dai danni e va in `storicoRiparazioni` con la
//   data di riparazione;
// - preesistente non da riparare -> diventa da riparare e resta dov'e'.
// Prima il secondo caso cancellava dallo storico la voce nella stessa posizione
// del danno, cioe' una riparazione a caso.
export function cambiaStatoRiparazione(veicolo, index, adesso = new Date().toISOString()) {
  const danno = veicolo?.danni?.[index];
  if (!danno) return null;

  if (danno.daRiparare) {
    return {
      ...veicolo,
      danni: veicolo.danni.filter((_, i) => i !== index),
      storicoRiparazioni: [
        ...(veicolo.storicoRiparazioni || []),
        { ...danno, daRiparare: false, riparatoIn: adesso },
      ],
    };
  }

  return {
    ...veicolo,
    danni: veicolo.danni.map((d, i) => (i === index ? { ...d, daRiparare: true } : d)),
  };
}
