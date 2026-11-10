/* =========================================================
   Tree Studio — the editor
   ========================================================= */
import {
  $, $$, clamp, round, clone, uid, escapeHtml, safeColor, prefersReducedMotion,
  loadLibrary, defaultDesign, normalizeDesign, loadCurrent, saveCurrent,
  decodeDesign, shareLink, copyText, downloadBlob, fileSafe,
  toast, confirmDialog, alertDialog, mountChrome, showFatal,
} from './core.js?v=20261111f';
import {
  W, H, TREE_STYLES, BACKGROUNDS, treeGeometry, renderTree, renderBackground, renderDecoration,
  renderGreeting, transformOf, assetSVG, designToPngBlob, generateDecorations, suggestPosition,
} from './render.js?v=20261111f';
import { THEMES, themeById, designFromTheme } from './themes-data.js?v=20261111f';

mountChrome('studio', { share: true, noFooter: true, primary: { label: 'Xuất PNG', icon: 'download', id: 'hdr-export' } });

/* ---------------- state ---------------- */
const S = {
  lib: null,
  design: null,
  selected: null,
  snap: '',
  history: [],
  future: [],
  zoom: 1,
  preview: false,
  cat: 'all',
  query: '',
  autosavedAt: null,
  tab: 'item',
  sheet: null,
};
const MAX_HISTORY = 100;
const isMobile = () => window.matchMedia('(max-width: 1023px)').matches;
const D = () => S.design;
const sel = () => S.design.decorations.find((d) => d.instanceId === S.selected) || null;
const assetOf = (d) => S.lib.byId[d.assetId];

const el = {
  stage: $('#stage'), frame: $('#stage-frame'), wrap: $('#stage-wrap'),
  bg: $('#L-bg'), tree: $('#L-tree'), decos: $('#L-decos'), greet: $('#L-greet'), ui: $('#L-ui'),
  float: $('#float-bar'), snow: $('#snowfall'),
  left: $('#panel-library'), right: $('#panel-inspector'),
};

/* ---------------- history ---------------- */
const snapshot = () => JSON.stringify({ d: S.design });
function restore(snap) {
  const o = JSON.parse(snap);
  S.design = o.d;
  S.snap = snap;
  if (!sel()) S.selected = null;
  renderAll();
  autosave();
}
function commit() {
  const now = snapshot();
  if (now === S.snap) return;
  S.history.push(S.snap);
  if (S.history.length > MAX_HISTORY) S.history.shift();
  S.future = [];
  S.snap = now;
  autosave();
  updateHistoryButtons();
}
let commitTimer = null;
const commitSoon = (ms = 450) => { clearTimeout(commitTimer); commitTimer = setTimeout(commit, ms); };
function undo() {
  clearTimeout(commitTimer); commit();
  if (!S.history.length) return;
  S.future.push(S.snap);
  restore(S.history.pop());
  toast('Đã hoàn tác', 'undo');
}
function redo() {
  if (!S.future.length) return;
  S.history.push(S.snap);
  restore(S.future.pop());
  toast('Đã làm lại', 'redo');
}
function updateHistoryButtons() {
  $('#btn-undo').disabled = !S.history.length;
  $('#btn-redo').disabled = !S.future.length;
}
function autosave() {
  if (saveCurrent(S.design)) S.autosavedAt = Date.now();
}

/* ---------------- rendering ---------------- */
const renderBg = () => { el.bg.innerHTML = renderBackground(D().background, 'sbg'); };
const renderTreeLayer = () => { el.tree.innerHTML = renderTree(D().tree, 'stree'); };
const renderDecos = () => { el.decos.innerHTML = D().decorations.map((d) => renderDecoration(d, S.lib, 's-')).join(''); };
const renderGreet = () => { el.greet.innerHTML = renderGreeting(D().greeting); };

function renderAll() {
  renderBg(); renderTreeLayer(); renderDecos(); renderGreet();
  applyEffects();
  syncPanels();
  renderItemEditor();
  renderLayers();
  drawSelection();
  updateHistoryButtons();
}

function updateDecoNode(d) {
  const node = el.decos.querySelector(`[data-id="${d.instanceId}"]`);
  if (node) node.setAttribute('transform', transformOf(d));
}

/* ---------------- stage geometry ---------------- */
function toStage(clientX, clientY) {
  const pt = el.stage.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const m = el.stage.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = pt.matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}
function toClient(x, y) {
  const pt = el.stage.createSVGPoint();
  pt.x = x; pt.y = y;
  const p = pt.matrixTransform(el.stage.getScreenCTM());
  return { x: p.x, y: p.y };
}
const unitsPerPx = () => W / Math.max(1, el.frame.clientWidth);

function fit() {
  const wrap = el.wrap;
  const cs = getComputedStyle(wrap);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const availW = Math.max(50, wrap.clientWidth - padX);
  const availH = Math.max(50, wrap.clientHeight - padY);
  const base = Math.min(availW / W, availH / H);
  const s = base * S.zoom;
  el.frame.style.width = `${Math.round(W * s)}px`;
  el.frame.style.height = `${Math.round(H * s)}px`;
  $('#zoom-level').textContent = `${Math.round(S.zoom * 100)}%`;
  resizeSnow();
  drawSelection();
}
function setZoom(z) {
  S.zoom = clamp(round(z, 2), 0.5, 2.5);
  fit();
}

/* ---------------- selection overlay ---------------- */
function selectionCorners(d, pad = 0) {
  const hw = (d.width * d.scale) / 2 + pad, hh = (d.height * d.scale) / 2 + pad;
  const rad = (d.rotation * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
  const pt = (lx, ly) => [d.x + lx * c - ly * s, d.y + lx * s + ly * c];
  return { pt, hw, hh, corners: [pt(-hw, -hh), pt(hw, -hh), pt(hw, hh), pt(-hw, hh)] };
}
function drawSelection() {
  const d = sel();
  if (!d || S.preview) { el.ui.innerHTML = ''; el.float.classList.remove('show'); return; }
  const u = unitsPerPx();
  const { pt, hh, corners } = selectionCorners(d, 6 * u);
  const rot = pt(0, -hh - 28 * u);
  const top = pt(0, -hh);
  const color = d.locked ? '#6F7A71' : '#B90C17';
  const r = 6 * u;
  let html = `<polygon points="${corners.map((p) => p.map((v) => round(v)).join(',')).join(' ')}" fill="none" stroke="#fff" stroke-width="${round(3.5 * u)}" pointer-events="none" opacity=".8"/>`;
  html += `<polygon points="${corners.map((p) => p.map((v) => round(v)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${round(1.6 * u)}" stroke-dasharray="${round(6 * u)} ${round(4 * u)}" pointer-events="none"/>`;
  if (!d.locked) {
    html += `<line x1="${round(top[0])}" y1="${round(top[1])}" x2="${round(rot[0])}" y2="${round(rot[1])}" stroke="${color}" stroke-width="${round(1.6 * u)}" pointer-events="none"/>`;
    html += `<g data-handle="rotate" class="handle-rot"><circle cx="${round(rot[0])}" cy="${round(rot[1])}" r="${round(r * 2.8)}" fill="#000" fill-opacity="0"/><circle cx="${round(rot[0])}" cy="${round(rot[1])}" r="${round(r * 1.15)}" fill="#fff" stroke="${color}" stroke-width="${round(2 * u)}"/><path d="M${round(rot[0] - r * 0.5)} ${round(rot[1] + r * 0.1)}a${round(r * 0.5)} ${round(r * 0.5)} 0 1 1 ${round(r * 0.5)} ${round(r * 0.5)}" fill="none" stroke="${color}" stroke-width="${round(1.6 * u)}" stroke-linecap="round" pointer-events="none"/></g>`;
    corners.forEach(([x, y]) => {
      html += `<g data-handle="scale" class="handle"><circle cx="${round(x)}" cy="${round(y)}" r="${round(r * 2.6)}" fill="#000" fill-opacity="0"/><circle cx="${round(x)}" cy="${round(y)}" r="${round(r)}" fill="${color}" stroke="#fff" stroke-width="${round(2 * u)}"/></g>`;
    });
  }
  el.ui.innerHTML = html;
  positionFloatBar([...corners, rot]);
}
function positionFloatBar(points) {
  const wrapRect = el.wrap.getBoundingClientRect();
  const cps = points.map(([x, y]) => toClient(x, y));
  const minY = Math.min(...cps.map((p) => p.y));
  const maxY = Math.max(...cps.map((p) => p.y));
  const cx = cps.reduce((s, p) => s + p.x, 0) / cps.length;
  const bar = el.float;
  bar.classList.add('show');
  const bw = bar.offsetWidth || 180;
  let left = cx - wrapRect.left + el.wrap.scrollLeft;
  left = clamp(left, bw / 2 + 6, el.wrap.scrollWidth - bw / 2 - 6);
  let topPx = minY - wrapRect.top + el.wrap.scrollTop - 10;
  const below = minY - wrapRect.top < 56;
  if (below) topPx = maxY - wrapRect.top + el.wrap.scrollTop + 10;
  bar.classList.toggle('below', below);
  bar.style.left = `${left}px`;
  bar.style.top = `${topPx}px`;
  const d = sel();
  const lockBtn = bar.querySelector('[data-act="lock"]');
  lockBtn.classList.toggle('on', !!d?.locked);
  lockBtn.querySelector('.ms').textContent = d?.locked ? 'lock' : 'lock_open';
  lockBtn.title = d?.locked ? 'Mở khoá' : 'Khoá vị trí';
  bar.querySelectorAll('[data-act="rotate"],[data-act="forward"],[data-act="duplicate"]').forEach((b) => { b.disabled = !!d?.locked && b.dataset.act === 'rotate'; });
}

function select(id) {
  if (S.selected === id) { drawSelection(); return; }
  S.selected = id;
  drawSelection();
  renderItemEditor();
  renderLayers();
}

/* ---------------- decoration operations ---------------- */
function addAsset(assetId, pos = null) {
  const a = S.lib.byId[assetId];
  if (!a) return;
  const p = pos || suggestPosition(D(), a, S.lib);
  const deco = {
    instanceId: uid('placed'), assetId, x: round(p.x, 1), y: round(p.y, 1), width: a.width, height: a.height,
    rotation: 0, scale: 1, color: a.colorable ? a.defaultColor : null, locked: false, flip: false,
  };
  D().decorations.push(deco);
  renderDecos();
  el.decos.querySelector(`[data-id="${deco.instanceId}"]`)?.classList.add('pop-in');
  S.selected = deco.instanceId;
  drawSelection(); renderItemEditor(); renderLayers();
  commit();
  if (isMobile()) toast(`Đã thêm ${a.name}`, 'add_circle');
}
function removeSelected() {
  const d = sel();
  if (!d) return;
  D().decorations = D().decorations.filter((x) => x !== d);
  S.selected = null;
  renderDecos(); drawSelection(); renderItemEditor(); renderLayers();
  commit();
  toast(`Đã xoá ${assetOf(d)?.name || 'đồ trang trí'} — có thể Hoàn tác trên thanh công cụ`, 'delete');
}
function duplicateSelected() {
  const d = sel();
  if (!d) return;
  const copy = { ...clone(d), instanceId: uid('placed'), x: d.x + 20, y: d.y + 16, locked: false };
  const list = D().decorations;
  list.splice(list.indexOf(d) + 1, 0, copy);
  S.selected = copy.instanceId;
  renderDecos(); drawSelection(); renderItemEditor(); renderLayers();
  commit();
}
function reorder(kind) {
  const d = sel();
  if (!d) return;
  const list = D().decorations;
  const i = list.indexOf(d);
  list.splice(i, 1);
  const j = { forward: Math.min(list.length, i + 1), backward: Math.max(0, i - 1), front: list.length, back: 0 }[kind];
  list.splice(j, 0, d);
  renderDecos(); drawSelection(); renderItemEditor(); renderLayers();
  commit();
}
function patchSelected(patch, live = false) {
  const d = sel();
  if (!d) return;
  Object.assign(d, patch);
  if ('color' in patch || 'flip' in patch || 'locked' in patch) {
    renderDecos();
  } else updateDecoNode(d);
  drawSelection();
  syncItemEditor();
  if ('locked' in patch) { renderItemEditor(); renderLayers(); }
  if ('color' in patch) renderLayers();
  if (!live) commit();
}

/* ---------------- stage pointer interactions ---------------- */
const pointers = new Map();
let gesture = null;

el.stage.addEventListener('pointerdown', (e) => {
  if (S.preview || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const p = toStage(e.clientX, e.clientY);
  pointers.set(e.pointerId, p);
  try { el.stage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  const d0 = sel();
  if (pointers.size === 2 && d0 && !d0.locked) {
    const [a, b] = [...pointers.values()];
    gesture = { type: 'pinch', dist0: Math.hypot(b.x - a.x, b.y - a.y) || 1, ang0: Math.atan2(b.y - a.y, b.x - a.x), scale0: d0.scale, rot0: d0.rotation, moved: true };
    return;
  }
  if (pointers.size > 1) return;
  const handle = e.target.closest('[data-handle]');
  const decoNode = e.target.closest('.deco');
  if (handle && d0) {
    if (handle.dataset.handle === 'scale') gesture = { type: 'scale', dist0: Math.hypot(p.x - d0.x, p.y - d0.y) || 1, scale0: d0.scale, moved: true };
    else gesture = { type: 'rotate', ang0: Math.atan2(p.y - d0.y, p.x - d0.x), rot0: d0.rotation, moved: true };
  } else if (decoNode) {
    select(decoNode.dataset.id);
    const d = sel();
    if (d && !d.locked) gesture = { type: 'move', dx: p.x - d.x, dy: p.y - d.y, sx: p.x, sy: p.y, moved: false };
  } else {
    select(null);
  }
  e.preventDefault();
});
el.stage.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const p = toStage(e.clientX, e.clientY);
  pointers.set(e.pointerId, p);
  const d = sel();
  if (!gesture || !d) return;
  if (gesture.type === 'move') {
    if (!gesture.moved && Math.hypot(p.x - gesture.sx, p.y - gesture.sy) < 2.5 * unitsPerPx()) return;
    gesture.moved = true;
    el.stage.classList.add('dragging');
    d.x = round(clamp(p.x - gesture.dx, -40, W + 40), 1);
    d.y = round(clamp(p.y - gesture.dy, -40, H + 40), 1);
  } else if (gesture.type === 'scale') {
    d.scale = round(clamp((gesture.scale0 * Math.hypot(p.x - d.x, p.y - d.y)) / gesture.dist0, 0.3, 4), 3);
  } else if (gesture.type === 'rotate') {
    let deg = gesture.rot0 + ((Math.atan2(p.y - d.y, p.x - d.x) - gesture.ang0) * 180) / Math.PI;
    deg = ((deg + 540) % 360) - 180;
    const snap = Math.round(deg / 45) * 45;
    if (Math.abs(deg - snap) < 4 && !e.altKey) deg = snap;
    d.rotation = round(deg, 1);
  } else if (gesture.type === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    d.scale = round(clamp((gesture.scale0 * Math.hypot(b.x - a.x, b.y - a.y)) / gesture.dist0, 0.3, 4), 3);
    let deg = gesture.rot0 + ((Math.atan2(b.y - a.y, b.x - a.x) - gesture.ang0) * 180) / Math.PI;
    d.rotation = round(((deg + 540) % 360) - 180, 1);
  }
  updateDecoNode(d);
  drawSelection();
  syncItemEditor();
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (gesture && (gesture.type !== 'pinch' || pointers.size < 2)) {
    if (gesture.moved) commit();
    gesture = null;
    el.stage.classList.remove('dragging');
  }
}
el.stage.addEventListener('pointerup', endPointer);
el.stage.addEventListener('pointercancel', endPointer);
el.stage.addEventListener('dblclick', (e) => {
  if (e.target.closest('.deco') && isMobile()) openSheet('item');
});
el.wrap.addEventListener('scroll', () => drawSelection(), { passive: true });

el.float.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const d = sel();
  if (!act || !d) return;
  if (act === 'rotate') patchSelected({ rotation: ((d.rotation + 15 + 540) % 360) - 180 });
  if (act === 'duplicate') duplicateSelected();
  if (act === 'forward') reorder('forward');
  if (act === 'lock') patchSelected({ locked: !d.locked });
  if (act === 'delete') removeSelected();
});

/* ---------------- keyboard ---------------- */
let nudgeTimer = null;
document.addEventListener('keydown', (e) => {
  const t = e.target;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (document.querySelector('.modal-backdrop')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') {
    if (S.preview && !document.body.classList.contains('shared')) { setPreview(false); return; }
    if (typing) return;
    closeSheets(); select(null); return;
  }
  if (typing) return;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (S.preview) return;
  const d = sel();
  if (!d) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if (e.key === ']') { reorder(mod ? 'front' : 'forward'); return; }
  if (e.key === '[') { reorder(mod ? 'back' : 'backward'); return; }
  const step = e.shiftKey ? 10 : 2;
  const move = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key];
  if (move && !d.locked) {
    e.preventDefault();
    d.x = round(d.x + move[0], 1); d.y = round(d.y + move[1], 1);
    updateDecoNode(d); drawSelection();
    clearTimeout(nudgeTimer); nudgeTimer = setTimeout(commit, 400);
  }
});

/* ---------------- library ---------------- */
function renderCats() {
  const cats = [{ id: 'all', short: 'Tất cả' }, ...S.lib.categories];
  $('#lib-cats').innerHTML = cats.map((c) => `<button type="button" class="chip ${S.cat === c.id ? 'active' : ''}" data-cat="${c.id}" aria-pressed="${S.cat === c.id}">${escapeHtml(c.short)}</button>`).join('');
}
function renderLibrary() {
  const q = S.query.trim().toLowerCase();
  const catName = Object.fromEntries(S.lib.categories.map((c) => [c.id, c.name.toLowerCase()]));
  const list = S.lib.decorations.filter((a) => (S.cat === 'all' || a.category === S.cat)
    && (!q || `${a.name} ${a.keywords || ''} ${catName[a.category] || ''}`.toLowerCase().includes(q)));
  $('#lib-count').textContent = `${S.lib.decorations.length} món`;
  $('#lib-grid').innerHTML = list.length
    ? list.map((a) => `<div class="asset-tile" data-asset="${a.id}" role="button" tabindex="0" aria-label="Thêm ${escapeHtml(a.name)}" title="${escapeHtml(a.name)} — kéo lên cây hoặc bấm để thêm">
        <div class="thumb">${assetSVG(a, a.defaultColor, 'lib')}</div>
        <button class="add" type="button" data-add tabindex="-1"><span class="ms">add</span>Thêm</button>
      </div>`).join('')
    : `<div class="no-results">Không có món nào khớp “${escapeHtml(S.query)}”.</div>`;
}
$('#lib-cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  S.cat = b.dataset.cat;
  renderCats(); renderLibrary();
});
$('#lib-search').addEventListener('input', (e) => { S.query = e.target.value; renderLibrary(); });

let libDrag = null;
let suppressClick = false;
const grid = $('#lib-grid');
grid.addEventListener('contextmenu', (e) => { if (e.target.closest('.asset-tile')) e.preventDefault(); });
grid.addEventListener('click', (e) => {
  const tile = e.target.closest('.asset-tile');
  if (!tile) return;
  if (suppressClick) { suppressClick = false; return; }
  addAsset(tile.dataset.asset);
});
grid.addEventListener('keydown', (e) => {
  const tile = e.target.closest('.asset-tile');
  if (tile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); addAsset(tile.dataset.asset); }
});
grid.addEventListener('pointerdown', (e) => {
  const tile = e.target.closest('.asset-tile');
  if (!tile || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('[data-add]')) return;
  libDrag = { id: tile.dataset.asset, tile, x0: e.clientX, y0: e.clientY, pid: e.pointerId, active: false, touch: e.pointerType !== 'mouse', timer: null, ghost: null, last: [e.clientX, e.clientY] };
  if (libDrag.touch) libDrag.timer = setTimeout(() => { if (libDrag && !libDrag.active) startLibDrag(); }, 260);
});
grid.addEventListener('touchmove', (e) => { if (libDrag?.active) e.preventDefault(); }, { passive: false });
function startLibDrag() {
  const a = S.lib.byId[libDrag.id];
  libDrag.active = true;
  libDrag.tile.classList.add('picked');
  const g = document.createElement('div');
  g.className = 'drag-ghost';
  g.innerHTML = assetSVG(a, a.defaultColor, 'ghost');
  document.body.appendChild(g);
  libDrag.ghost = g;
  moveGhost(...libDrag.last);
  if (navigator.vibrate && libDrag.touch) navigator.vibrate(12);
}
function overStage(x, y) {
  const r = el.frame.getBoundingClientRect();
  const wr = el.wrap.getBoundingClientRect();
  return x >= Math.max(r.left, wr.left) && x <= Math.min(r.right, wr.right) && y >= Math.max(r.top, wr.top) && y <= Math.min(r.bottom, wr.bottom);
}
function moveGhost(x, y) {
  if (!libDrag?.ghost) return;
  libDrag.ghost.style.left = `${x}px`;
  libDrag.ghost.style.top = `${y}px`;
  el.frame.classList.toggle('drop-hover', overStage(x, y));
}
function endLibDrag() {
  if (!libDrag) return;
  clearTimeout(libDrag.timer);
  libDrag.ghost?.remove();
  libDrag.tile.classList.remove('picked');
  el.frame.classList.remove('drop-hover');
  libDrag = null;
}
window.addEventListener('pointermove', (e) => {
  if (!libDrag || e.pointerId !== libDrag.pid) return;
  libDrag.last = [e.clientX, e.clientY];
  const dist = Math.hypot(e.clientX - libDrag.x0, e.clientY - libDrag.y0);
  if (!libDrag.active) {
    if (libDrag.touch) { if (dist > 10) endLibDrag(); return; }
    if (dist < 5) return;
    startLibDrag();
  }
  moveGhost(e.clientX, e.clientY);
});
window.addEventListener('pointerup', (e) => {
  if (!libDrag || e.pointerId !== libDrag.pid) return;
  if (libDrag.active) {
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
    if (overStage(e.clientX, e.clientY) && !S.preview) {
      const p = toStage(e.clientX, e.clientY);
      addAsset(libDrag.id, p);
    }
  }
  endLibDrag();
});
window.addEventListener('pointercancel', (e) => { if (libDrag && e.pointerId === libDrag.pid) endLibDrag(); });

/* ---------------- colour field component ---------------- */
function colorField(host, { label, swatches, get, onInput, onCommit }) {
  host.innerHTML = `
    ${label ? `<div class="sub"><span>${escapeHtml(label)}</span><small data-hexlabel></small></div>` : ''}
    <div class="swatches">
      ${swatches.map((c) => `<button type="button" class="swatch" style="background:${c}" data-c="${c}" title="${c}" aria-label="${escapeHtml(label || 'Màu')} ${c}"></button>`).join('')}
      <label class="swatch-custom" title="Màu tuỳ chọn"><input type="color" aria-label="Màu tuỳ chọn ${escapeHtml(label || '')}"><span class="ms">colorize</span></label>
      <input class="field hex-input" maxlength="7" spellcheck="false" aria-label="Mã HEX ${escapeHtml(label || 'màu')}">
    </div>`;
  const picker = host.querySelector('input[type=color]');
  const hex = host.querySelector('.hex-input');
  const lbl = host.querySelector('[data-hexlabel]');
  const set = (v) => {
    host.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('active', b.dataset.c.toUpperCase() === (v || '').toUpperCase()));
    if (document.activeElement !== picker) picker.value = (v || '#000000').toLowerCase();
    if (document.activeElement !== hex) hex.value = v || '';
    if (lbl) lbl.textContent = v || '';
  };
  host.addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (!b) return;
    onCommit(b.dataset.c); set(b.dataset.c);
  });
  picker.addEventListener('input', () => { const v = safeColor(picker.value); onInput(v); set(v); });
  picker.addEventListener('change', () => { const v = safeColor(picker.value); onCommit(v); set(v); });
  const fromHex = () => {
    let v = hex.value.trim();
    if (v && v[0] !== '#') v = '#' + v;
    const c = safeColor(v, null);
    if (c) { onCommit(c); set(c); } else { hex.value = get(); toast('Hãy nhập mã HEX, ví dụ #D62828', 'palette'); }
  };
  hex.addEventListener('change', fromHex);
  hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); hex.blur(); } });
  set(get());
  return { set, sync: () => set(get()) };
}

/* ---------------- item editor ---------------- */
let itemColorField = null;
function renderItemEditor() {
  const host = $('#item-editor');
  const d = sel();
  itemColorField = null;
  if (!d) {
    host.innerHTML = '';
    return;
  }
  const a = assetOf(d);
  const list = D().decorations;
  const idx = list.indexOf(d);
  host.innerHTML = `
    <div class="box">
      <div class="item-summary">
        <div class="thumb">${assetSVG(a, d.color, 'insp')}</div>
        <div class="txt"><b>${escapeHtml(a.name)}</b><span>Lớp #${idx + 1}/${list.length} · ${d.locked ? 'Đã khoá' : 'Đang chọn'}</span></div>
        <button class="icon-btn sm ${d.locked ? 'on' : ''}" type="button" data-act="lock" title="${d.locked ? 'Mở khoá' : 'Khoá vị trí'}" aria-label="${d.locked ? 'Mở khoá' : 'Khoá'}"><span class="ms">${d.locked ? 'lock' : 'lock_open'}</span></button>
        <button class="icon-btn sm danger" type="button" data-act="delete" title="Xoá" aria-label="Xoá đồ trang trí"><span class="ms">delete</span></button>
      </div>
    </div>
    <div class="box" ${d.locked ? 'style="opacity:.55;pointer-events:none" aria-disabled="true"' : ''}>
      <h3>Biến đổi &amp; kích thước</h3>
      <div class="slider-row"><div class="top"><span><span class="ms">aspect_ratio</span>Kích thước</span><b id="it-scale-v"></b></div><input type="range" id="it-scale" min="30" max="300" step="1" aria-label="Kích thước"></div>
      <div class="slider-row"><div class="top"><span><span class="ms">rotate_right</span>Góc xoay</span><b id="it-rot-v"></b></div><input type="range" id="it-rot" min="-180" max="180" step="1" aria-label="Góc xoay"></div>
      <div class="sub"><span>Di chuyển</span><small id="it-pos"></small></div>
      <div class="nudge">
        <button type="button" class="up" data-nudge="0,-1" aria-label="Lên trên"><span class="ms">keyboard_arrow_up</span></button>
        <button type="button" class="left" data-nudge="-1,0" aria-label="Sang trái"><span class="ms">keyboard_arrow_left</span></button>
        <button type="button" class="down" data-nudge="0,1" aria-label="Xuống dưới"><span class="ms">keyboard_arrow_down</span></button>
        <button type="button" class="right" data-nudge="1,0" aria-label="Sang phải"><span class="ms">keyboard_arrow_right</span></button>
      </div>
      <div class="btn-grid">
        <button type="button" data-act="duplicate"><span class="ms">content_copy</span>Nhân bản</button>
        <button type="button" data-act="flip"><span class="ms">flip</span>Lật ngang</button>
        <button type="button" data-act="forward" ${idx === list.length - 1 ? 'disabled' : ''}><span class="ms">flip_to_front</span>Đưa lên</button>
        <button type="button" data-act="backward" ${idx === 0 ? 'disabled' : ''}><span class="ms">flip_to_back</span>Đưa xuống</button>
        <button type="button" data-act="front" ${idx === list.length - 1 ? 'disabled' : ''}><span class="ms">vertical_align_top</span>Lên trên cùng</button>
        <button type="button" data-act="back" ${idx === 0 ? 'disabled' : ''}><span class="ms">vertical_align_bottom</span>Xuống dưới cùng</button>
      </div>
    </div>
    ${a.colorable ? `<div class="box"><h3><span>Màu sắc</span><button class="link" type="button" data-act="color-reset"><span class="ms">format_color_reset</span>Mặc định</button></h3><div id="it-color"></div></div>` : `<div class="box"><h3>Màu sắc</h3><p style="margin:0;font-size:13px;color:var(--ink-2)">Món này giữ nguyên màu vẽ tay.</p></div>`}`;
  const sc = $('#it-scale'), ro = $('#it-rot');
  sc.addEventListener('input', () => patchSelected({ scale: sc.value / 100 }, true));
  sc.addEventListener('change', commit);
  ro.addEventListener('input', () => patchSelected({ rotation: Number(ro.value) }, true));
  ro.addEventListener('change', commit);
  if (a.colorable) {
    itemColorField = colorField($('#it-color'), {
      label: '', swatches: ['#B90C17', '#E63946', '#F4A261', '#E9A93B', '#FFFFFF', '#B9C6D3', '#4E9BE0', '#176B45', '#F7A8C4', '#7C5700'],
      get: () => sel()?.color || a.defaultColor,
      onInput: (c) => patchSelected({ color: c }, true),
      onCommit: (c) => patchSelected({ color: c }),
    });
  }
  syncItemEditor();
}
function syncItemEditor() {
  const d = sel();
  if (!d || !$('#it-scale')) return;
  const sc = $('#it-scale'), ro = $('#it-rot');
  if (document.activeElement !== sc) sc.value = Math.round(d.scale * 100);
  if (document.activeElement !== ro) ro.value = Math.round(d.rotation);
  $('#it-scale-v').textContent = `${Math.round(d.scale * 100)}%`;
  $('#it-rot-v').textContent = `${Math.round(d.rotation)}°`;
  $('#it-pos').textContent = `x ${Math.round(d.x)} · y ${Math.round(d.y)}`;
  itemColorField?.sync();
}
$('#item-editor').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act],[data-nudge]');
  if (!b) return;
  const d = sel();
  const act = b.dataset.act;
  if (!d) return;
  if (b.dataset.nudge) {
    const [dx, dy] = b.dataset.nudge.split(',').map(Number);
    d.x = round(d.x + dx * 4, 1); d.y = round(d.y + dy * 4, 1);
    updateDecoNode(d); drawSelection(); syncItemEditor(); commitSoon(400);
    return;
  }
  if (act === 'lock') patchSelected({ locked: !d.locked });
  if (act === 'delete') removeSelected();
  if (act === 'duplicate') duplicateSelected();
  if (act === 'flip') patchSelected({ flip: !d.flip });
  if (['forward', 'backward', 'front', 'back'].includes(act)) reorder(act);
  if (act === 'color-reset') { patchSelected({ color: assetOf(d).defaultColor }); }
});

/* ---------------- layers ---------------- */
function renderLayers() {
  const list = D().decorations;
  $('#layer-count').textContent = `(${list.length})`;
  $('#layers').innerHTML = list.length
    ? [...list].reverse().map((d) => {
      const a = assetOf(d);
      return `<div class="layer ${d.instanceId === S.selected ? 'active' : ''}" data-id="${d.instanceId}" role="button" tabindex="0" aria-label="Chọn ${escapeHtml(a.name)}">
        <span class="lthumb">${assetSVG(a, d.color, 'ly-' + d.instanceId)}</span><span class="lname">${escapeHtml(a.name)}</span>
        <button class="lbtn ${d.locked ? 'on' : ''}" type="button" data-lact="lock" aria-label="${d.locked ? 'Mở khoá' : 'Khoá'} ${escapeHtml(a.name)}" title="${d.locked ? 'Mở khoá' : 'Khoá'}"><span class="ms">${d.locked ? 'lock' : 'lock_open'}</span></button>
        <button class="lbtn" type="button" data-lact="delete" aria-label="Xoá ${escapeHtml(a.name)}" title="Xoá"><span class="ms">close</span></button>
      </div>`;
    }).join('')
    : `<p style="margin:0;font-size:13px;color:var(--muted)">Chưa có đồ trang trí — cây đang chờ bạn!</p>`;
}
$('#layers').addEventListener('click', (e) => {
  const row = e.target.closest('.layer');
  if (!row) return;
  const act = e.target.closest('[data-lact]')?.dataset.lact;
  select(row.dataset.id);
  if (act === 'lock') patchSelected({ locked: !sel().locked });
  if (act === 'delete') removeSelected();
});
$('#layers').addEventListener('keydown', (e) => {
  const row = e.target.closest('.layer');
  if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(row.dataset.id); }
});

/* ---------------- tree panel ---------------- */
const fields = {};
function adjustToppers(oldTree) {
  const o = treeGeometry(oldTree).apex;
  const n = treeGeometry(D().tree).apex;
  if (o[0] === n[0] && o[1] === n[1]) return;
  D().decorations.forEach((d) => {
    if (assetOf(d)?.category === 'toppers' && Math.hypot(d.x - o[0], d.y - o[1]) < 95) {
      d.x = round(d.x + n[0] - o[0], 1); d.y = round(d.y + n[1] - o[1], 1);
    }
  });
}
function setTree(patch, live = false) {
  const old = clone(D().tree);
  Object.assign(D().tree, patch);
  if ('style' in patch || 'size' in patch) { adjustToppers(old); renderDecos(); drawSelection(); }
  renderTreeLayer();
  syncTreePanel();
  if (!live) commit();
}
function buildTreePanel() {
  $('#tree-styles').innerHTML = TREE_STYLES.map((s) => `<button type="button" class="style-btn" data-style="${s.id}"><span class="ms">${s.icon}</span>${s.label}</button>`).join('');
  $('#tree-styles').addEventListener('click', (e) => {
    const b = e.target.closest('[data-style]');
    if (!b) return;
    const patch = { style: b.dataset.style };
    if (b.dataset.style === 'snowy' && D().tree.snow < 30) patch.snow = 70;
    setTree(patch);
  });
  const size = $('#tree-size');
  size.addEventListener('input', () => setTree({ size: size.value / 100 }, true));
  size.addEventListener('change', commit);
  const snow = $('#tree-snow');
  snow.addEventListener('input', () => setTree({ snow: Number(snow.value) }, true));
  snow.addEventListener('change', commit);
  $('#tree-lights').addEventListener('change', (e) => setTree({ lights: e.target.checked }));

  fields.leaves = colorField($('#cs-leaves'), {
    label: 'Lá', swatches: ['#0E472A', '#176B45', '#2E8B57', '#88C9A1', '#4F7F7A', '#F2F5F3', '#F7C6D9', '#B9D7EA'],
    get: () => D().tree.leavesColor, onInput: (c) => setTree({ leavesColor: c }, true), onCommit: (c) => setTree({ leavesColor: c }),
  });
  const br = $('#cs-branches');
  br.innerHTML = `<label class="switch" style="margin-bottom:8px"><span style="font-weight:600;font-size:13px">Cành cùng màu với lá</span><input type="checkbox" id="br-link"></label><div id="cs-branches-f"></div>`;
  $('#br-link').addEventListener('change', (e) => setTree({ branchesLinked: e.target.checked }));
  fields.branches = colorField($('#cs-branches-f'), {
    label: 'Cành', swatches: ['#002111', '#0A3A22', '#1F5136', '#5E7F5E', '#3E5C76', '#8B5A2B'],
    get: () => D().tree.branchesColor, onInput: (c) => setTree({ branchesColor: c, branchesLinked: false }, true), onCommit: (c) => setTree({ branchesColor: c, branchesLinked: false }),
  });
  fields.trunk = colorField($('#cs-trunk'), {
    label: 'Thân', swatches: ['#5E3A1A', '#795548', '#A0714F', '#C49A6C', '#3E2C23'],
    get: () => D().tree.trunkColor, onInput: (c) => setTree({ trunkColor: c }, true), onCommit: (c) => setTree({ trunkColor: c }),
  });
  const sk = $('#cs-skirt');
  sk.innerHTML = `<label class="switch" style="margin-bottom:8px"><span style="font-weight:600;font-size:13px">Váy gốc cây</span><input type="checkbox" id="sk-on"></label><div id="cs-skirt-f"></div>`;
  $('#sk-on').addEventListener('change', (e) => setTree({ skirt: e.target.checked }));
  fields.skirt = colorField($('#cs-skirt-f'), {
    label: 'Váy gốc', swatches: ['#B90C17', '#176B45', '#FFFFFF', '#E9A93B', '#1E2A4A', '#F7C6D9', '#D9C7A7'],
    get: () => D().tree.skirtColor, onInput: (c) => setTree({ skirtColor: c }, true), onCommit: (c) => setTree({ skirtColor: c, skirt: true }),
  });
  fields.snow = colorField($('#cs-snow'), {
    label: 'Tuyết', swatches: ['#FFFFFF', '#EAF4FB', '#FDF1F6', '#FFF6D6', '#DDE7F0'],
    get: () => D().tree.snowColor, onInput: (c) => setTree({ snowColor: c }, true),
    onCommit: (c) => setTree(D().tree.snow ? { snowColor: c } : { snowColor: c, snow: 40 }),
  });
  $('#btn-reset-colors').addEventListener('click', () => {
    const def = defaultDesign().tree;
    setTree({ leavesColor: def.leavesColor, trunkColor: def.trunkColor, branchesColor: def.branchesColor, branchesLinked: true, skirtColor: def.skirtColor, snowColor: def.snowColor, skirt: true });
    toast('Đã đặt lại màu cây', 'format_color_reset');
  });
  $('#theme-minis').innerHTML = THEMES.map((t) => `<button type="button" class="theme-mini" data-theme="${t.id}" title="Áp dụng ${escapeHtml(t.name)}"><span>${escapeHtml(t.name)}</span><span class="dots">${t.palette.map((c) => `<i style="background:${c}"></i>`).join('')}</span></button>`).join('');
  $('#theme-minis').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-theme]');
    if (!b) return;
    const t = themeById(b.dataset.theme);
    if (D().decorations.length > 1 && !(await confirmDialog(`Áp dụng “${t.name}”?`, 'Màu cây, nền và đồ trang trí sẽ được thay thế. Bạn luôn có thể Hoàn tác.', 'Áp dụng', false))) return;
    applyTheme(t, true);
  });
}
function snowLabel(v) { return v === 0 ? 'Không' : v <= 40 ? `Nhẹ · ${v}%` : v <= 70 ? `Vừa · ${v}%` : `Dày · ${v}%`; }
function syncTreePanel() {
  const t = D().tree;
  $$('#tree-styles .style-btn').forEach((b) => { b.classList.toggle('active', b.dataset.style === t.style); b.setAttribute('aria-pressed', String(b.dataset.style === t.style)); });
  const size = $('#tree-size'), snow = $('#tree-snow');
  if (document.activeElement !== size) size.value = Math.round(t.size * 100);
  if (document.activeElement !== snow) snow.value = t.snow;
  $('#size-val').textContent = `${Math.round(t.size * 100)}%`;
  $('#snow-val').textContent = snowLabel(Math.round(t.snow));
  $('#tree-lights').checked = t.lights;
  $('#br-link').checked = t.branchesLinked;
  $('#cs-branches-f').style.opacity = t.branchesLinked ? '.55' : '1';
  $('#sk-on').checked = t.skirt;
  Object.values(fields).forEach((f) => f.sync());
}

/* ---------------- scene panel ---------------- */
const sceneFields = {};
function setScene(fn, live = false, parts = ['bg']) {
  fn(D());
  if (parts.includes('bg')) renderBg();
  if (parts.includes('greet')) renderGreet();
  if (parts.includes('fx')) applyEffects();
  syncScenePanel();
  if (!live) commit();
}
function buildScenePanel() {
  $('#bg-grid').innerHTML = BACKGROUNDS.map((b) => `<button type="button" class="bg-btn" data-bg="${b.id}" title="${b.label}" aria-label="${b.label}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"></svg><span>${b.short || b.label}</span></button>`).join('');
  $('#bg-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-bg]');
    if (b) setScene((d) => { d.background.theme = b.dataset.bg; });
  });
  sceneFields.bg = colorField($('#bg-color'), {
    label: 'Màu nền tối giản', swatches: ['#FBE9D7', '#FBE0EA', '#E3F1EA', '#DCE8F5', '#F4EBD9', '#1E2A4A', '#3A2418'],
    get: () => D().background.color,
    onInput: (c) => setScene((d) => { d.background.color = c; d.background.theme = 'minimal'; }, true),
    onCommit: (c) => setScene((d) => { d.background.color = c; d.background.theme = 'minimal'; }),
  });
  const bind = (id, key) => {
    const input = $(id);
    input.addEventListener('input', () => { setScene((d) => { d.greeting[key] = input.value; }, true, ['greet']); commitSoon(700); });
    input.addEventListener('change', commit);
  };
  bind('#gr-text', 'text'); bind('#gr-name', 'name'); bind('#gr-date', 'date');
  $('#gr-visible').addEventListener('change', (e) => setScene((d) => { d.greeting.visible = e.target.checked; }, false, ['greet']));
  sceneFields.greet = colorField($('#gr-color'), {
    label: 'Màu chữ', swatches: ['#0E472A', '#B90C17', '#7C5700', '#1E2A4A', '#231A11', '#C2185B'],
    get: () => D().greeting.color,
    onInput: (c) => setScene((d) => { d.greeting.color = c; }, true, ['greet']),
    onCommit: (c) => setScene((d) => { d.greeting.color = c; d.greeting.visible = true; }, false, ['greet']),
  });
  $('#fx-snow').addEventListener('change', (e) => setScene((d) => { d.effects.snow = e.target.checked; }, false, ['fx']));
  $('#fx-twinkle').addEventListener('change', (e) => setScene((d) => { d.effects.twinkle = e.target.checked; }, false, ['fx']));
  $('#tg-snow').addEventListener('change', (e) => setScene((d) => { d.effects.snow = e.target.checked; }, false, ['fx']));
  $('#tg-twinkle').addEventListener('change', (e) => setScene((d) => { d.effects.twinkle = e.target.checked; }, false, ['fx']));
  const nm = $('#design-name');
  nm.addEventListener('input', () => { D().name = nm.value.slice(0, 60); commitSoon(700); });
  nm.addEventListener('change', () => { if (!nm.value.trim()) { D().name = 'Cây thông của tôi'; nm.value = D().name; } commit(); });
}
function syncScenePanel() {
  const d = D();
  $$('#bg-grid .bg-btn').forEach((b) => {
    const on = b.dataset.bg === d.background.theme;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
    if (b.dataset.bg === 'minimal' || !b.dataset.drawn) {
      b.querySelector('svg').innerHTML = renderBackground({ theme: b.dataset.bg, color: d.background.color }, `bgt-${b.dataset.bg}`);
      b.dataset.drawn = '1';
    }
  });
  const setVal = (sel_, v) => { const i = $(sel_); if (document.activeElement !== i) i.value = v; };
  setVal('#gr-text', d.greeting.text);
  setVal('#gr-name', d.greeting.name);
  setVal('#gr-date', d.greeting.date);
  setVal('#design-name', d.name);
  $('#gr-visible').checked = d.greeting.visible;
  $('#fx-snow').checked = $('#tg-snow').checked = d.effects.snow;
  $('#fx-twinkle').checked = $('#tg-twinkle').checked = d.effects.twinkle;
  Object.values(sceneFields).forEach((f) => f.sync());
}
function syncPanels() { syncTreePanel(); syncScenePanel(); }

/* ---------------- effects: twinkle + snowfall ---------------- */
const snowFx = { flakes: [], raf: 0, running: false, w: 0, h: 0, dpr: 1 };
function resizeSnow() {
  const c = el.snow;
  snowFx.dpr = Math.min(2, window.devicePixelRatio || 1);
  snowFx.w = el.frame.clientWidth; snowFx.h = el.frame.clientHeight;
  c.width = Math.max(1, snowFx.w * snowFx.dpr); c.height = Math.max(1, snowFx.h * snowFx.dpr);
}
function snowLoop() {
  const ctx = el.snow.getContext('2d');
  const { w, h, dpr } = snowFx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  for (const f of snowFx.flakes) {
    f.y += f.v * (h / 600); f.x += Math.sin((f.y + f.p) / 40) * 0.35;
    if (f.y > h + 5) { f.y = -5; f.x = Math.random() * w; }
    ctx.globalAlpha = f.a;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (w / 500), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (snowFx.running) snowFx.raf = requestAnimationFrame(snowLoop);
}
function startSnow() {
  if (snowFx.running) return;
  resizeSnow();
  const { w, h } = snowFx;
  snowFx.flakes = Array.from({ length: 80 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.8 + Math.random() * 2.2, v: 0.3 + Math.random() * 0.9, a: 0.45 + Math.random() * 0.5, p: Math.random() * 100 }));
  snowFx.running = true;
  snowLoop();
}
function stopSnow() {
  snowFx.running = false;
  cancelAnimationFrame(snowFx.raf);
  el.snow.getContext('2d').clearRect(0, 0, el.snow.width, el.snow.height);
}
function applyEffects() {
  const fx = D().effects;
  el.frame.classList.toggle('twinkle-on', fx.twinkle);
  if (fx.snow && !prefersReducedMotion() && !document.hidden) startSnow(); else stopSnow();
}
document.addEventListener('visibilitychange', applyEffects);

/* ---------------- themes / random ---------------- */
function applyTheme(theme, keepWords) {
  const base = keepWords ? D() : null;
  S.design = designFromTheme(theme, S.lib, { base, seed: Math.floor(Math.random() * 1e9) });
  S.selected = null;
  renderAll(); commit();
  toast(`Đã áp dụng “${theme.name}” — tiếp tục tuỳ chỉnh nhé!`, 'palette');
}
const PALETTES = [
  ['#C9182B', '#E9A93B', '#FFFFFF'], ['#4E9BE0', '#E8EEF3', '#B9C6D3'], ['#F7A8C4', '#A8E6CF', '#FCE7B2'],
  ['#FFC93C', '#E9A93B', '#F4A261'], ['#C9182B', '#1E7F4F', '#E9A93B'], ['#C5B3E6', '#F7A8C4', '#FFFFFF'],
];
function randomDecorate() {
  const existingTopper = D().decorations.find((d) => assetOf(d)?.category === 'toppers');
  const pool = S.lib.decorations.map((a) => a.id).filter((id) => id !== 'stocking');
  D().decorations = generateDecorations({
    tree: D().tree, lib: S.lib, pool,
    colors: PALETTES[Math.floor(Math.random() * PALETTES.length)],
    count: 11 + Math.floor(Math.random() * 7),
    topper: existingTopper ? { assetId: existingTopper.assetId, color: existingTopper.color } : undefined,
    gifts: 2 + Math.floor(Math.random() * 3), strands: 1 + Math.floor(Math.random() * 2),
  });
  S.selected = null;
  renderDecos(); drawSelection(); renderItemEditor(); renderLayers();
  commit();
  toast('Phép màu! Cây vừa được trang trí mới', 'auto_fix_high');
}

/* ---------------- toolbar ---------------- */
$('#btn-undo').addEventListener('click', undo);
$('#btn-redo').addEventListener('click', redo);
$('#btn-random').addEventListener('click', randomDecorate);
$('#btn-reset').addEventListener('click', async () => {
  if (!(await confirmDialog('Đặt lại cây mặc định?', 'Đồ trang trí và màu sắc sẽ bị xoá. Bạn có thể khôi phục bằng Hoàn tác.', 'Đặt lại'))) return;
  S.design = defaultDesign();
  S.selected = null;
  renderAll(); commit();
  toast('Cây mới đã sẵn sàng để trang trí', 'restart_alt');
});
$('#btn-clear').addEventListener('click', async () => {
  if (!D().decorations.length) return toast('Không có đồ trang trí nào để xoá', 'info');
  if (D().decorations.length > 3 && !(await confirmDialog('Xoá tất cả đồ trang trí?', 'Cây, màu sắc và lời chúc được giữ nguyên. Hoàn tác sẽ mang đồ trang trí trở lại.', 'Xoá đồ trang trí'))) return;
  D().decorations = [];
  S.selected = null;
  renderDecos(); drawSelection(); renderItemEditor(); renderLayers();
  commit();
});
$('#btn-zoom-in').addEventListener('click', () => setZoom(S.zoom + 0.1));
$('#btn-zoom-out').addEventListener('click', () => setZoom(S.zoom - 0.1));
el.wrap.addEventListener('wheel', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  setZoom(S.zoom * (e.deltaY < 0 ? 1.08 : 0.93));
}, { passive: false });

/* ---------------- preview ---------------- */
function setPreview(on, shared = false) {
  S.preview = on;
  document.body.classList.toggle('preview', on);
  document.body.classList.toggle('shared', on && shared);
  $('#pv-new').hidden = !shared;
  $('#pv-exit').querySelector('span:last-child').textContent = shared ? 'Chỉnh sửa bản sao' : 'Thoát xem trước';
  closeSheets();
  drawSelection();
  requestAnimationFrame(fit);
}
$('#btn-preview').addEventListener('click', () => { setPreview(true); toast('Chế độ xem trước — nhấn Esc để chỉnh sửa tiếp', 'visibility'); });
$('#pv-exit').addEventListener('click', () => {
  const shared = document.body.classList.contains('shared');
  setPreview(false);
  if (shared) toast('Đây là bản sao của bạn — trang trí thoải mái nhé!', 'edit');
});
$('#pv-new').addEventListener('click', () => {
  S.design = defaultDesign(); S.selected = null;
  setPreview(false);
  renderAll(); commit();
});
$('#pv-export').addEventListener('click', () => exportPng());
$('#pv-share').addEventListener('click', () => share());

/* ---------------- save / export / share ---------------- */
let exporting = false;
async function exportPng() {
  if (exporting) return;
  exporting = true;
  toast('Đang tạo ảnh PNG…', 'hourglass_top');
  try {
    const blob = await designToPngBlob(D(), S.lib, 2);
    downloadBlob(blob, `${fileSafe(D().name)}.png`);
    toast('Đã tải ảnh PNG — Giáng Sinh vui vẻ!', 'download_done');
  } catch (err) {
    alertDialog('Xuất ảnh thất bại', err.message || String(err));
  } finally { exporting = false; }
}
async function share() {
  try {
    const url = await shareLink(D());
    if (navigator.share && isMobile()) {
      try { await navigator.share({ title: D().name, text: 'Xem cây thông Noel mình vừa trang trí nè!', url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const ok = await copyText(url);
    toast(ok ? 'Đã sao chép link — gửi cho bạn bè nhé!' : 'Không sao chép được link', ok ? 'link' : 'error');
  } catch (err) { alertDialog('Không tạo được link', err.message); }
}
$('#hdr-export').addEventListener('click', exportPng);
$('#hdr-share')?.addEventListener('click', share);


/* ---------------- tabs & mobile sheets ---------------- */
function setTab(tab) {
  $$('.tab').forEach((t) => { const on = t.dataset.tab === tab; t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); });
  $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tp-${tab}`));
  S.tab = tab;
  if (document.body.classList.contains('sheet-open')) updateDock();
}
$$('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
function openSheet(which) {
  const isLib = which === 'library';
  const target = isLib ? el.left : el.right;
  const alreadyOpen = target.classList.contains('open') && (isLib || S.tab === which);
  closeSheets();
  if (alreadyOpen) return;
  if (!isLib) setTab(which);
  target.classList.add('open');
  document.body.classList.add('sheet-open');
  S.sheet = which;
  updateDock();
}
function closeSheets() {
  el.left.classList.remove('open'); el.right.classList.remove('open');
  document.body.classList.remove('sheet-open');
  S.sheet = null;
  updateDock();
}
function updateDock() {
  $$('#mobile-dock [data-sheet]').forEach((b) => {
    const s = b.dataset.sheet;
    const on = (s === 'library' && el.left.classList.contains('open')) || (el.right.classList.contains('open') && s === S.tab);
    b.classList.toggle('active', on);
  });
}
$('#mobile-dock').addEventListener('click', (e) => { const b = e.target.closest('[data-sheet]'); if (b) openSheet(b.dataset.sheet); });
$$('[data-close-sheet]').forEach((b) => b.addEventListener('click', closeSheets));

/* ---------------- boot ---------------- */
async function boot() {
  S.lib = await loadLibrary();
  try { await Promise.race([document.fonts.load('800 26px Epilogue', 'Giáng Sinh ăâđêôơư'), new Promise((r) => setTimeout(r, 1200))]); } catch { /* ignore */ }
  const saved = loadCurrent();
  S.design = saved?.design ? normalizeDesign(saved.design, S.lib) : defaultDesign();
  S.autosavedAt = saved?.savedAt || null;
  S.snap = snapshot();

  buildTreePanel();
  buildScenePanel();
  renderCats();
  renderLibrary();
  renderAll();

  // incoming requests from other pages
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.slice(1));
  let shared = false;
  if (hash.get('share')) {
    try {
      const raw = await decodeDesign(hash.get('share'));
      S.design = normalizeDesign(raw, S.lib); shared = true;
    } catch { toast('Link chia sẻ bị lỗi', 'link_off'); }
  } else if (params.get('theme') && themeById(params.get('theme'))) {
    const t = themeById(params.get('theme'));
    S.design = designFromTheme(t, S.lib, { seed: Math.floor(Math.random() * 1e9) });
    toast(`Đã áp dụng “${t.name}” — hãy biến nó thành của riêng bạn!`, 'palette');
  } else if (params.get('blend')) {
    const [style, leaves, snow] = params.get('blend').split('~');
    const old = clone(S.design.tree);
    S.design.tree.style = TREE_STYLES.some((s) => s.id === style) ? style : S.design.tree.style;
    S.design.tree.leavesColor = safeColor(leaves, S.design.tree.leavesColor);
    S.design.tree.snow = clamp(Number(snow) || 0, 0, 100);
    S.design.tree.branchesLinked = true;
    const o = treeGeometry(old).apex, n = treeGeometry(S.design.tree).apex;
    S.design.decorations.forEach((d) => { if (assetOf(d)?.category === 'toppers' && Math.hypot(d.x - o[0], d.y - o[1]) < 95) { d.x += n[0] - o[0]; d.y += n[1] - o[1]; } });
    toast('Đã nạp bản phối màu của bạn', 'tune');
  } else if (params.get('new')) {
    S.design = defaultDesign();
    toast('Cây mới đã sẵn sàng để trang trí', 'park');
  }
  if (params.toString() || location.hash) {
    renderAll(); commit();
    history.replaceState(null, '', location.pathname);
  }
  if (params.get('panel') === 'greeting') {
    if (isMobile()) openSheet('scene'); else setTab('scene');
    setTimeout(() => $('#gr-text').focus(), 300);
  }
  new ResizeObserver(() => fit()).observe(el.wrap);
  fit();
  if (shared) setPreview(true, true);
  document.fonts?.ready.then(() => renderGreet());
  window.addEventListener('pagehide', () => { clearTimeout(commitTimer); commit(); });
}
boot().catch(showFatal);
