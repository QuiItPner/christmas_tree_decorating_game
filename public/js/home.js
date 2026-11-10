import { $, $$, mountChrome, loadLibrary, showFatal, escapeHtml } from './core.js?v=20261111h';
import { renderDesignSVG } from './render.js?v=20261111h';
import { THEMES, designFromTheme } from './themes-data.js?v=20261111h';

export default function mount(signal) {
  // window/document listeners are removed automatically when the visitor leaves this page
  const optsWith = (o) => (typeof o === 'boolean' ? { capture: o, signal } : { ...(o || {}), signal });
  const onWin = (type, fn, o) => window.addEventListener(type, fn, optsWith(o));
  const onDoc = (type, fn, o) => document.addEventListener(type, fn, optsWith(o));
  mountChrome('about');

  /* ---------------- helpers ---------------- */
  const isFert = (a) => /phân bón/i.test(a.keywords || '');
  // only bottles hang on the garland — square sachets/bags (ratio ~1.15) look out of place
  const isBottle = (a) => a.width / a.height < 0.9;

  /** Runs fn once the element is close to the viewport (or immediately without IO support). */
  function whenNear(el, fn, margin = '300px 0px') {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver((entries) => {
      if (signal.aborted) { io.disconnect(); return; }
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
    }, { rootMargin: margin });
    io.observe(el);
    signal.addEventListener('abort', () => io.disconnect());
  }

  function fillTree(el, design, lib, uid, title) {
    el.innerHTML = renderDesignSVG(design, lib, { uid, title });
    el.classList.remove('is-loading');
    el.removeAttribute('aria-busy');
  }

  /* ---------------- themes teaser (skeleton first, trees once the library is ready) ---------------- */
  const TEASER = [THEMES[1], THEMES[2], THEMES[6]].filter(Boolean);
  $$('[data-theme-count]').forEach((n) => { n.textContent = THEMES.length; });
  $('#theme-teaser').innerHTML = TEASER.map((t) => `
    <li>
      <a class="home-theme" href="studio.html?theme=${encodeURIComponent(t.id)}" aria-label="Bắt đầu với chủ đề ${escapeHtml(t.name)}">
        <span class="home-theme-frame"><span class="home-theme-img is-loading" data-theme-tree="${escapeHtml(t.id)}"></span></span>
        <span class="home-theme-name">${escapeHtml(t.name)}</span>
        <span class="home-theme-tags">${t.tags.slice(0, 2).map(escapeHtml).join(' · ')}</span>
        <span class="home-theme-go">Dùng chủ đề này<span class="ms">arrow_forward</span></span>
      </a>
    </li>`).join('');

  /* ---------------- product garland ---------------- */
  // Strand geometry, in % of the track (must match the <path> in index.html: M0 7 Q500 67 1000 7)
  const Y0 = 7;
  const SAG = 30;
  const strandY = (t) => Y0 + SAG * 4 * t * (1 - t);
  const DROPS = [12, 40, 22, 50, 16, 34, 26, 46];
  // Phú Nông theme products first, so the garland matches the hero tree
  const FEATURED = THEMES[0].pool.filter((id) => id.startsWith('pn-'));

  let garlandCount = 0;
  let products = [];

  function pickProducts() {
    const ordered = [...products].sort((a, b) => {
      const ia = FEATURED.indexOf(a.id), ib = FEATURED.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    // two pesticides, one fertiliser, repeat — both families stay visible
    const b = ordered.filter((a) => !isFert(a)), f = ordered.filter(isFert), out = [];
    while (b.length || f.length) {
      if (b.length) out.push(b.shift());
      if (b.length) out.push(b.shift());
      if (f.length) out.push(f.shift());
    }
    return out;
  }

  const slotsFor = (w) => (w < 760 ? 12 : w < 900 ? 7 : w < 1200 ? 10 : 12);
  const isScrollMode = () => window.innerWidth < 760;

  /**
   * Places bottles and beads on the strand. The strand spans the whole track (edge to edge, like the
   * swag above it); on wide screens the bottles keep to a centred band inset from the page gutter,
   * and each one reads its height off the strand at its real x position.
   */
  function layoutGarland() {
    const track = $('#garland-track');
    const W = track.clientWidth;
    if (!W) return;
    const orns = $$('.home-orn', track), beads = $$('.home-bead', track);
    const n = orns.length;
    const inner = isScrollMode() ? W : Math.min(W - 80, 1440);
    const off = (W - inner) / 2;
    const place = (el, slot) => {
      const t = (off + inner * slot) / W;
      el.style.setProperty('--x', (t * 100).toFixed(3));
      el.style.setProperty('--y', strandY(t).toFixed(3));
    };
    orns.forEach((el, i) => place(el, (i + 0.5) / n));
    beads.forEach((el, i) => place(el, (i + 1) / n));
  }

  function renderGarland() {
    const list = $('#garland');
    const n = slotsFor(window.innerWidth);
    const all = pickProducts();
    const items = all.slice(0, n);
    garlandCount = n;
    $('#garland-track').style.setProperty('--n', items.length);
    list.innerHTML = items.map((a, i) => {
      const dur = (3.6 + ((i * 7) % 5) * 0.35).toFixed(2);
      const delay = (-((i * 13) % 9) * 0.4).toFixed(2);
      return `<li class="home-orn" style="--drop:${DROPS[i % DROPS.length]}px;--dur:${dur}s;--delay:${delay}s;--i:${i}">
        <a class="home-orn-link" href="studio.html" aria-label="${escapeHtml(a.name)}">
          <span class="home-orn-swing">
            <span class="home-orn-hook" aria-hidden="true"></span>
            <span class="home-orn-body"><img src="${escapeHtml(a.image)}" alt="" loading="lazy" decoding="async"></span>
            <span class="home-orn-name" aria-hidden="true">${escapeHtml(a.name)}</span>
          </span>
        </a>
      </li>`;
    }).join('')
      // tiny gold beads on the strand between the bottles
      + items.slice(1).map(() => '<li class="home-bead" aria-hidden="true"></li>').join('');
    layoutGarland();
    list.classList.remove('is-in');
    void list.offsetWidth; // restart the drop-in animation
    list.classList.add('is-in');
    $('#garland-status').hidden = true;
    $('#garland-scroller').scrollLeft = 0;
  }

  function setupGarland() {
    products = lib.decorations.filter((a) => a.category === 'products' && isBottle(a));
    renderGarland();
    let timer = 0;
    onWin('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (signal.aborted) return; if (slotsFor(window.innerWidth) !== garlandCount) renderGarland(); else layoutGarland(); }, 120);
    });
  }

  /* ---------------- boot ---------------- */
  let lib = null;

  (async () => {
    lib = await loadLibrary();
    try { await Promise.race([document.fonts.load('800 26px Epilogue', 'Giáng Sinh ăâđêôơư'), new Promise((r) => setTimeout(r, 1000))]); } catch { /* ignore */ }
    if (signal.aborted) return;

    // hero: the Phú Nông theme, no banner so the tree and bottles carry the frame
    const hero = designFromTheme(THEMES[0], lib, { seed: 'hero-tree' });
    hero.greeting.visible = false;
    fillTree($('#hero-tree'), hero, lib, 'hero', 'Cây thông chủ đề Mùa Vàng Phú Nông');

    // garland: images are lazy; wire it up when the band approaches
    whenNear($('#garland-track'), setupGarland, '400px 0px');

    // themes teaser
    whenNear($('#theme-teaser'), () => {
      $$('[data-theme-tree]').forEach((el, i) => {
        const t = TEASER.find((x) => x.id === el.dataset.themeTree);
        const d = designFromTheme(t, lib, { seed: `mini-${t.id}` });
        d.greeting.visible = false;
        fillTree(el, d, lib, `mini${i}`, `Cây thông chủ đề ${t.name}`);
        el.classList.add('twinkle-on');
      });
    });

    // greeting postcard: same theme, with the banner and a signature
    whenNear($('#greet-tree'), () => {
      const d = designFromTheme(THEMES[0], lib, { seed: 'postcard' });
      d.greeting = { ...d.greeting, visible: true, text: 'Giáng Sinh an lành — Mùa vàng bội thu!', name: 'Đại lý Phú Nông' };
      fillTree($('#greet-tree'), d, lib, 'card', 'Ví dụ thiệp cây thông có lời chúc');
    });
  })().catch((err) => {
    if (signal.aborted) return;
    $$('.is-loading').forEach((el) => { el.classList.remove('is-loading'); el.classList.add('is-error'); el.removeAttribute('aria-busy'); el.innerHTML = '<span class="home-skel-label">Không tải được hình minh hoạ</span>'; });
    const status = $('#garland-status');
    if (status) status.textContent = 'Không tải được danh sách sản phẩm. Hãy tải lại trang.';
    showFatal(err);
  });
}
