// Calcolo della penale trattenuta quando lo staff annulla una prenotazione pagata
// online. Serve solo per mostrare in anteprima gli importi: il calcolo che conta
// lo rifà il server (formiarent, functions/src/rimborso.ts, calcolaTrattenutaCent)
// sull'importo realmente incassato su Stripe, con la stessa regola: si lavora in
// centesimi e la penale in percentuale è arrotondata al centesimo.
//
// La penale va applicata solo se prevista dalle condizioni di noleggio accettate
// dal cliente al momento della prenotazione.
//
// scelta: { tipo: 'nessuna' }
//         { tipo: 'percentuale', valore: 20 }
//         { tipo: 'importo', valore: 12.5 }   // euro
export function calcolaPenale(totale, scelta) {
  const totaleCent = Math.round(Number(totale) * 100);
  if (!Number.isFinite(totaleCent) || totaleCent < 0) {
    return { valida: false, errore: 'Importo pagato non valido.', trattenuto: 0, rimborso: 0, penale: undefined };
  }

  let trattenutoCent = 0;
  let penale;

  if (scelta?.tipo === 'percentuale') {
    const percentuale = Number(scelta.valore);
    if (!Number.isFinite(percentuale) || percentuale < 0 || percentuale > 100) {
      return { valida: false, errore: 'La percentuale deve essere tra 0 e 100.', trattenuto: 0, rimborso: totaleCent / 100, penale: undefined };
    }
    trattenutoCent = Math.round((totaleCent * percentuale) / 100);
    penale = { percentuale };
  } else if (scelta?.tipo === 'importo') {
    const importo = Number(scelta.valore);
    if (!Number.isFinite(importo) || importo < 0) {
      return { valida: false, errore: 'Inserisci un importo valido.', trattenuto: 0, rimborso: totaleCent / 100, penale: undefined };
    }
    trattenutoCent = Math.round(importo * 100);
    if (trattenutoCent > totaleCent) {
      return { valida: false, errore: 'La penale non può superare l\'importo pagato.', trattenuto: 0, rimborso: totaleCent / 100, penale: undefined };
    }
    penale = { importo };
  }

  return {
    valida: true,
    trattenuto: trattenutoCent / 100,
    rimborso: (totaleCent - trattenutoCent) / 100,
    // Senza penale non si invia nulla: il server fa il rimborso totale.
    penale: trattenutoCent > 0 ? penale : undefined,
  };
}
