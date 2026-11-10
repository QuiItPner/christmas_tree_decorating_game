import { $, mountChrome, loadLibrary, showFatal, escapeHtml } from './core.js?v=20261110';
import { renderDesignSVG } from './render.js?v=20261110';
import { THEMES, designFromTheme } from './themes-data.js?v=20261110';

mountChrome('about');

(async () => {
  const lib = await loadLibrary();
  try { await Promise.race([document.fonts.load('800 26px Epilogue', 'Giáng Sinh ăâđêôơư'), new Promise((r) => setTimeout(r, 1000))]); } catch { /* ignore */ }
  $('#stat-items').textContent = `${lib.decorations.filter((a) => a.category !== 'products').length}`;
  $('#stat-products').textContent = `${lib.decorations.filter((a) => a.category === 'products').length}`;
  const hero = designFromTheme(THEMES[0], lib, { seed: 'hero-tree' });
  $('#hero-tree').innerHTML = renderDesignSVG(hero, lib, { uid: 'hero' });
  const picks = [THEMES[2], THEMES[3], THEMES[6]];
  $('#mini-trees').innerHTML = picks.map((t, i) => {
    const d = designFromTheme(t, lib, { seed: `mini-${t.id}` });
    d.greeting.visible = false;
    return `<a href="studio.html?theme=${t.id}" title="Bắt đầu với ${escapeHtml(t.name)}" aria-label="Bắt đầu với chủ đề ${escapeHtml(t.name)}">${renderDesignSVG(d, lib, { uid: `mini${i}` })}</a>`;
  }).join('');
})().catch(showFatal);
