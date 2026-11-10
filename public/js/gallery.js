import {
  $, mountChrome, loadLibrary, showFatal, escapeHtml, formatDate, uid, clone,
  listGallery, upsertGalleryItem, patchGalleryItem, deleteGalleryItem, normalizeDesign, GALLERY_LIMIT,
  toast, confirmDialog, promptDialog, alertDialog, shareLink, copyText, downloadBlob, fileSafe, prefs,
} from './core.js?v=20261110';
import { renderDesignSVG, designToPngBlob, bgLabel, TREE_STYLES } from './render.js?v=20261110';
import { THEMES, themeById, designFromTheme } from './themes-data.js?v=20261110';

mountChrome('gallery');

let lib = null;
const view = { filter: 'all', q: '', sort: prefs.get('gallerySort', 'newest'), layout: prefs.get('galleryLayout', 'grid') };

const hasGreeting = (d) => d.greeting?.visible && (d.greeting.text || d.greeting.name);
function feature(d) {
  if (hasGreeting(d)) return ['mail', 'Có lời chúc'];
  if (d.decorations.some((x) => x.locked)) return ['lock', 'Có lớp khoá'];
  if (!d.tree.branchesLinked) return ['tune', 'Cành tuỳ chỉnh'];
  if (d.effects?.twinkle) return ['auto_awesome', 'Đèn nhấp nháy'];
  return ['park', TREE_STYLES.find((s) => s.id === d.tree.style)?.label || 'Cây tuỳ chỉnh'];
}

function renderMeter(n) {
  $('#meter-text').innerHTML = `Lưu trên trình duyệt này · <b>${n}/${GALLERY_LIMIT}</b> cây`;
  $('#meter-bar').style.width = `${Math.min(100, (n / GALLERY_LIMIT) * 100)}%`;
}
function renderFilters(items) {
  const favs = items.filter((x) => x.favorite).length;
  const greets = items.filter((x) => hasGreeting(x.design)).length;
  const F = [
    ['all', 'park', `Tất cả (${items.length})`], ['recent', 'schedule', 'Gần đây'],
    ['greetings', 'mail', `Thiệp chúc (${greets})`], ['favorites', 'favorite', `Yêu thích (${favs})`],
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
  $('#btn-view').title = view.layout === 'list' ? 'Chuyển sang dạng lưới' : 'Chuyển sang dạng danh sách';
  $('#btn-sort').title = view.sort === 'name' ? 'Sắp xếp: A–Z' : 'Sắp xếp: mới nhất';
  $('#btn-sort .ms').textContent = view.sort === 'name' ? 'sort_by_alpha' : 'sort';

  if (!items.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="ms">forest</span><h3>Bộ sưu tập đang chờ cây đầu tiên</h3><p>Trang trí một cây rồi bấm <b>Lưu thiết kế</b> — cây sẽ xuất hiện ở đây, được lưu riêng trên trình duyệt này.</p><div class="row"><a class="btn btn-berry" href="studio.html?new=1"><span class="ms">brush</span>Bắt đầu trang trí</a><button class="btn btn-ghost" type="button" id="btn-samples"><span class="ms">auto_awesome</span>Thêm 3 cây mẫu</button></div></div>`;
    return;
  }
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="ms">search_off</span><h3>Không có cây nào phù hợp</h3><p>Hãy thử bộ lọc hoặc từ khoá khác.</p></div>`;
    return;
  }
  grid.innerHTML = list.map((x) => {
    const d = x.design;
    const theme = themeById(d.themeId);
    const [fi, ft] = feature(d);
    const svg = lib ? renderDesignSVG(d, lib, { uid: `g-${x.id}`, title: x.name }).replace(/viewBox="0 0 600 720"/, 'viewBox="0 60 600 600" preserveAspectRatio="xMidYMid slice"') : '';
    return `<article class="card tree-card" data-id="${x.id}">
      <div class="thumb" data-act="card" role="button" tabindex="0" aria-label="Xem ${escapeHtml(x.name)} dạng thiệp">${svg}
        <span class="theme-chip"><span class="ms">${theme ? theme.icon : 'palette'}</span>${escapeHtml(theme ? theme.name : 'Thiết kế riêng')}</span>
        <span class="corner">
          <button class="icon-btn fav ${x.favorite ? 'on' : ''}" type="button" data-act="fav" aria-pressed="${!!x.favorite}" aria-label="${x.favorite ? 'Bỏ khỏi' : 'Thêm vào'} yêu thích" title="Yêu thích"><span class="ms">favorite</span></button>
          <button class="icon-btn" type="button" data-act="menu" aria-haspopup="menu" aria-label="Thêm thao tác cho ${escapeHtml(x.name)}" title="Thêm"><span class="ms">more_vert</span></button>
        </span>
      </div>
      <div class="info">
        <div class="title-row"><h3 title="${escapeHtml(x.name)}">${escapeHtml(x.name)}</h3><span class="count">${d.decorations.length} món</span></div>
        <div class="meta">Sửa lần cuối ${escapeHtml(formatDate(x.updatedAt))} · ${escapeHtml(bgLabel(d.background.theme))}</div>
        <div class="foot">
          <span class="feat"><span class="ms">${fi}</span>${escapeHtml(ft)}</span>
          <span class="btns">
            <button class="btn btn-ghost btn-sm" type="button" data-act="card"><span class="ms">visibility</span>Thiệp</button>
            <a class="btn btn-pine btn-sm" href="studio.html?id=${encodeURIComponent(x.id)}"><span class="ms">edit</span>Sửa</a>
          </span>
        </div>
      </div>
    </article>`;
  }).join('');
}

/* ---------------- actions ---------------- */
const byId = (id) => listGallery().find((x) => x.id === id);
async function exportItem(item) {
  toast('Đang tạo ảnh PNG…', 'hourglass_top');
  try {
    const blob = await designToPngBlob(normalizeDesign(item.design, lib), lib, 2);
    downloadBlob(blob, `${fileSafe(item.name)}.png`);
    toast('Đã tải ảnh PNG — Giáng Sinh vui vẻ!', 'download_done');
  } catch (err) { alertDialog('Xuất ảnh thất bại', err.message); }
}
async function copyLink(item) {
  const url = await shareLink(normalizeDesign(item.design, lib));
  const ok = await copyText(url);
  toast(ok ? 'Đã sao chép link thiệp — gửi cho bạn bè nhé!' : 'Không sao chép được link', ok ? 'link' : 'error');
}
function openViewer(item) {
  const v = document.createElement('div');
  v.className = 'viewer';
  v.setAttribute('role', 'dialog');
  v.setAttribute('aria-modal', 'true');
  v.setAttribute('aria-label', `Thiệp ${item.name}`);
  v.innerHTML = `<div class="art twinkle-on">${renderDesignSVG(normalizeDesign(item.design, lib), lib, { uid: 'view', title: item.name })}</div>
    <div class="row">
      <button class="btn btn-ghost" type="button" data-v="close"><span class="ms">close</span>Đóng</button>
      <button class="btn btn-soft" type="button" data-v="link"><span class="ms">link</span>Sao chép link thiệp</button>
      <button class="btn btn-berry" type="button" data-v="png"><span class="ms">download</span>Xuất PNG</button>
      <a class="btn btn-pine" href="studio.html?id=${encodeURIComponent(item.id)}"><span class="ms">edit</span>Sửa</a>
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
    ['rename', 'drive_file_rename_outline', 'Đổi tên'], ['duplicate', 'content_copy', 'Nhân bản'],
    ['png', 'image', 'Xuất PNG'], ['link', 'link', 'Sao chép link chia sẻ'], ['json', 'file_download', 'Tải file thiết kế'],
    ['delete', 'delete', 'Xoá', 'danger'],
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
        const name = await promptDialog('Đổi tên cây', item.name, 'Đổi tên');
        if (name) { const d = clone(item.design); d.name = name.slice(0, 60); patchGalleryItem(item.id, { name: d.name, design: d }, true); render(); }
      }
      if (a === 'duplicate') {
        const d = clone(item.design); d.name = `${item.name} (bản sao)`.slice(0, 60);
        upsertGalleryItem({ id: uid('tree'), name: d.name, design: d, favorite: false }); render(); toast('Đã nhân bản cây', 'content_copy');
      }
      if (a === 'png') exportItem(item);
      if (a === 'link') copyLink(item);
      if (a === 'json') {
        const blob = new Blob([JSON.stringify({ type: 'my-little-christmas-tree', version: 1, design: item.design }, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `${fileSafe(item.name)}.json`);
      }
      if (a === 'delete') {
        if (await confirmDialog(`Xoá “${item.name}”?`, 'Cây sẽ bị xoá khỏi bộ sưu tập trên trình duyệt này và không thể khôi phục.', 'Xoá cây')) {
          deleteGalleryItem(item.id); render(); toast('Đã xoá cây', 'delete');
        }
      }
    } catch (err) { alertDialog('Đã xảy ra lỗi', err.message); }
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
$('#btn-sort').addEventListener('click', () => { view.sort = view.sort === 'name' ? 'newest' : 'name'; prefs.set('gallerySort', view.sort); render(); toast(view.sort === 'name' ? 'Đã sắp xếp A–Z' : 'Mới nhất trước', 'sort'); });

$('#btn-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 1_000_000) throw new Error('File quá lớn, không phải file thiết kế cây.');
    const json = JSON.parse(await file.text());
    const d = normalizeDesign(json.design || json, lib);
    const it = upsertGalleryItem({ id: uid('tree'), name: d.name, design: d });
    render();
    toast(`Đã nhập “${it.name}”`, 'upload');
  } catch (err) {
    alertDialog('Không nhập được', err instanceof SyntaxError ? 'File này không phải file thiết kế hợp lệ (.json).' : err.message);
  }
});

function addSamples() {
  const names = ['Cây thông mùa vàng Phú Nông', 'Đêm Giáng Sinh lấp lánh', 'Xứ sở kẹo ngọt'];
  [THEMES[0], THEMES[6], THEMES[3]].forEach((t, i) => {
    const d = designFromTheme(t, lib, { seed: `sample-${t.id}` });
    d.name = names[i];
    upsertGalleryItem({ id: uid('tree'), name: d.name, design: d, favorite: i === 0 });
  });
  render();
  toast('Đã thêm 3 cây mẫu', 'auto_awesome');
}

(async () => {
  lib = await loadLibrary();
  try { await Promise.race([document.fonts.load('800 26px Epilogue', 'Giáng Sinh ăâđêôơư'), new Promise((r) => setTimeout(r, 1000))]); } catch { /* ignore */ }
  render();
})().catch(showFatal);
