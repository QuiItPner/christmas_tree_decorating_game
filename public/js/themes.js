import { $, $$, mountChrome, loadLibrary, showFatal, escapeHtml } from './core.js?v=20261111a';
import { renderDesignSVG } from './render.js?v=20261111a';
import { THEMES, designFromTheme, themeById } from './themes-data.js?v=20261111a';

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
});

renderFilter();
renderGrid();
loadLibrary().then((l) => { lib = l; fillTreeCards(); }).catch(showFatal);
