import { $, mountChrome, loadLibrary, showFatal, escapeHtml } from './core.js';
import { renderDesignSVG } from './render.js';
import { THEMES, designFromTheme } from './themes-data.js';

mountChrome('about');

(async () => {
  const lib = await loadLibrary();
  try { await Promise.race([document.fonts.load('800 26px Epilogue'), new Promise((r) => setTimeout(r, 1000))]); } catch { /* ignore */ }
  $('#stat-items').textContent = `${lib.decorations.length}`;
  const hero = designFromTheme(THEMES[0], lib, { seed: 'hero-tree' });
  $('#hero-tree').innerHTML = renderDesignSVG(hero, lib, { uid: 'hero' });
  const picks = [THEMES[1], THEMES[2], THEMES[5]];
  $('#mini-trees').innerHTML = picks.map((t, i) => {
    const d = designFromTheme(t, lib, { seed: `mini-${t.id}` });
    d.greeting.visible = false;
    return `<a href="studio.html?theme=${t.id}" title="Start with ${escapeHtml(t.name)}" aria-label="Start with the ${escapeHtml(t.name)} theme">${renderDesignSVG(d, lib, { uid: `mini${i}` })}</a>`;
  }).join('');
})().catch(showFatal);
