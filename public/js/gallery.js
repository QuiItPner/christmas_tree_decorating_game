import {
  $, mountChrome, loadLibrary, showFatal, escapeHtml, formatDate, uid, clone,
  listGallery, upsertGalleryItem, patchGalleryItem, deleteGalleryItem, normalizeDesign, GALLERY_LIMIT,
  toast, confirmDialog, promptDialog, alertDialog, shareLink, copyText, downloadBlob, fileSafe, prefs,
} from './core.js';
import { renderDesignSVG, designToPngBlob, bgLabel, TREE_STYLES } from './render.js';
import { THEMES, themeById, designFromTheme } from './themes-data.js';

mountChrome('gallery');

let lib = null;
const view = { filter: 'all', q: '', sort: prefs.get('gallerySort', 'newest'), layout: prefs.get('galleryLayout', 'grid') };

const hasGreeting = (d) => d.greeting?.visible && (d.greeting.text || d.greeting.name);
function feature(d) {
  if (hasGreeting(d)) return ['mail', 'Greeting Attached'];
  if (d.decorations.some((x) => x.locked)) return ['lock', 'Locked Layering'];
  if (!d.tree.branchesLinked) return ['tune', 'Custom Branches'];
  if (d.effects?.twinkle) return ['auto_awesome', 'Twinkle Enabled'];
  return ['park', TREE_STYLES.find((s) => s.id === d.tree.style)?.label || 'Custom Tree'];
}

function renderMeter(n) {
  $('#meter-text').innerHTML = `Stored locally in your browser · <b>${n} of ${GALLERY_LIMIT}</b> trees`;
  $('#meter-bar').style.width = `${Math.min(100, (n / GALLERY_LIMIT) * 100)}%`;
}
function renderFilters(items) {
  const favs = items.filter((x) => x.favorite).length;
  const greets = items.filter((x) => hasGreeting(x.design)).length;
  const F = [
    ['all', 'park', `All Saved Trees (${items.length})`], ['recent', 'schedule', 'Recent'],
    ['greetings', 'mail', `Holiday Greetings (${greets})`], ['favorites', 'favorite', `Favorites (${favs})`],
  ];
  $('#filters').innerHTML = F.map(([id, ic, label]) => `<button type="button" class="chip ${view.filter === id ? 'active' : ''}" data-filter="${id}" aria-pressed="${view.filter === id}"><span class="ms">${ic}</span>${label}</button>`).join('');
}

function render() {
  const items = listGallery();
  renderMeter(items.length);
  renderFilters(items);
  const week = Date.now() - 7 * 864e5;
  const q = view.q.trim().toLowerCase();
  let list = items.filter((x) => {
    if (view.filter === 'recent' && x.updatedAt < week) return false;
    if (view.filter === 'greetings' && !hasGreeting(x.design)) return false;
    if (view.filter === 'favorites' && !x.favorite) return false;
    if (q && !`${x.name} ${x.design.greeting?.text || ''} ${themeById(x.design.themeId)?.name || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  list = list.sort(view.sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.updatedAt - a.updatedAt);
  const grid = $('#grid');
  grid.classList.toggle('list', view.layout === 'list');
  $('#btn-view .ms').textContent = view.layout === 'list' ? 'grid_view' : 'view_agenda';
  $('#btn-view').title = view.layout === 'list' ? 'Switch to grid view' : 'Switch to list view';
  $('#btn-sort').title = view.sort === 'name' ? 'Sort: A–Z' : 'Sort: newest first';
  $('#btn-sort .ms').textContent = view.sort === 'name' ? 'sort_by_alpha' : 'sort';

  if (!items.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="ms">forest</span><h3>Your gallery is waiting for its first tree</h3><p>Decorate a tree in the studio and press <b>Save Design</b> — it will appear here, stored privately in this browser.</p><div class="row"><a class="btn btn-berry" href="studio.html?new=1"><span class="ms">brush</span>Start Decorating</a><button class="btn btn-ghost" type="button" id="btn-samples"><span class="ms">auto_awesome</span>Add 3 sample trees</button></div></div>`;
    return;
  }
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="ms">search_off</span><h3>No trees match</h3><p>Try another filter or search word.</p></div>`;
    return;
  }
  grid.innerHTML = list.map((x) => {
    const d = x.design;
    const theme = themeById(d.themeId);
    const [fi, ft] = feature(d);
    const svg = lib ? renderDesignSVG(d, lib, { uid: `g-${x.id}`, title: x.name }).replace(/viewBox="0 0 600 720"/, 'viewBox="0 60 600 600" preserveAspectRatio="xMidYMid slice"') : '';
    return `<article class="card tree-card" data-id="${x.id}">
      <div class="thumb" data-act="card" role="button" tabindex="0" aria-label="View ${escapeHtml(x.name)} as a card">${svg}
        <span class="theme-chip"><span class="ms">${theme ? theme.icon : 'palette'}</span>${escapeHtml(theme ? theme.name : 'Custom Design')}</span>
        <span class="corner">
          <button class="icon-btn fav ${x.favorite ? 'on' : ''}" type="button" data-act="fav" aria-pressed="${!!x.favorite}" aria-label="${x.favorite ? 'Remove from' : 'Add to'} favorites" title="Favorite"><span class="ms">favorite</span></button>
          <button class="icon-btn" type="button" data-act="menu" aria-haspopup="menu" aria-label="More actions for ${escapeHtml(x.name)}" title="More"><span class="ms">more_vert</span></button>
        </span>
      </div>
      <div class="info">
        <div class="title-row"><h3 title="${escapeHtml(x.name)}">${escapeHtml(x.name)}</h3><span class="count">${d.decorations.length} Ornament${d.decorations.length === 1 ? '' : 's'}</span></div>
        <div class="meta">Last modified ${escapeHtml(formatDate(x.updatedAt))} · ${escapeHtml(bgLabel(d.background.theme))}</div>
        <div class="foot">
          <span class="feat"><span class="ms">${fi}</span>${escapeHtml(ft)}</span>
          <span class="btns">
            <button class="btn btn-ghost btn-sm" type="button" data-act="card"><span class="ms">visibility</span>Card</button>
            <a class="btn btn-pine btn-sm" href="studio.html?id=${encodeURIComponent(x.id)}"><span class="ms">edit</span>Edit</a>
          </span>
        </div>
      </div>
    </article>`;
  }).join('');
}

/* ---------------- actions ---------------- */
const byId = (id) => listGallery().find((x) => x.id === id);
async function exportItem(item) {
  toast('Wrapping up your festive PNG…', 'hourglass_top');
  try {
    const blob = await designToPngBlob(normalizeDesign(item.design, lib), lib, 2);
    downloadBlob(blob, `${fileSafe(item.name)}.png`);
    toast('PNG downloaded — Merry Christmas!', 'download_done');
  } catch (err) { alertDialog('Export failed', err.message); }
}
async function copyLink(item) {
  const url = await shareLink(normalizeDesign(item.design, lib));
  const ok = await copyText(url);
  toast(ok ? 'Card link copied — paste it to a friend!' : 'Could not copy the link', ok ? 'link' : 'error');
}
function openViewer(item) {
  const v = document.createElement('div');
  v.className = 'viewer';
  v.setAttribute('role', 'dialog');
  v.setAttribute('aria-modal', 'true');
  v.setAttribute('aria-label', `${item.name} card`);
  v.innerHTML = `<div class="art twinkle-on">${renderDesignSVG(normalizeDesign(item.design, lib), lib, { uid: 'view', title: item.name })}</div>
    <div class="row">
      <button class="btn btn-ghost" type="button" data-v="close"><span class="ms">close</span>Close</button>
      <button class="btn btn-soft" type="button" data-v="link"><span class="ms">link</span>Copy card link</button>
      <button class="btn btn-berry" type="button" data-v="png"><span class="ms">download</span>Export PNG</button>
      <a class="btn btn-pine" href="studio.html?id=${encodeURIComponent(item.id)}"><span class="ms">edit</span>Edit</a>
    </div>`;
  const close = () => { v.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  v.addEventListener('click', (e) => {
    const a = e.target.closest('[data-v]')?.dataset.v;
    if (e.target === v || a === 'close') close();
    if (a === 'link') copyLink(item);
    if (a === 'png') exportItem(item);
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(v);
  v.querySelector('[data-v="close"]').focus();
}
function closeMenu() { document.querySelector('.menu')?.remove(); }
function openMenu(btn, item) {
  closeMenu();
  const m = document.createElement('div');
  m.className = 'menu';
  m.setAttribute('role', 'menu');
  m.innerHTML = [
    ['rename', 'drive_file_rename_outline', 'Rename'], ['duplicate', 'content_copy', 'Duplicate'],
    ['png', 'image', 'Export PNG'], ['link', 'link', 'Copy share link'], ['json', 'file_download', 'Download design file'],
    ['delete', 'delete', 'Delete', 'danger'],
  ].map(([a, ic, l, cls]) => `<button type="button" role="menuitem" data-m="${a}" class="${cls || ''}"><span class="ms">${ic}</span>${l}</button>`).join('');
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect();
  const left = Math.min(window.scrollX + r.right - m.offsetWidth, window.scrollX + document.documentElement.clientWidth - m.offsetWidth - 8);
  m.style.left = `${Math.max(8, left)}px`;
  m.style.top = `${window.scrollY + r.bottom + 6}px`;
  m.querySelector('button').focus();
  m.addEventListener('keydown', (e) => {
    const btns = [...m.querySelectorAll('button')];
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
    if (e.key === 'Escape') { closeMenu(); btn.focus(); }
  });
  m.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-m]')?.dataset.m;
    if (!a) return;
    closeMenu();
    try {
      if (a === 'rename') {
        const name = await promptDialog('Rename this tree', item.name, 'Rename');
        if (name) { const d = clone(item.design); d.name = name.slice(0, 60); patchGalleryItem(item.id, { name: d.name, design: d }, true); render(); }
      }
      if (a === 'duplicate') {
        const d = clone(item.design); d.name = `${item.name} (copy)`.slice(0, 60);
        upsertGalleryItem({ id: uid('tree'), name: d.name, design: d, favorite: false }); render(); toast('Tree duplicated', 'content_copy');
      }
      if (a === 'png') exportItem(item);
      if (a === 'link') copyLink(item);
      if (a === 'json') {
        const blob = new Blob([JSON.stringify({ type: 'my-little-christmas-tree', version: 1, design: item.design }, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `${fileSafe(item.name)}.json`);
      }
      if (a === 'delete') {
        if (await confirmDialog(`Delete “${item.name}”?`, 'This removes it from your gallery in this browser. It cannot be undone.', 'Delete tree')) {
          deleteGalleryItem(item.id); render(); toast('Tree deleted', 'delete');
        }
      }
    } catch (err) { alertDialog('Something went wrong', err.message); }
  });
}
document.addEventListener('click', (e) => { if (!e.target.closest('.menu') && !e.target.closest('[data-act="menu"]')) closeMenu(); });
window.addEventListener('resize', closeMenu);

$('#grid').addEventListener('click', (e) => {
  if (e.target.id === 'btn-samples') return addSamples();
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const item = byId(b.closest('.tree-card')?.dataset.id);
  if (!item) return;
  e.stopPropagation();
  if (b.dataset.act === 'fav') { patchGalleryItem(item.id, { favorite: !item.favorite }); render(); }
  if (b.dataset.act === 'menu') openMenu(b, item);
  if (b.dataset.act === 'card') openViewer(item);
});
$('#grid').addEventListener('keydown', (e) => {
  const t = e.target.closest('.thumb[data-act="card"]');
  if (t && e.target === t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openViewer(byId(t.closest('.tree-card').dataset.id)); }
});
$('#filters').addEventListener('click', (e) => { const b = e.target.closest('[data-filter]'); if (b) { view.filter = b.dataset.filter; render(); } });
$('#search').addEventListener('input', (e) => { view.q = e.target.value; render(); });
$('#btn-view').addEventListener('click', () => { view.layout = view.layout === 'list' ? 'grid' : 'list'; prefs.set('galleryLayout', view.layout); render(); });
$('#btn-sort').addEventListener('click', () => { view.sort = view.sort === 'name' ? 'newest' : 'name'; prefs.set('gallerySort', view.sort); render(); toast(view.sort === 'name' ? 'Sorted A–Z' : 'Newest first', 'sort'); });

$('#btn-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 1_000_000) throw new Error('That file is too large to be a tree design.');
    const json = JSON.parse(await file.text());
    const d = normalizeDesign(json.design || json, lib);
    const it = upsertGalleryItem({ id: uid('tree'), name: d.name, design: d });
    render();
    toast(`Imported “${it.name}”`, 'upload');
  } catch (err) {
    alertDialog('Could not import', err instanceof SyntaxError ? 'That file is not a valid design file (.json).' : err.message);
  }
});

function addSamples() {
  const names = ["Grandma's Cozy Fir", 'Christmas Eve Sparkle', 'Candy Wonderland'];
  [THEMES[0], THEMES[5], THEMES[2]].forEach((t, i) => {
    const d = designFromTheme(t, lib, { seed: `sample-${t.id}` });
    d.name = names[i];
    upsertGalleryItem({ id: uid('tree'), name: d.name, design: d, favorite: i === 0 });
  });
  render();
  toast('Three sample trees added', 'auto_awesome');
}

(async () => {
  lib = await loadLibrary();
  try { await Promise.race([document.fonts.load('800 26px Epilogue'), new Promise((r) => setTimeout(r, 1000))]); } catch { /* ignore */ }
  render();
})().catch(showFatal);
