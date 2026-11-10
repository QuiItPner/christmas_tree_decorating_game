/* =========================================================
   App shell — in-app navigation between the three pages.
   Clicking a link to index.html / studio.html / themes.html no longer reloads the browser
   page: the new page's HTML is fetched, swapped into <body> (with a short cross-fade), and its
   module is mounted. The audio context in core.js lives on, so the music never stops.
   Anything unexpected falls back to a normal full page load.
   ========================================================= */
import { prefersReducedMotion } from './core.js?v=20261111h';

// same cache-busting query as this file, so page modules share module instances with it
const VQ = new URL(import.meta.url).search;
const PAGES = { 'index.html': 'home', 'studio.html': 'studio', 'themes.html': 'themes' };

const dirOf = (path) => path.slice(0, path.lastIndexOf('/') + 1);
const BASE = dirOf(location.pathname);
const pageKey = (url) => {
  if (dirOf(url.pathname) !== BASE) return null;
  const name = url.pathname.slice(BASE.length) || 'index.html';
  return PAGES[name] ? name : null;
};

const loadModule = (key) => import(`./${PAGES[key]}.js${VQ}`).then((m) => m.default);
const htmlCache = new Map();
function fetchHtml(url) {
  const path = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
  if (!htmlCache.has(path)) {
    htmlCache.set(path, fetch(path, { credentials: 'same-origin' })
      .then((r) => { if (!r.ok) throw new Error(`${r.status} ${path}`); return r.text(); })
      .catch((err) => { htmlCache.delete(path); throw err; }));
  }
  return htmlCache.get(path);
}

let current = null; // { key, ctrl }
let navSeq = 0;

function mountPage(key, mount) {
  const ctrl = new AbortController();
  current = { key, ctrl };
  mount(ctrl.signal);
}

function scrollForHash(url) {
  const id = decodeURIComponent(url.hash.slice(1));
  const el = id && !id.includes('=') ? document.getElementById(id) : null;
  if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
}

async function navigate(url, { push }) {
  const key = pageKey(url);
  if (!key) { location.assign(url.href); return; }
  const seq = ++navSeq;
  let html, mount;
  try {
    [html, mount] = await Promise.all([fetchHtml(url), loadModule(key)]);
  } catch {
    location.assign(url.href); // offline/blocked: plain navigation still works
    return;
  }
  if (seq !== navSeq) return; // a newer click won
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const swap = () => {
    // 1) let the old page save its state and drop listeners while its DOM is still there
    current?.ctrl.abort();
    // 2) replace the page content (header/footer are rebuilt by the new page's mount)
    document.title = doc.title;
    document.body.className = doc.body.className;
    [...document.body.children].forEach((n) => { if (n.id !== 'toast') n.remove(); });
    [...doc.body.children].forEach((n) => { if (n.tagName !== 'SCRIPT') document.body.appendChild(document.adoptNode(n)); });
    if (push) history.pushState({ app: 1 }, '', url.href);
    // 3) start the new page
    mountPage(key, mount);
    scrollForHash(url);
  };

  if (document.startViewTransition && !prefersReducedMotion()) document.startViewTransition(swap);
  else swap();
}

/* ---------------- link interception ---------------- */
function appLink(e) {
  const a = e.target.closest?.('a[href]');
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
  const url = new URL(a.getAttribute('href'), location.href);
  if (url.origin !== location.origin || !pageKey(url)) return null;
  return url;
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const url = appLink(e);
  if (!url) return;
  // plain in-page anchor (e.g. index.html#how while already on index.html): let the browser scroll
  if (url.hash && pageKey(url) === pageKey(location) && url.search === location.search && !url.hash.includes('=')) return;
  e.preventDefault();
  navigate(url, { push: true });
});

// warm the cache on hover/touch so the switch is instant
const warmed = new Set();
const warm = (e) => {
  const url = appLink(e);
  const key = url && pageKey(url);
  if (!key || warmed.has(key)) return;
  warmed.add(key);
  fetchHtml(url).catch(() => warmed.delete(key));
  loadModule(key).catch(() => warmed.delete(key));
};
document.addEventListener('pointerover', warm, { passive: true });
document.addEventListener('touchstart', warm, { passive: true });

window.addEventListener('popstate', () => {
  const url = new URL(location.href);
  // hash-only change on the same page (in-page anchors): nothing to remount
  if (current && pageKey(url) === current.key && !url.search && !url.hash.includes('=')) { scrollForHash(url); return; }
  navigate(url, { push: false });
});

/* ---------------- first page ---------------- */
const first = pageKey(new URL(location.href)) || 'index.html';
loadModule(first).then((mount) => {
  history.replaceState({ app: 1 }, '', location.href);
  mountPage(first, mount);
});
