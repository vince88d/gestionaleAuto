// Dopo un invio con campi mancanti o sbagliati: porta lo sguardo sul primo
// campo da correggere (scorre fino a li' e ci mette il cursore), invece di
// lasciare l'utente a cercare l'errore in una pagina lunga.
// Va chiamata subito dopo aver segnato l'errore: aspetta il disegno dei
// messaggi e poi cerca il primo in ordine di pagina.
const SELETTORE_ERRORE = '.np-errore, .pz-errore, .vf-messaggio-errore, .sd-errore, .opt-errore-campo, .imp-errore, [aria-invalid="true"]';
const SELETTORE_CAMPO = '.pz-campo, .vf-campo, .np-campo, .opt-campo, label';
const FOCALIZZABILI = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea';

export function scorriAlPrimoErrore(radice) {
  setTimeout(() => {
    const base = radice || document;
    const errore = base.querySelector?.(SELETTORE_ERRORE);
    if (!errore) return;
    const contenitore = errore.closest(SELETTORE_CAMPO) || errore.parentElement || errore;
    const campo = errore.matches(FOCALIZZABILI) ? errore : contenitore.querySelector?.(FOCALIZZABILI);
    contenitore.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    // Il campo data apre il calendario appena riceve il cursore, e coprirebbe il messaggio: li' si scorre soltanto.
    if (campo && !campo.closest?.('.react-datepicker-wrapper')) campo.focus?.({ preventScroll: true });
  }, 0);
}
