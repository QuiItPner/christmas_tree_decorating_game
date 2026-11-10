import { $, $$, mountChrome, loadLibrary, showFatal, escapeHtml, safeColor, toast, defaultDesign } from './core.js';
import { renderDesignSVG, renderTree, renderBackground, TREE_STYLES, W, H } from './render.js';
import { THEMES, designFromTheme, themeById } from './themes-data.js';

mountChrome('themes');

const GROUPS = [
  { id: 'all', label: `All Styles (${THEMES.length})` },
  { id: 'traditional', label: 'Traditional' },
  { id: 'whimsical', label: 'Whimsical' },
  { id: 'rustic', label: 'Rustic' },
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
        <img src="${t.photo}" alt="${escapeHtml(t.name)} Christmas tree inspiration photo" loading="lazy" ${t.photoPosition ? `style="object-position:${t.photoPosition}"` : ''}>
        <div class="tree-preview" aria-hidden="true"></div>
        <span class="badge"><span class="ms">${t.badgeIcon}</span>${escapeHtml(t.badge)}</span>
        <button class="icon-btn sm preview-toggle" type="button" data-act="preview" title="Preview as a decorated tree" aria-label="Preview ${escapeHtml(t.name)} as a decorated tree" aria-pressed="false"><span class="ms">park</span></button>
        <span class="label"><span class="ms">forest</span>${escapeHtml(t.photoLabel)}</span>
      </div>
      <div class="theme-body">
        <h3><span>${escapeHtml(t.name)}</span><span class="ms">${t.icon}</span></h3>
        <p>${escapeHtml(t.description)}</p>
        <div class="tags">${t.tags.map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join('')}</div>
        <div class="palette">PALETTE: ${t.palette.map((c) => `<i style="background:${c}" title="${c}"></i>`).join('')}</div>
        <div class="theme-actions">
          <a class="btn btn-berry btn-sm" href="studio.html?theme=${t.id}"><span class="ms">palette</span>Apply Theme</a>
          <button class="btn btn-soft btn-sm" type="button" data-act="customize"><span class="ms">tune</span>Customize</button>
        </div>
      </div>
    </article>`).join('');
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
    toast(`“${t.name}” loaded into the mixer`, 'tune');
  }
});

/* ---------------- mixer ---------------- */
const NEEDLES = {
  classic: 'Douglas Fir', mini: 'Nordmann Mini', snowy: 'Snow Flocked', minimalist: 'Golden Cedar',
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
  $('#mx-colors').innerHTML = `<div class="swatches">${swatches.map((c) => `<button type="button" class="swatch lg" style="background:${c}" data-c="${c}" aria-label="Foliage ${c}"></button>`).join('')}<label class="swatch-custom" style="width:40px;height:40px" title="Custom colour"><input type="color" id="mx-custom" aria-label="Custom foliage colour"><span class="ms">colorize</span></label></div>`;
  $('#mx-colors').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    mixer.color = b.dataset.c;
    syncMixer();
  });
  $('#mx-custom').addEventListener('input', (e) => { mixer.color = safeColor(e.target.value); syncMixer(); });
  $('#mx-snow').addEventListener('input', (e) => { mixer.snow = Number(e.target.value); syncMixer(); });
  $('#mx-reset').addEventListener('click', () => { Object.assign(mixer, DEFAULT_MIX); syncMixer(); toast('Swatches reset to holiday default', 'refresh'); });
  colorSet = swatches;
}
function snowWord(v) { return v === 0 ? 'Snow Free' : v <= 40 ? 'Light Powder' : v <= 70 ? 'Gentle Flurry' : 'Blizzard'; }
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
loadLibrary().then((l) => { lib = l; }).catch(showFatal);
