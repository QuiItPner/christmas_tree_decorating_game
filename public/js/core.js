/* =========================================================
   My Little Christmas Tree — shared core
   Storage, asset library, design model, page chrome, toasts,
   dialogs, share links and the (muted-by-default) jingle.
   ========================================================= */

export const APP_NAME = 'My Little Christmas Tree';
export const GALLERY_LIMIT = 20;

const KEY_CURRENT = 'mlct:current';
const KEY_GALLERY = 'mlct:gallery';
const KEY_PREFS = 'mlct:prefs';

/* ---------------- small utils ---------------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const uid = (p = 'id') => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export function safeColor(c, fallback = '#C9182B') {
  if (typeof c !== 'string') return fallback;
  const v = c.trim();
  if (!HEX_RE.test(v)) return fallback;
  if (v.length === 4) return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toUpperCase();
  return v.toUpperCase();
}
const num = (v, fallback, min = -Infinity, max = Infinity) => {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
};
const str = (v, fallback = '', max = 120) => (typeof v === 'string' ? v.slice(0, max) : fallback);

export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return formatDate(ts);
}
export function formatDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yest.toDateString()) return `Yesterday, ${time}`;
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
}

/* ---------------- safe localStorage ---------------- */
export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};

export const prefs = {
  get(k, d) { return (store.get(KEY_PREFS, {}) || {})[k] ?? d; },
  set(k, v) { const p = store.get(KEY_PREFS, {}) || {}; p[k] = v; store.set(KEY_PREFS, p); },
};

/* ---------------- asset library ---------------- */
let libPromise = null;
export function loadLibrary() {
  if (libPromise) return libPromise;
  libPromise = (async () => {
    const res = await fetch('assets/manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Could not load assets/manifest.json');
    const manifest = await res.json();
    const byId = {};
    await Promise.all(manifest.decorations.map(async (a) => {
      try {
        const r = await fetch(a.image);
        const text = await r.text();
        const m = text.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/i);
        if (!m) return;
        const [, viewBox, inner] = m;
        // never inline scripts / event handlers from asset files
        const clean = inner.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '');
        byId[a.id] = { ...a, viewBox, inner: clean };
      } catch { /* skip broken asset */ }
    }));
    const decorations = manifest.decorations.filter((a) => byId[a.id]).map((a) => byId[a.id]);
    return { categories: manifest.categories, decorations, byId };
  })();
  return libPromise;
}

/* ---------------- design model ---------------- */
export const TREE_STYLE_IDS = ['classic', 'mini', 'snowy', 'minimalist'];
export const BACKGROUND_IDS = ['cozy-room', 'fireplace', 'snowy-forest', 'night-sky', 'minimal'];

export function defaultDesign() {
  return {
    version: 1,
    name: 'My Christmas Tree',
    themeId: null,
    tree: {
      style: 'classic',
      leavesColor: '#176B45',
      trunkColor: '#795548',
      branchesColor: '#0E472A',
      branchesLinked: true,
      size: 1,
      snow: 0,
      snowColor: '#FFFFFF',
      skirt: true,
      skirtColor: '#B90C17',
      lights: true,
    },
    background: { theme: 'cozy-room', color: '#FBE9D7' },
    effects: { snow: true, twinkle: true },
    decorations: [
      { instanceId: 'placed-star', assetId: 'star-topper', x: 300, y: 104, width: 84, height: 84, rotation: 0, scale: 1, color: '#FFB703', locked: false, flip: false },
    ],
    greeting: { text: 'Merry Christmas & Happy Holidays!', name: '', date: '', visible: true, color: '#0E472A' },
  };
}

/** Sanitises anything that came from storage, a file or a share link. */
export function normalizeDesign(raw, lib) {
  const d = defaultDesign();
  if (!raw || typeof raw !== 'object') return d;
  const t = raw.tree || {};
  d.name = str(raw.name, d.name, 60) || d.name;
  d.themeId = typeof raw.themeId === 'string' ? raw.themeId.slice(0, 40) : null;
  d.tree = {
    style: TREE_STYLE_IDS.includes(t.style) ? t.style : 'classic',
    leavesColor: safeColor(t.leavesColor, d.tree.leavesColor),
    trunkColor: safeColor(t.trunkColor, d.tree.trunkColor),
    branchesColor: safeColor(t.branchesColor, d.tree.branchesColor),
    branchesLinked: t.branchesLinked !== false,
    size: num(t.size, 1, 0.6, 1.2),
    snow: num(t.snow, 0, 0, 100),
    snowColor: safeColor(t.snowColor, '#FFFFFF'),
    skirt: t.skirt !== false,
    skirtColor: safeColor(t.skirtColor, d.tree.skirtColor),
    lights: t.lights !== false,
  };
  const b = raw.background || {};
  d.background = { theme: BACKGROUND_IDS.includes(b.theme) ? b.theme : 'cozy-room', color: safeColor(b.color, d.background.color) };
  const e = raw.effects || {};
  d.effects = { snow: e.snow !== false, twinkle: e.twinkle !== false };
  const g = raw.greeting || {};
  d.greeting = {
    text: str(g.text, '', 60),
    name: str(g.name, '', 40),
    date: str(g.date, '', 40),
    visible: g.visible !== false,
    color: safeColor(g.color, '#0E472A'),
  };
  const list = Array.isArray(raw.decorations) ? raw.decorations.slice(0, 150) : [];
  d.decorations = list
    .filter((o) => o && typeof o.assetId === 'string' && (!lib || lib.byId[o.assetId]))
    .map((o) => {
      const a = lib?.byId[o.assetId];
      return {
        instanceId: typeof o.instanceId === 'string' && /^[\w-]{1,40}$/.test(o.instanceId) ? o.instanceId : uid('placed'),
        assetId: o.assetId,
        x: num(o.x, 300, -200, 800),
        y: num(o.y, 360, -200, 920),
        width: num(o.width, a?.width ?? 48, 4, 400),
        height: num(o.height, a?.height ?? 48, 4, 400),
        rotation: num(o.rotation, 0, -360, 360),
        scale: num(o.scale, 1, 0.2, 5),
        color: a?.colorable ? safeColor(o.color, a.defaultColor) : null,
        locked: !!o.locked,
        flip: !!o.flip,
      };
    });
  // keep instance ids unique
  const seen = new Set();
  d.decorations.forEach((o) => { if (seen.has(o.instanceId)) o.instanceId = uid('placed'); seen.add(o.instanceId); });
  return d;
}

/* ---------------- working copy (autosave) ---------------- */
export function loadCurrent() { return store.get(KEY_CURRENT, null); }
export function saveCurrent(design, galleryId = null) { return store.set(KEY_CURRENT, { design, galleryId, savedAt: Date.now() }); }

/* ---------------- gallery ---------------- */
export function listGallery() {
  const list = store.get(KEY_GALLERY, []);
  return Array.isArray(list) ? list : [];
}
function writeGallery(list) {
  if (!store.set(KEY_GALLERY, list)) throw new Error('Browser storage is full or blocked.');
}
export function getGalleryItem(id) { return listGallery().find((x) => x.id === id) || null; }
export function upsertGalleryItem(item) {
  const list = listGallery();
  const i = list.findIndex((x) => x.id === item.id);
  const now = Date.now();
  if (i >= 0) {
    list[i] = { ...list[i], ...item, updatedAt: now };
  } else {
    if (list.length >= GALLERY_LIMIT) throw new Error(`Your gallery is full (${GALLERY_LIMIT} trees). Delete one to save a new tree.`);
    list.unshift({ id: item.id || uid('tree'), favorite: false, createdAt: now, updatedAt: now, ...item });
  }
  writeGallery(list);
  return i >= 0 ? list[i] : list[0];
}
export function patchGalleryItem(id, patch, touch = false) {
  const list = listGallery();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch, ...(touch ? { updatedAt: Date.now() } : {}) };
  writeGallery(list);
  return list[i];
}
export function deleteGalleryItem(id) { writeGallery(listGallery().filter((x) => x.id !== id)); }

/* ---------------- share links ---------------- */
const b64url = {
  enc(bytes) {
    let s = '';
    bytes.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(text) {
    const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};
async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
export async function encodeDesign(design) {
  const slim = clone(design);
  slim.decorations.forEach((o) => { ['x', 'y', 'rotation', 'scale'].forEach((k) => { o[k] = round(o[k], 1); }); });
  const bytes = new TextEncoder().encode(JSON.stringify(slim));
  if ('CompressionStream' in window) {
    try { return 'z' + b64url.enc(await pipe(bytes, new CompressionStream('deflate-raw'))); } catch { /* fall through */ }
  }
  return 'j' + b64url.enc(bytes);
}
export async function decodeDesign(code) {
  const kind = code[0];
  let bytes = b64url.dec(code.slice(1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function shareLink(design) {
  const code = await encodeDesign(design);
  const url = new URL('studio.html', location.href);
  url.hash = 'share=' + code;
  return url.toString();
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove(); return ok;
  }
}
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export const fileSafe = (name) => (name || 'christmas-tree').replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim().replace(/\s+/g, '-').toLowerCase() || 'christmas-tree';

/* ---------------- toast ---------------- */
let toastTimer = null;
export function toast(message, icon = 'auto_awesome') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.innerHTML = `<span class="ms">${escapeHtml(icon)}</span><span>${escapeHtml(message)}</span>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ---------------- dialogs ---------------- */
function openDialog({ title, body = '', input = null, okLabel = 'OK', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 id="dlg-title" class="modal-title">${escapeHtml(title)}</h2>
        ${body ? `<p class="modal-body">${escapeHtml(body)}</p>` : ''}
        ${input !== null ? `<input class="field" id="dlg-input" maxlength="60" value="${escapeHtml(input)}">` : ''}
        <div class="modal-actions">
          ${cancelLabel ? `<button class="btn btn-ghost" data-act="cancel">${escapeHtml(cancelLabel)}</button>` : ''}
          <button class="btn ${danger ? 'btn-berry' : 'btn-pine'}" data-act="ok">${escapeHtml(okLabel)}</button>
        </div>
      </div>`;
    const prevFocus = document.activeElement;
    const close = (val) => { wrap.remove(); document.removeEventListener('keydown', onKey, true); prevFocus?.focus?.(); resolve(val); };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(input !== null ? null : false); }
      if (e.key === 'Enter' && input !== null) { e.preventDefault(); close($('#dlg-input', wrap).value.trim()); }
    };
    wrap.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (e.target === wrap || act === 'cancel') close(input !== null ? null : false);
      if (act === 'ok') close(input !== null ? $('#dlg-input', wrap).value.trim() : true);
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap);
    const f = $('#dlg-input', wrap) || $('[data-act="ok"]', wrap);
    f.focus(); if (f.select) f.select();
  });
}
export const confirmDialog = (title, body, okLabel = 'Confirm', danger = true) => openDialog({ title, body, okLabel, danger });
export const promptDialog = (title, value = '', okLabel = 'Save') => openDialog({ title, input: value, okLabel });
export const alertDialog = (title, body) => openDialog({ title, body, okLabel: 'Got it', cancelLabel: '' });

/* ---------------- holiday jingle (Web Audio, muted by default) ---------------- */
// "Jingle Bells" chorus (James Lord Pierpont, 1857 — public domain).
const E5 = 659.25, G5 = 783.99, C5 = 523.25, D5 = 587.33, F5 = 698.46;
const MELODY = [
  [E5, 1], [E5, 1], [E5, 2], [E5, 1], [E5, 1], [E5, 2], [E5, 1], [G5, 1], [C5, 1.5], [D5, 0.5], [E5, 4],
  [F5, 1], [F5, 1], [F5, 1.5], [F5, 0.5], [F5, 1], [E5, 1], [E5, 1], [E5, 0.5], [E5, 0.5], [E5, 1], [D5, 1], [D5, 1], [E5, 1], [D5, 2], [G5, 2],
  [E5, 1], [E5, 1], [E5, 2], [E5, 1], [E5, 1], [E5, 2], [E5, 1], [G5, 1], [C5, 1.5], [D5, 0.5], [E5, 4],
  [F5, 1], [F5, 1], [F5, 1.5], [F5, 0.5], [F5, 1], [E5, 1], [E5, 1], [E5, 0.5], [E5, 0.5], [G5, 1], [G5, 1], [F5, 1], [D5, 1], [C5, 4],
];
const music = { ctx: null, gain: null, timer: null, playing: false };
function scheduleLoop() {
  const { ctx, gain } = music;
  const beat = 0.3;
  let t = ctx.currentTime + 0.08;
  for (const [f, len] of MELODY) {
    [1, 2.01].forEach((mult, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = i ? 'sine' : 'triangle';
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(i ? 0.05 : 0.16, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.25, len * beat * 0.95));
      o.connect(g).connect(gain);
      o.start(t); o.stop(t + len * beat + 0.05);
    });
    t += len * beat;
  }
  const total = (t - ctx.currentTime) * 1000;
  music.timer = setTimeout(() => { if (music.playing) scheduleLoop(); }, total + 1200);
}
export function toggleMusic() {
  if (!music.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    music.ctx = new AC();
    music.gain = music.ctx.createGain();
    music.gain.gain.value = 0.5;
    music.gain.connect(music.ctx.destination);
  }
  music.playing = !music.playing;
  if (music.playing) { music.ctx.resume(); scheduleLoop(); } else { clearTimeout(music.timer); music.ctx.suspend(); }
  return music.playing;
}

/* ---------------- page chrome ---------------- */
const NAV = [
  { id: 'studio', href: 'studio.html', label: 'Tree Studio', icon: 'park' },
  { id: 'themes', href: 'themes.html', label: 'Themes & Styles', icon: 'palette' },
  { id: 'gallery', href: 'gallery.html', label: 'My Gallery', icon: 'collections_bookmark' },
  { id: 'about', href: 'index.html', label: 'About & Greetings', icon: 'celebration' },
];

export const LOGO_SVG = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#176B45"/><path d="M20 8l7 11h-3.5l5 8h-17l5-8H13z" fill="#A4F4C3"/><path d="M20 12.5l4.6 6.5h-9.2zM16 22h8l3.4 5h-14.8z" fill="#fff" opacity=".25"/><rect x="18" y="27" width="4" height="5" rx="1" fill="#F4A261"/><path d="M20 3.6l1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.5-2.7 1.5.6-3-2.2-2 3-.4z" fill="#FFBA27"/><circle cx="16.6" cy="21" r="1.3" fill="#E63946"/><circle cx="23.6" cy="24.6" r="1.3" fill="#FFBA27"/><circle cx="21" cy="16.4" r="1.1" fill="#E63946"/></svg>`;

/**
 * Injects the shared header + footer.
 * @param {string} active  nav id
 * @param {{primary?: {label:string, icon:string, id:string, href?:string}, share?: boolean}} opts
 */
export function mountChrome(active, opts = {}) {
  const header = document.createElement('header');
  header.className = 'site-header';
  const primary = opts.primary || { label: 'Start Decorating', icon: 'brush', href: 'studio.html', id: 'hdr-primary' };
  header.innerHTML = `
    <div class="hdr-inner">
      <a class="brand" href="index.html" aria-label="${APP_NAME} home">
        <span class="brand-logo">${LOGO_SVG}</span>
        <span class="brand-text"><span class="brand-name">${APP_NAME}</span><span class="brand-tag">Build your own Christmas tree</span></span>
      </a>
      <nav class="main-nav" id="main-nav" aria-label="Main">
        ${NAV.map((n) => `<a href="${n.href}" class="${n.id === active ? 'active' : ''}" ${n.id === active ? 'aria-current="page"' : ''}><span class="ms">${n.icon}</span><span>${n.label}</span></a>`).join('')}
      </nav>
      <div class="hdr-actions">
        <button class="icon-btn" id="btn-music" type="button" aria-label="Play holiday music" aria-pressed="false" title="Holiday music (off)"><span class="ms">volume_off</span></button>
        ${opts.share ? `<button class="btn btn-soft hide-sm" id="hdr-share" type="button"><span class="ms">share</span><span>Share</span></button>` : ''}
        ${primary.href
          ? `<a class="btn btn-berry" id="${primary.id}" href="${primary.href}"><span class="ms">${primary.icon}</span><span class="hide-xs">${primary.label}</span></a>`
          : `<button class="btn btn-berry" id="${primary.id}" type="button"><span class="ms">${primary.icon}</span><span class="hide-xs">${primary.label}</span></button>`}
        <button class="icon-btn nav-toggle" id="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="main-nav"><span class="ms">menu</span></button>
      </div>
    </div>`;
  document.body.prepend(header);

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="ftr-inner">
      <div class="ftr-note"><span class="ms">park</span><span>Handcrafted with warm holiday cheer © ${new Date().getFullYear()} ${APP_NAME}.</span></div>
      <div class="ftr-links"><a href="index.html#how">How it works</a><span>•</span><a href="themes.html">Themes</a><span>•</span><a href="gallery.html">My Gallery</a></div>
    </div>`;
  if (!opts.noFooter) document.body.appendChild(footer);

  const navToggle = $('#nav-toggle');
  navToggle.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.querySelector('.ms').textContent = open ? 'close' : 'menu';
  });

  const btnMusic = $('#btn-music');
  btnMusic.addEventListener('click', () => {
    const on = toggleMusic();
    btnMusic.setAttribute('aria-pressed', String(on));
    btnMusic.title = on ? 'Holiday music (on)' : 'Holiday music (off)';
    btnMusic.querySelector('.ms').textContent = on ? 'music_note' : 'volume_off';
    btnMusic.classList.toggle('on', on);
  });
  return header;
}

export function showFatal(err) {
  console.error(err);
  const box = document.createElement('div');
  box.className = 'fatal';
  box.innerHTML = `<span class="ms">error</span><div><strong>Something went wrong loading the decorations.</strong><br>${escapeHtml(err?.message || err)}<br><small>Tip: serve the <code>public/</code> folder over HTTP (e.g. <code>npm start</code>) — opening the HTML file directly blocks asset loading.</small></div>`;
  document.body.appendChild(box);
}
