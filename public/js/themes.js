import { $, $$, mountChrome, loadLibrary, showFatal, escapeHtml, safeColor, toast, defaultDesign } from './core.js?v=20261110';
import { renderDesignSVG, renderTree, renderBackground, TREE_STYLES, W, H } from './render.js?v=20261110';
import { THEMES, designFromTheme, themeById } from './themes-data.js?v=20261110';

mountChrome('themes');

const GROUPS = [
  { id: 'all', label: `Tất cả (${THEMES.length})` },
  { id: 'traditional', label: 'Truyền thống' },
  { id: 'whimsical', label: 'Vui nhộn' },
  { id: 'rustic', label: 'Mộc mạc' },
];
let group = 'all';
let lib = null;

function renderFilter() {
  $('#theme-filter').innerHTML = GROUPS.map((g) => `<button type="button" class="chip ${g.id === group ? 'active' : ''}" data-group="${g.id}" aria-pressed="${g.id === group}">${g.label}</button>`).join('');
}
function renderGrid() {
  const list = THEMES.filter((t) => group === 'all' || t.group === group);
  $('#theme-grid').innerHTML = list.map((t) => `
    <article class="card theme-card" data-theme="${t.id}">
      <div class="theme-photo">
        ${t.photo ? `<img src="${t.photo}" alt="Ảnh cảm hứng cây thông chủ đề ${escapeHtml(t.name)}" loading="lazy" ${t.photoPosition ? `style="object-position:${t.photoPosition}"` : ''}>` : ''}
        <div class="tree-preview" aria-hidden="true"></div>
        <span class="badge"><span class="ms">${t.badgeIcon}</span>${escapeHtml(t.badge)}</span>
        ${t.photo ? `<button class="icon-btn sm preview-toggle" type="button" data-act="preview" title="Xem dạng cây đã trang trí" aria-label="Xem ${escapeHtml(t.name)} dạng cây đã trang trí" aria-pressed="false"><span class="ms">park</span></button>` : ''}
        <span class="label"><span class="ms">forest</span>${escapeHtml(t.photoLabel)}</span>
      </div>
      <div class="theme-body">
        <h3><span>${escapeHtml(t.name)}</span><span class="ms">${t.icon}</span></h3>
        <p>${escapeHtml(t.description)}</p>
        <div class="tags">${t.tags.map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join('')}</div>
        <div class="palette">BẢNG MÀU: ${t.palette.map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div>
        <div class="theme-actions">
          <a class="btn btn-berry btn-sm" href="studio.html?theme=${t.id}"><span class="ms">palette</span>Áp dụng</a>
          <button class="btn btn-soft btn-sm" type="button" data-act="customize"><span class="ms">tune</span>Tuỳ chỉnh</button>
        </div>
      </div>
    </article>`).join('');
  fillTreeCards();
}
/** Themes without a photo show a rendered tree instead. */
function fillTreeCards() {
  if (!lib) return;
  $$('.theme-card').forEach((card) => {
    const t = themeById(card.dataset.theme);
    const box = card.querySelector('.tree-preview');
    if (t.photo || box.innerHTML) return;
    const d = designFromTheme(t, lib, { seed: `card-${t.id}` });
    d.greeting.visible = false;
    box.innerHTML = renderDesignSVG(d, lib, { uid: `card-${t.id}` }).replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ');
    box.classList.add('twinkle-on');
    card.classList.add('show-tree');
  });
}

$('#theme-filter').addEventListener('click', (e) => {
  const b = e.target.closest('[data-group]');
  if (!b) return;
  group = b.dataset.group;
  renderFilter(); renderGrid();
});
$('#theme-grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const card = b.closest('.theme-card');
  const t = themeById(card.dataset.theme);
  if (b.dataset.act === 'preview') {
    const box = card.querySelector('.tree-preview');
    if (!box.innerHTML && lib) {
      const d = designFromTheme(t, lib, { seed: `card-${t.id}` });
      d.greeting.visible = false;
      box.innerHTML = renderDesignSVG(d, lib, { uid: `card-${t.id}` }).replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ');
      box.classList.add('twinkle-on');
    }
    const on = card.classList.toggle('show-tree');
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('.ms').textContent = on ? 'photo' : 'park';
  }
  if (b.dataset.act === 'customize') {
    mixer.style = t.tree.style;
    mixer.color = t.tree.leavesColor;
    mixer.snow = t.tree.snow;
    mixer.preset = t;
    syncMixer();
    $('#mixer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(`Đã nạp “${t.name}” vào bộ trộn màu`, 'tune');
  }
});

/* ---------------- mixer ---------------- */
const NEEDLES = {
  classic: 'Linh sam Douglas', mini: 'Nordmann mini', snowy: 'Phủ tuyết', minimalist: 'Tuyết tùng vàng',
};
const DEFAULT_MIX = { style: 'classic', color: '#0E472A', snow: 45, preset: null };
const mixer = { ...DEFAULT_MIX };
let colorSet = null;

function buildMixer() {
  $('#mx-needles').innerHTML = TREE_STYLES.map((s) => `<button type="button" class="needle" data-style="${s.id}"><span class="ms">${s.icon}</span>${NEEDLES[s.id]}</button>`).join('');
  $('#mx-needles').addEventListener('click', (e) => {
    const b = e.target.closest('[data-style]');
    if (!b) return;
    mixer.style = b.dataset.style;
    if (mixer.style === 'snowy' && mixer.snow < 40) mixer.snow = 70;
    syncMixer();
  });
  const swatches = ['#0E472A', '#005131', '#176B45', '#88D7A8', '#4F7F7A', '#F2F5F3', '#F7C6D9', '#6B4F12'];
  $('#mx-colors').innerHTML = `<div class="swatches">${swatches.map((c) => `<button type="button" class="swatch lg" style="background:${c}" data-c="${c}" aria-label="Màu lá ${c}"></button>`).join('')}<label class="swatch-custom" style="width:40px;height:40px" title="Màu tuỳ chọn"><input type="color" id="mx-custom" aria-label="Màu lá tuỳ chọn"><span class="ms">colorize</span></label></div>`;
  $('#mx-colors').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    mixer.color = b.dataset.c;
    syncMixer();
  });
  $('#mx-custom').addEventListener('input', (e) => { mixer.color = safeColor(e.target.value); syncMixer(); });
  $('#mx-snow').addEventListener('input', (e) => { mixer.snow = Number(e.target.value); syncMixer(); });
  $('#mx-reset').addEventListener('click', () => { Object.assign(mixer, DEFAULT_MIX); syncMixer(); toast('Đã đặt lại màu mặc định', 'refresh'); });
  colorSet = swatches;
}
function snowWord(v) { return v === 0 ? 'Không tuyết' : v <= 40 ? 'Tuyết nhẹ' : v <= 70 ? 'Tuyết vừa' : 'Bão tuyết'; }
function syncMixer() {
  $$('#mx-needles .needle').forEach((b) => { const on = b.dataset.style === mixer.style; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  $$('#mx-colors .swatch').forEach((b) => b.classList.toggle('active', b.dataset.c.toUpperCase() === mixer.color.toUpperCase()));
  $('#mx-custom').value = mixer.color.toLowerCase();
  $('#mx-snow').value = mixer.snow;
  $('#mx-hex').textContent = mixer.color;
  $('#mx-snow-label').textContent = `${mixer.snow}% (${snowWord(mixer.snow)})`;
  $('#mx-style-label').textContent = NEEDLES[mixer.style];
  $('#mx-tag').textContent = NEEDLES[mixer.style];
  $('#mx-summary').textContent = mixer.preset ? `${mixer.preset.name} · ${mixer.color}` : `${NEEDLES[mixer.style]} + ${snowWord(mixer.snow)}`;
  const tree = { ...defaultDesign().tree, style: mixer.style, leavesColor: mixer.color, snow: mixer.snow, lights: true };
  $('#mx-stage').innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${renderBackground({ theme: 'minimal', color: '#FDEEE4' }, 'mxb')}${renderTree(tree, 'mxt')}</svg>`;
  $('#mx-launch').href = `studio.html?blend=${mixer.style}~${encodeURIComponent(mixer.color)}~${mixer.snow}`;
}

renderFilter();
renderGrid();
buildMixer();
syncMixer();
loadLibrary().then((l) => { lib = l; fillTreeCards(); }).catch(showFatal);
