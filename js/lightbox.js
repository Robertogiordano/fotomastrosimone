// Lightbox su <dialog> nativo: Esc, click sul fondo, frecce, swipe, focus di ritorno.
// Naviga solo dentro la galleria con cui è stato aperto.

const ICON = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
};

let dialog, imgEl, counterEl, captionEl;
let items = [];
let index = 0;
let title = '';
let returnFocus = null;

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'fm-lightbox';
  dialog.setAttribute('aria-label', 'Visualizzatore foto');
  dialog.innerHTML = `
    <div class="fm-lightbox__bar">
      <span class="fm-tabular" data-lb-counter aria-live="polite"></span>
      <button type="button" class="fm-iconbtn" data-lb-close aria-label="Chiudi">${ICON.close}</button>
    </div>
    <div class="fm-lightbox__stage" data-lb-stage><img alt="" data-lb-img decoding="async"></div>
    <p class="fm-lightbox__caption" data-lb-caption></p>
    <button type="button" class="fm-iconbtn fm-lightbox__prev" data-lb-prev aria-label="Foto precedente">${ICON.prev}</button>
    <button type="button" class="fm-iconbtn fm-lightbox__next" data-lb-next aria-label="Foto successiva">${ICON.next}</button>`;
  document.body.append(dialog);

  imgEl = dialog.querySelector('[data-lb-img]');
  counterEl = dialog.querySelector('[data-lb-counter]');
  captionEl = dialog.querySelector('[data-lb-caption]');

  dialog.querySelector('[data-lb-close]').addEventListener('click', close);
  dialog.querySelector('[data-lb-prev]').addEventListener('click', () => go(-1));
  dialog.querySelector('[data-lb-next]').addEventListener('click', () => go(1));

  // Click sul fondo (non su immagine o pulsanti) chiude.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.matches('[data-lb-stage]')) close();
  });

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });

  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = '';
    imgEl.removeAttribute('src');
    if (returnFocus) returnFocus.focus({ preventScroll: true });
  });

  // Swipe orizzontale.
  let startX = null;
  let startY = null;
  const stage = dialog.querySelector('[data-lb-stage]');
  stage.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    startX = null;
  }, { passive: true });
}

function render() {
  const item = items[index];
  imgEl.src = item.large;
  imgEl.alt = item.alt;
  captionEl.textContent = item.alt;
  counterEl.textContent = `${index + 1} / ${items.length} · ${title.toUpperCase()}`;
  // Precarica la successiva.
  const next = items[(index + 1) % items.length];
  if (next) { const pre = new Image(); pre.src = next.large; }
}

function go(step) {
  index = (index + step + items.length) % items.length;
  render();
}

function close() {
  dialog.close();
}

/**
 * @param {{large: string, alt: string}[]} list foto della galleria corrente
 * @param {number} start indice della foto cliccata
 * @param {string} galleryTitle nome della galleria, per il contatore
 * @param {HTMLElement} opener elemento a cui restituire il focus
 */
export function openLightbox(list, start, galleryTitle, opener) {
  if (!dialog) build();
  items = list;
  index = start;
  title = galleryTitle;
  returnFocus = opener;
  render();
  document.documentElement.style.overflow = 'hidden';
  dialog.showModal();
}
