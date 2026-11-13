import { openLightbox } from './lightbox.js';

const SITE = 'https://www.fotomastrosimone.it';
const WIDTHS = [400, 800, 1200, 1600];
// Nelle righe giustificate una foto è larga circa 300–600px (150–330px su mobile).
const SIZES = '(max-width: 700px) 60vw, 560px';
const BATCH = 24; // foto aggiunte alla volta nelle gallerie complete

/* ---------- Menu mobile ---------- */
const header = document.querySelector('.fm-header');
const burger = document.querySelector('.fm-burger');
if (header && burger) {
  const setOpen = (open) => {
    header.toggleAttribute('data-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu');
  };
  burger.addEventListener('click', () => setOpen(!header.hasAttribute('data-open')));
  header.querySelectorAll('.fm-nav a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

/* ---------- Anno nel footer ---------- */
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

/* ---------- Immagini Cloudinary ---------- */
// cloudName "local" serve solo per provare il sito in locale prima della migrazione:
// usa le foto originali in file/foto (id "fotomastrosimone/img-12" -> /file/foto/img-12.jpg).
function imageUrl(cloudName, id, width) {
  if (cloudName === 'local') {
    const name = id.split('/').pop();
    const folder = name.startsWith('imgLoc-') ? 'studio' : 'foto';
    return `/file/${folder}/${name}.jpg`;
  }
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,c_limit,w_${width}/${encodeURI(id)}`;
}

function buildFigure(cloudName, image, onOpen) {
  const fig = document.createElement('figure');
  fig.className = 'fm-gallery__item';
  // Rapporto d'aspetto noto prima del download: la riga si dispone subito e non salta.
  fig.style.setProperty('--r', (image.w / image.h).toFixed(4));

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fm-gallery__btn';
  btn.setAttribute('aria-label', `Apri foto: ${image.alt}`);

  const img = document.createElement('img');
  img.alt = image.alt;
  img.width = image.w;
  img.height = image.h;
  img.style.aspectRatio = `${image.w} / ${image.h}`;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.sizes = SIZES;
  img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
  img.addEventListener('error', () => img.classList.add('is-loaded'), { once: true });
  if (cloudName !== 'local') img.srcset = WIDTHS.map((w) => `${imageUrl(cloudName, image.id, w)} ${w}w`).join(', ');
  img.src = imageUrl(cloudName, image.id, 800);
  if (img.complete) img.classList.add('is-loaded');

  btn.append(img);
  btn.addEventListener('click', () => onOpen(btn));
  fig.append(btn);
  return fig;
}

async function loadGalleryData() {
  const res = await fetch('/data/gallery.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`gallery.json: HTTP ${res.status}`);
  return res.json();
}

function addImageGallerySchema(gallery, cloudName) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: `${gallery.title} – Studio Fotografico Mastrosimone`,
    description: gallery.description,
    url: SITE + gallery.page,
    image: gallery.images.slice(0, 60).map((img) => ({
      '@type': 'ImageObject',
      contentUrl: imageUrl(cloudName, img.id, 2000),
      description: img.alt,
      width: img.w,
      height: img.h,
      creator: { '@type': 'Organization', name: 'Studio Fotografico Mastrosimone' },
      copyrightNotice: 'Studio Fotografico Mastrosimone',
    })),
  };
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(data);
  document.head.append(s);
}

async function initGalleries() {
  const targets = document.querySelectorAll('[data-gallery]');
  const studio = document.querySelector('[data-studio]');
  if (!targets.length && !studio) return;

  let data;
  try {
    data = await loadGalleryData();
  } catch (err) {
    console.error(err);
    targets.forEach((el) => { el.innerHTML = '<p class="fm-gallery-empty">Le foto non sono disponibili in questo momento. Riprova tra poco.</p>'; });
    return;
  }
  const { cloudName } = data;
  const byTag = Object.fromEntries(data.galleries.map((g) => [g.tag, g]));

  targets.forEach((el) => {
    const gallery = byTag[el.dataset.gallery];
    if (!gallery || !gallery.images.length) {
      el.closest('[data-gallery-block]')?.setAttribute('hidden', '');
      return;
    }
    const limit = Number(el.dataset.limit) || gallery.images.length;
    const shown = gallery.images.slice(0, limit);
    const lightboxItems = gallery.images.map((img) => ({ large: imageUrl(cloudName, img.id, 2000), alt: img.alt }));

    // Aggiunge le foto a blocchi: niente muro da 170 immagini costruito tutto insieme.
    let rendered = 0;
    const renderMore = () => {
      const frag = document.createDocumentFragment();
      shown.slice(rendered, rendered + BATCH).forEach((image, k) => {
        const i = rendered + k;
        frag.append(buildFigure(cloudName, image, (opener) => openLightbox(lightboxItems, i, gallery.title, opener)));
      });
      el.append(frag);
      rendered = Math.min(rendered + BATCH, shown.length);
    };
    el.replaceChildren();
    renderMore();
    el.removeAttribute('aria-busy');

    if (rendered < shown.length) {
      const more = document.createElement('div');
      more.className = 'fm-gallery-more';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fm-btn fm-btn--secondary';
      const label = () => { btn.textContent = `Mostra altre foto (${shown.length - rendered})`; };
      label();
      more.append(btn);
      el.after(more);

      // Scorrendo, il blocco successivo arriva da solo quando il pulsante è
      // a meno di 800px dallo schermo (o già superato, es. tasto Fine).
      let ticking = false;
      const check = () => {
        ticking = false;
        if (more.isConnected && more.getBoundingClientRect().top < innerHeight + 800) step();
      };
      const onScroll = () => {
        if (!ticking) { ticking = true; setTimeout(check, 100); }
      };
      const step = () => {
        renderMore();
        if (rendered >= shown.length) {
          removeEventListener('scroll', onScroll);
          more.remove();
          return;
        }
        label();
      };
      btn.addEventListener('click', step);
      addEventListener('scroll', onScroll, { passive: true });
    }

    document.querySelectorAll(`[data-gallery-count="${gallery.tag}"]`).forEach((c) => {
      c.textContent = `${gallery.images.length} foto`;
    });
    if ('schema' in el.dataset) addImageGallerySchema(gallery, cloudName);
  });

  // Foto dello studio (sezione Chi siamo): massimo 3, ritagliate.
  if (studio) {
    const gallery = byTag.studio;
    if (gallery?.images.length) {
      const frag = document.createDocumentFragment();
      gallery.images.slice(0, 3).forEach((image) => {
        const img = document.createElement('img');
        img.alt = image.alt;
        img.width = image.w;
        img.height = image.h;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.sizes = '(max-width: 860px) 100vw, 60vw';
        if (cloudName !== 'local') img.srcset = WIDTHS.map((w) => `${imageUrl(cloudName, image.id, w)} ${w}w`).join(', ');
        img.src = imageUrl(cloudName, image.id, 1200);
        frag.append(img);
      });
      studio.replaceChildren(frag);
    } else {
      studio.hidden = true;
    }
  }
}

/* ---------- Video YouTube (facade: l'iframe parte solo al click) ---------- */
function initVideo() {
  const box = document.querySelector('[data-yt-playlist]');
  if (!box) return;
  const playlist = box.dataset.ytPlaylist.trim();
  if (!playlist) {
    box.closest('section')?.setAttribute('hidden', '');
    document.querySelectorAll('a[href="#video"], a[href="/#video"]').forEach((a) => a.closest('li')?.setAttribute('hidden', ''));
    return;
  }
  const btn = box.querySelector('.fm-video__frame');
  btn.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlist)}&autoplay=1&rel=0`;
    iframe.title = 'Trailer video dello Studio Fotografico Mastrosimone';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    btn.replaceWith(iframe);
    iframe.focus();
  }, { once: true });
}

/* ---------- Mappa (facade) ---------- */
function initMap() {
  const btn = document.querySelector('[data-map]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.className = 'fm-map-frame';
    iframe.src = 'https://www.google.com/maps?q=Via+Pacini+16,+93100+Caltanissetta&output=embed';
    iframe.title = 'Mappa: Studio Fotografico Mastrosimone, Via Pacini 16, Caltanissetta';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    btn.replaceWith(iframe);
  }, { once: true });
}

/* ---------- Hero: slideshow foto dello studio ---------- */
function initSlides() {
  const box = document.querySelector('[data-slides]');
  if (!box) return;
  const slides = [...box.querySelectorAll('img')];
  if (slides.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const load = (img) => {
    if (img.dataset.src) {
      img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
      delete img.dataset.src;
    }
  };
  let current = 0;
  let timer = null;
  const next = () => {
    const nextIndex = (current + 1) % slides.length;
    const img = slides[nextIndex];
    load(img);
    const show = () => {
      slides[current].classList.remove('is-active');
      img.classList.add('is-active');
      current = nextIndex;
      load(slides[(nextIndex + 1) % slides.length]); // precarica la successiva
    };
    if (img.complete && img.naturalWidth) show();
    else img.addEventListener('load', show, { once: true });
  };
  const start = () => { if (!timer) timer = setInterval(next, 6000); };
  const stop = () => { clearInterval(timer); timer = null; };

  // Carica la seconda foto solo dopo il caricamento completo della pagina.
  window.addEventListener('load', () => { load(slides[1]); start(); }, { once: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
}

initSlides();
initGalleries();
initVideo();
initMap();
