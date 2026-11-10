/* =========================================================
   SVG renderer — tree, backgrounds, decorations, greeting,
   full-design markup, PNG export and the random decorator.
   Stage coordinate system: 600 × 720 units.
   ========================================================= */
import { escapeHtml, round, uid, clamp } from './core.js?v=20261111a';

export const W = 600;
export const H = 720;
const CX = 300;
const ANCHOR_Y = 640; // tree scales around the skirt centre

export const TREE_STYLES = [
  { id: 'classic', label: 'Cổ điển', icon: 'park' },
  { id: 'mini', label: 'Mini', icon: 'nature' },
  { id: 'snowy', label: 'Phủ tuyết', icon: 'ac_unit' },
];
export const BACKGROUNDS = [
  { id: 'rice-field', label: 'Cánh đồng lúa mùa vàng', short: 'Đồng lúa', icon: 'grass' },
  { id: 'cozy-room', label: 'Phòng khách ấm cúng', short: 'Phòng khách', icon: 'chair' },
  { id: 'fireplace', label: 'Phòng lò sưởi', short: 'Lò sưởi', icon: 'fireplace' },
  { id: 'snowy-forest', label: 'Rừng tuyết', short: 'Rừng tuyết', icon: 'forest' },
  { id: 'night-sky', label: 'Bầu trời đêm Giáng sinh', short: 'Đêm sao', icon: 'bedtime' },
  { id: 'minimal', label: 'Màu tối giản', short: 'Tối giản', icon: 'gradient' },
];
export const bgLabel = (id) => BACKGROUNDS.find((b) => b.id === id)?.label || 'Tuỳ chỉnh';

/* ---------------- colour helpers ---------------- */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const toHex = (rgb) => '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}
export const shade = (hex, amt) => (amt >= 0 ? mix(hex, '#FFFFFF', amt) : mix(hex, '#000000', -amt));
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* ---------------- seeded RNG ---------------- */
export function rng(seed = Date.now()) {
  let a = typeof seed === 'string' ? [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761), 1779033703) : seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* =========================================================
   TREE GEOMETRY
   ========================================================= */
const GEOM = {
  classic: { edge: 'round', depth: 14, tiers: [[118, 250, 10, 95, 3], [200, 360, 46, 140, 4], [300, 470, 66, 180, 5], [410, 572, 86, 215, 6]] },
  mini: { edge: 'round', depth: 17, tiers: [[262, 372, 10, 96, 3], [330, 468, 44, 138, 4], [418, 572, 64, 176, 5]] },
  snowy: { edge: 'spiky', depth: 16, tiers: [[112, 245, 8, 92, 4], [195, 355, 40, 138, 5], [295, 468, 60, 178, 6], [405, 572, 80, 214, 7]] },
};

export function treeGeometry(tree) {
  const g = GEOM[tree.style] || GEOM.classic;
  const s = tree.size || 1;
  const tiers = g.tiers.map(([top, bot, tw, bw, n]) => ({ top, bot, tw, bw, n }));
  const halfWidthAt = (y) => {
    // widest tier that contains y (local coords)
    let best = -1;
    for (const t of tiers) {
      if (y < t.top || y > t.bot) continue;
      const k = (y - t.top) / (t.bot - t.top);
      const w = t.tw + (t.bw - t.tw) * (g.edge === 'flat' ? k : Math.pow(k, 1.1));
      best = Math.max(best, w);
    }
    return best;
  };
  const toStage = (x, y) => [CX + (x - CX) * s, ANCHOR_Y + (y - ANCHOR_Y) * s];
  const toLocal = (x, y) => [CX + (x - CX) / s, ANCHOR_Y + (y - ANCHOR_Y) / s];
  const apex = toStage(CX, tiers[0].top - (g.edge === 'flat' ? 0 : 8));
  const insideTree = (x, y, margin = 18) => {
    const [lx, ly] = toLocal(x, y);
    const hw = halfWidthAt(ly);
    return hw > 0 && Math.abs(lx - CX) < hw - margin && ly > tiers[0].top + 30 && ly < tiers[tiers.length - 1].bot - 12;
  };
  return { ...g, tiers, size: s, halfWidthAt, toStage, toLocal, apex, insideTree };
}

function edgePoints(t, n) {
  const seg = (2 * t.bw) / n;
  const xs = [];
  for (let k = 0; k <= n; k++) xs.push(CX + t.bw - k * seg);
  return { xs, seg };
}
function bottomEdge(t, edge, depth) {
  const { xs } = edgePoints(t, t.n);
  const endY = edge === 'flat' ? t.bot : t.bot - 10;
  const jointY = edge === 'flat' ? t.bot : t.bot - 2;
  const ys = xs.map((_, k) => (k === 0 || k === t.n ? endY : jointY));
  let d = `M${round(xs[0])} ${ys[0]}`;
  for (let k = 1; k <= t.n; k++) {
    const mx = (xs[k - 1] + xs[k]) / 2;
    if (edge === 'round') d += ` Q${round(mx)} ${t.bot + depth} ${round(xs[k])} ${ys[k]}`;
    else if (edge === 'spiky') d += ` L${round(mx)} ${t.bot + depth} L${round(xs[k])} ${ys[k]}`;
    else d += ` L${round(xs[k])} ${ys[k]}`;
  }
  return { d, xs, ys };
}
function tierPath(t, edge, depth) {
  const h = t.bot - t.top;
  const be = bottomEdge(t, edge, depth);
  if (edge === 'flat') {
    return `M${CX} ${t.top} L${CX + t.bw} ${t.bot} L${CX - t.bw} ${t.bot} Z`;
  }
  const peak = t.tw <= 12 ? 22 : 10;
  let d = `M${CX - t.tw} ${t.top} Q${CX} ${t.top - peak} ${CX + t.tw} ${t.top}`;
  d += ` Q${round(CX + t.tw + (t.bw - t.tw) * 0.3)} ${round(t.top + h * 0.62)} ${round(be.xs[0])} ${be.ys[0]}`;
  d += be.d.replace(/^M[^QL]+/, ' ');
  d += ` Q${round(CX - t.tw - (t.bw - t.tw) * 0.3)} ${round(t.top + h * 0.62)} ${CX - t.tw} ${t.top} Z`;
  return d;
}

const LIGHT_COLS = ['#FFBA27', '#E63946', '#88D7A8', '#FFD180', '#5DA9E9', '#FFB4AB'];

export function renderTree(tree, u = 't') {
  const geo = treeGeometry(tree);
  const { tiers, edge, depth } = geo;
  const leaves = tree.leavesColor;
  const branches = tree.branchesLinked ? shade(leaves, -0.32) : tree.branchesColor;
  const snow = clamp(tree.snow || 0, 0, 100);
  const snowColor = tree.snowColor || '#FFFFFF';
  const n = tiers.length;
  const id = (k) => `${u}-${k}`;
  let defs = `<linearGradient id="${id('vol')}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>`;
  defs += `<radialGradient id="${id('gshadow')}"><stop offset="0" stop-color="#2B2118" stop-opacity=".32"/><stop offset="1" stop-color="#2B2118" stop-opacity="0"/></radialGradient>`;
  const paths = tiers.map((t) => tierPath(t, edge, depth));
  paths.forEach((p, i) => { defs += `<clipPath id="${id('c' + i)}"><path d="${p}"/></clipPath>`; });

  let body = '';
  // ground shadow + skirt
  body += `<ellipse cx="${CX}" cy="${ANCHOR_Y - 8}" rx="190" ry="30" fill="url(#${id('gshadow')})"/>`;
  if (tree.skirt) {
    const sk = tree.skirtColor;
    body += `<g class="tree-skirt"><ellipse cx="${CX}" cy="${ANCHOR_Y - 18}" rx="136" ry="28" fill="${sk}"/><ellipse cx="${CX}" cy="${ANCHOR_Y - 20}" rx="136" ry="26" fill="#fff" opacity=".08"/><ellipse cx="${CX}" cy="${ANCHOR_Y - 18}" rx="118" ry="21" fill="none" stroke="#FFBA27" stroke-width="2.5" stroke-dasharray="7 5"/><ellipse cx="${CX}" cy="${ANCHOR_Y - 20}" rx="46" ry="10" fill="${shade(sk, -0.3)}"/></g>`;
  }
  // trunk
  const tTop = tiers[n - 1].bot - 46;
  const tb = ANCHOR_Y - 22;
  body += `<g class="tree-trunk"><path d="M${CX - 19} ${tTop} H${CX + 19} L${CX + 25} ${tb} Q${CX} ${tb + 6} ${CX - 25} ${tb} Z" fill="${tree.trunkColor}"/><path d="M${CX + 3} ${tTop} H${CX + 19} L${CX + 25} ${tb} Q${CX + 14} ${tb + 4} ${CX + 5} ${tb + 3} Z" fill="#000" opacity=".18"/><path d="M${CX - 8} ${tTop + 14} L${CX - 10} ${tb - 6}" stroke="#000" stroke-opacity=".2" stroke-width="2.4" stroke-linecap="round"/></g>`;

  const snowW = snow > 0 ? 3 + snow * 0.12 : 0;
  for (let i = n - 1; i >= 0; i--) {
    const t = tiers[i];
    const k = n === 1 ? 0 : i / (n - 1);
    const fill = shade(leaves, 0.12 - k * 0.24);
    const be = bottomEdge(t, edge, depth);
    let g = `<path d="${paths[i]}" fill="${fill}"/>`;
    g += `<path d="${paths[i]}" fill="url(#${id('vol')})"/>`;
    // branch rim along the bottom edge
    g += `<g clip-path="url(#${id('c' + i)})"><path d="${be.d}" fill="none" stroke="${branches}" stroke-width="${edge === 'flat' ? 22 : 26}" stroke-linejoin="round"/>`;
    // little needle strokes
    for (let s = 1; s < be.xs.length - 1; s++) {
      const x = be.xs[s];
      g += `<path d="M${round(x)} ${t.bot - 14} q4 -10 12 -14" stroke="${branches}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>`;
    }
    // shadow cast by the tier above
    if (i > 0) g += `<path d="${paths[i - 1]}" transform="translate(0 9)" fill="#000" opacity=".2"/>`;
    // snow on branch tips
    if (snowW) {
      g += `<path d="${be.d}" transform="translate(0 ${round(-snowW * 0.35)})" fill="none" stroke="${snowColor}" stroke-width="${round(snowW * 2)}" stroke-linejoin="round" stroke-linecap="round" opacity="${round(0.55 + snow / 220)}"/>`;
    }
    g += `</g>`;
    if (snowW) {
      for (let s = 1; s <= t.n; s++) {
        const mx = (be.xs[s - 1] + be.xs[s]) / 2;
        const dy = edge === 'round' ? depth * 0.55 : edge === 'spiky' ? depth * 0.4 : 0;
        g += `<ellipse cx="${round(mx)}" cy="${round(t.bot + dy - snowW * 0.45)}" rx="${round(Math.min(14, 4 + snow * 0.08))}" ry="${round(snowW * 0.6)}" fill="${snowColor}" opacity="${round(0.6 + snow / 250)}"/>`;
      }
    }
    // peak snow cap
    if (i === 0 && snow > 0) {
      const capY = t.top + 14 + snow * 0.32;
      g += `<path clip-path="url(#${id('c0')})" d="M${CX - 80} ${t.top - 40} H${CX + 80} V${round(capY)} Q${CX + 40} ${round(capY + 10)} ${CX + 20} ${round(capY - 4)} Q${CX} ${round(capY + 12)} ${CX - 20} ${round(capY - 2)} Q${CX - 40} ${round(capY + 10)} ${CX - 80} ${round(capY)} Z" fill="${snowColor}"/>`;
    }
    // garland lights for this tier
    if (tree.lights) {
      const yA = i > 0 ? tiers[i - 1].bot + depth + 4 : t.top + 44;
      const yB = t.bot - 20;
      if (yB - yA > 20) {
        const y0 = yA + (yB - yA) * 0.15;
        const sag = yA + (yB - yA) * 0.85;
        const hw = (geo.halfWidthAt(y0) || t.bw * 0.5) - 10;
        const cy = 2 * sag - y0;
        const p0 = [CX - hw, y0], p1 = [CX, cy], p2 = [CX + hw, y0];
        g += `<path d="M${round(p0[0])} ${round(y0)} Q${CX} ${round(cy)} ${round(p2[0])} ${round(y0)}" fill="none" stroke="#FFEAA7" stroke-opacity=".75" stroke-width="1.4" stroke-dasharray="3 3"/>`;
        const count = Math.max(3, Math.round((hw * 2) / 34));
        for (let b = 0; b < count; b++) {
          const tt = (b + 0.5) / count;
          const x = (1 - tt) ** 2 * p0[0] + 2 * (1 - tt) * tt * p1[0] + tt * tt * p2[0];
          const y = (1 - tt) ** 2 * p0[1] + 2 * (1 - tt) * tt * p1[1] + tt * tt * p2[1];
          const c = LIGHT_COLS[(b + i) % LIGHT_COLS.length];
          g += `<circle cx="${round(x)}" cy="${round(y + 2)}" r="7" fill="${c}" opacity=".35" class="twinkle" style="animation-delay:${((b * 0.41 + i * 0.23) % 1.8).toFixed(2)}s"/><circle cx="${round(x)}" cy="${round(y + 2)}" r="3.3" fill="${c}"/>`;
        }
      }
    }
    body += `<g class="tree-tier">${g}</g>`;
  }
  const s = geo.size;
  const tf = s === 1 ? '' : ` transform="translate(${CX} ${ANCHOR_Y}) scale(${s}) translate(${-CX} ${-ANCHOR_Y})"`;
  return `<defs>${defs}</defs><g class="tree"${tf}>${body}</g>`;
}

/* =========================================================
   BACKGROUNDS
   ========================================================= */
function snowDots(r, count, yMin, yMax, opacity = 0.8) {
  let s = '';
  for (let i = 0; i < count; i++) s += `<circle cx="${round(r() * W)}" cy="${round(yMin + r() * (yMax - yMin))}" r="${round(0.8 + r() * 2.2)}" fill="#fff" opacity="${round(opacity * (0.5 + r() * 0.5))}"/>`;
  return s;
}
function pine(x, y, h, fill) {
  const w = h * 0.42;
  return `<path d="M${x} ${y - h}L${x + w * 0.55} ${y - h * 0.55}H${x + w * 0.3}L${x + w} ${y}H${x - w}L${x - w * 0.3} ${y - h * 0.55}H${x - w * 0.55}Z" fill="${fill}"/>`;
}

export function renderBackground(bg, u = 'b') {
  const id = (k) => `${u}-${k}`;
  const theme = bg.theme;
  if (theme === 'cozy-room') {
    const r = rng(11);
    let s = `<defs><linearGradient id="${id('wall')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FCEEDF"/><stop offset="1" stop-color="#F1D3B5"/></linearGradient><linearGradient id="${id('floor')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C98D59"/><stop offset="1" stop-color="#A2693B"/></linearGradient><linearGradient id="${id('night')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B3358"/><stop offset="1" stop-color="#3F6390"/></linearGradient><radialGradient id="${id('warm')}" cx="50%" cy="48%" r="60%"><stop offset="0" stop-color="#FFD699" stop-opacity=".5"/><stop offset="1" stop-color="#FFD699" stop-opacity="0"/></radialGradient></defs>`;
    s += `<rect width="${W}" height="${H}" fill="url(#${id('wall')})"/>`;
    for (let x = 10; x < W; x += 44) s += `<rect x="${x}" y="0" width="18" height="470" fill="#fff" opacity=".13"/>`;
    s += `<rect y="470" width="${W}" height="132" fill="#EBC6A0"/><rect y="464" width="${W}" height="9" fill="#D3A57A"/>`;
    for (let x = 22; x < W; x += 112) s += `<rect x="${x}" y="490" width="88" height="90" rx="4" fill="none" stroke="#D3A57A" stroke-width="2.5"/>`;
    s += `<rect y="600" width="${W}" height="120" fill="url(#${id('floor')})"/>`;
    [628, 660, 694].forEach((y, i) => { s += `<path d="M0 ${y}H${W}" stroke="#8E5A30" stroke-opacity=".45" stroke-width="2"/>`; for (let x = (i * 70) % 140; x < W; x += 140) s += `<path d="M${x} ${y}v${i === 0 ? -28 : -32}" stroke="#8E5A30" stroke-opacity=".35" stroke-width="2"/>`; });
    // window
    s += `<rect x="34" y="92" width="154" height="214" rx="8" fill="#8B5A2B"/><rect x="44" y="102" width="134" height="194" rx="4" fill="url(#${id('night')})"/>`;
    for (let i = 0; i < 22; i++) s += `<circle cx="${round(48 + r() * 126)}" cy="${round(106 + r() * 180)}" r="${round(0.8 + r() * 1.8)}" fill="#fff" opacity="${round(0.5 + r() * 0.5)}"/>`;
    s += `${pine(80, 290, 60, '#2F4F6E')}${pine(140, 296, 80, '#294766')}<path d="M44 276q30-14 60-4t74 -2v26H44z" fill="#EEF4FA"/>`;
    s += `<path d="M111 102v194M44 199h134" stroke="#8B5A2B" stroke-width="7"/><rect x="26" y="300" width="170" height="12" rx="4" fill="#A36D3C"/><path d="M30 300q20-8 40 0t40 0t40 0t42 0" fill="#fff" opacity=".9"/>`;
    // wreath
    s += `<g transform="translate(500 176)"><circle r="44" fill="none" stroke="#1E6B45" stroke-width="18"/><circle r="44" fill="none" stroke="#2E8B57" stroke-width="7" stroke-dasharray="4 7"/>${[0, 50, 110, 170, 230, 290].map((a) => `<circle cx="${round(44 * Math.cos((a * Math.PI) / 180))}" cy="${round(44 * Math.sin((a * Math.PI) / 180))}" r="4.5" fill="#D62828"/>`).join('')}<path d="M0 40c-8-14-24-12-20-2s20 4 20 2zm0 0c8-14 24-12 20-2s-20 4-20 2z" fill="#C9182B"/><path d="M-2 42l-8 22 7-4 3 6 2-22zM2 42l8 22-7-4-3 6-2-22z" fill="#A10F1F"/><circle cy="41" r="4.5" fill="#C9182B"/></g>`;
    // top garland
    s += `<path d="M-10 26Q150 92 300 26T610 26" fill="none" stroke="#1E6B45" stroke-width="16" stroke-linecap="round"/><path d="M-10 26Q150 92 300 26T610 26" fill="none" stroke="#2E8B57" stroke-width="6" stroke-dasharray="3 8" stroke-linecap="round"/>`;
    [[40, 40], [95, 55], [150, 59], [205, 52], [255, 38], [345, 38], [395, 52], [450, 59], [505, 55], [560, 40]].forEach(([x, y], i) => { s += `<circle cx="${x}" cy="${y + 6}" r="8" fill="${LIGHT_COLS[i % 4]}" opacity=".35" class="twinkle" style="animation-delay:${(i * 0.3) % 1.5}s"/><circle cx="${x}" cy="${y + 6}" r="4" fill="${LIGHT_COLS[i % 4]}"/>`; });
    s += `<ellipse cx="300" cy="652" rx="250" ry="44" fill="#B23A3A" opacity=".25"/><rect width="${W}" height="${H}" fill="url(#${id('warm')})"/>`;
    return s;
  }
  if (theme === 'fireplace') {
    let s = `<defs><linearGradient id="${id('wall')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8E3F31"/><stop offset="1" stop-color="#6A2B21"/></linearGradient><linearGradient id="${id('floor')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6E4428"/><stop offset="1" stop-color="#4E2E19"/></linearGradient><radialGradient id="${id('fire')}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFB347" stop-opacity=".85"/><stop offset="1" stop-color="#FF7B00" stop-opacity="0"/></radialGradient><radialGradient id="${id('lamp')}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFE3A8" stop-opacity=".55"/><stop offset="1" stop-color="#FFE3A8" stop-opacity="0"/></radialGradient></defs>`;
    s += `<rect width="${W}" height="${H}" fill="url(#${id('wall')})"/>`;
    for (let y = 30; y < 600; y += 56) for (let x = (y / 56) % 2 ? 0 : 28; x < W; x += 56) s += `<path d="M${x} ${y - 8}l6 8-6 8-6-8z" fill="#FFD9A0" opacity=".09"/>`;
    s += `<rect y="600" width="${W}" height="120" fill="url(#${id('floor')})"/><path d="M0 600H600" stroke="#3A2010" stroke-width="5"/>`;
    for (let i = 0; i < 4; i++) s += `<path d="M0 ${630 + i * 26}H${W}" stroke="#3A2010" stroke-opacity=".35" stroke-width="2"/>`;
    // fireplace (right)
    s += `<rect x="438" y="350" width="190" height="252" fill="#A9503B"/>`;
    for (let y = 362; y < 600; y += 16) for (let x = 438 + ((y - 362) / 16 % 2 ? 0 : 14); x < 628; x += 28) s += `<rect x="${x}" y="${y}" width="26" height="14" rx="1.5" fill="#B9614A" stroke="#8C3A28" stroke-width="1"/>`;
    s += `<path d="M470 602V478Q470 440 535 440Q600 440 600 478V602Z" fill="#2B1A12"/><circle cx="535" cy="560" r="84" fill="url(#${id('fire')})"/>`;
    s += `<path d="M498 590q-6-34 14-52q-2 22 12 26q-4-30 18-48q0 32 16 40q8-14 4-28q22 22 10 62z" fill="#FF8A1F"/><path d="M512 590q-2-22 12-32q2 14 10 16q2-20 14-28q2 22 10 28q4 4 0 16z" fill="#FFC93C"/><rect x="490" y="586" width="90" height="10" rx="5" fill="#5E3A1A" transform="rotate(-6 535 591)"/><rect x="494" y="588" width="86" height="9" rx="4.5" fill="#7C4A22" transform="rotate(7 535 592)"/>`;
    s += `<rect x="420" y="330" width="200" height="22" rx="4" fill="#F2E8D5"/><rect x="420" y="348" width="200" height="6" fill="#D9C7A7"/>`;
    // mantel candles + stockings
    s += `<rect x="452" y="304" width="10" height="26" rx="2" fill="#FFF6E0"/><path d="M457 296q-5 6 0 9q5-3 0-9z" fill="#FFC93C"/><circle cx="457" cy="300" r="10" fill="#FFE3A8" opacity=".35" class="twinkle"/>`;
    [[470, '#2E8B57'], [538, '#FFF6E0']].forEach(([x, c]) => { s += `<g transform="translate(${x} 354)"><path d="M0 0h22v30c0 8-4 14-12 16c-8 2-16-1-16-8c0-5 5-7 6-8z" fill="${x === 470 ? '#C9182B' : '#1E6B45'}"/><rect x="-3" y="-2" width="28" height="9" rx="4.5" fill="${c === '#2E8B57' ? '#FFF6E0' : '#FFF6E0'}"/></g>`; });
    // floor lamp (left)
    s += `<circle cx="74" cy="360" r="120" fill="url(#${id('lamp')})"/><path d="M72 384V600" stroke="#3A2A1A" stroke-width="5"/><ellipse cx="72" cy="602" rx="26" ry="6" fill="#3A2A1A"/><path d="M46 384h52l-12-46h-28z" fill="#F5D7A1"/><path d="M46 384h52" stroke="#D9B27A" stroke-width="3"/>`;
    // framed picture
    s += `<rect x="112" y="120" width="120" height="92" rx="4" fill="#C49A6C"/><rect x="120" y="128" width="104" height="76" fill="#DCEBF5"/>${pine(150, 200, 50, '#2E6B4A')}${pine(186, 200, 64, '#1E5A3A')}<path d="M120 196q50-12 104 0v8H120z" fill="#fff"/>`;
    return s;
  }
  if (theme === 'snowy-forest') {
    const r = rng(37);
    let s = `<defs><linearGradient id="${id('sky')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9CBE6"/><stop offset=".7" stop-color="#E4F0FA"/><stop offset="1" stop-color="#F4F9FD"/></linearGradient></defs>`;
    s += `<rect width="${W}" height="${H}" fill="url(#${id('sky')})"/><circle cx="470" cy="130" r="60" fill="#fff" opacity=".45"/><circle cx="470" cy="130" r="34" fill="#fff" opacity=".7"/>`;
    s += `<path d="M0 470L90 380L160 430L260 340L360 440L450 360L600 460V720H0Z" fill="#D2E3F1"/><path d="M90 380l-22 22 14-4 8 10 10-12 14 6zM260 340l-26 26 16-6 10 12 12-12 16 6zM450 360l-24 24 14-4 10 10 10-12 14 6z" fill="#fff"/>`;
    const far = [[30, 560, 60], [70, 568, 80], [118, 560, 56], [470, 560, 62], [515, 566, 84], [568, 560, 66], [200, 556, 40], [400, 556, 44]];
    far.forEach(([x, y, h]) => { s += pine(x, y, h, '#8FB0C9'); });
    s += `<path d="M0 560Q150 540 300 556T600 548V720H0Z" fill="#EAF2F9"/>`;
    [[36, 640, 150], [104, 650, 120], [520, 640, 160], [580, 660, 120]].forEach(([x, y, h]) => { s += pine(x, y, h, '#4F7895') + `<path d="M${x} ${y - h}l${h * 0.12} ${h * 0.2}h${-h * 0.24}z" fill="#fff"/>`; });
    s += `<path d="M0 600Q160 576 300 596T600 590V720H0Z" fill="#fff"/><path d="M40 650q60-8 120 0M430 660q60-8 130 0" stroke="#C9DDEE" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    s += snowDots(r, 70, 0, 600, 0.9);
    return s;
  }
  if (theme === 'night-sky') {
    const r = rng(53);
    let s = `<defs><linearGradient id="${id('sky')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A1830"/><stop offset=".6" stop-color="#1C3760"/><stop offset="1" stop-color="#34557F"/></linearGradient><radialGradient id="${id('moon')}"><stop offset="0" stop-color="#FFF3C4" stop-opacity=".5"/><stop offset="1" stop-color="#FFF3C4" stop-opacity="0"/></radialGradient></defs>`;
    s += `<rect width="${W}" height="${H}" fill="url(#${id('sky')})"/>`;
    for (let i = 0; i < 70; i++) {
      const tw = i % 5 === 0;
      s += `<circle cx="${round(r() * W)}" cy="${round(r() * 470)}" r="${round(0.6 + r() * 1.6)}" fill="#fff" opacity="${round(0.4 + r() * 0.6)}"${tw ? ` class="twinkle" style="animation-delay:${round(r() * 2)}s"` : ''}/>`;
    }
    s += `<circle cx="490" cy="110" r="80" fill="url(#${id('moon')})"/><mask id="${id('mk')}"><rect width="600" height="300" fill="#fff"/><circle cx="506" cy="99" r="30" fill="#000"/></mask><circle cx="490" cy="110" r="34" fill="#FFF3C4" mask="url(#${id('mk')})"/>`;
    s += `<path d="M0 520Q120 470 240 520T480 500T600 520V720H0Z" fill="#BBD0E8"/><path d="M0 570Q150 530 300 566T600 556V720H0Z" fill="#DCE8F5"/>`;
    // tiny village
    [[60, 556], [112, 548], [470, 546], [530, 552]].forEach(([x, y], i) => {
      s += `<g transform="translate(${x} ${y})"><rect x="-16" y="-20" width="32" height="22" fill="${i % 2 ? '#5B6F8C' : '#6B7FA0'}"/><path d="M-20 -18L0 -36L20 -18Z" fill="#fff"/><rect x="-6" y="-14" width="8" height="8" fill="#FFD166"/><circle cx="-2" cy="-10" r="10" fill="#FFD166" opacity=".18"/></g>`;
    });
    s += `<path d="M0 604Q150 584 300 600T600 596V720H0Z" fill="#F2F7FD"/>`;
    s += snowDots(r, 30, 0, 600, 0.6);
    return s;
  }
  if (theme === 'rice-field') {
    const r = rng(71);
    let s = `<defs><linearGradient id="${id('sky')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD9A3"/><stop offset=".55" stop-color="#FFEFD2"/><stop offset="1" stop-color="#FFF8E6"/></linearGradient><radialGradient id="${id('sun')}"><stop offset="0" stop-color="#FFE48A" stop-opacity=".9"/><stop offset="1" stop-color="#FFE48A" stop-opacity="0"/></radialGradient><linearGradient id="${id('paddy')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9B542"/><stop offset="1" stop-color="#E0B93A"/></linearGradient><linearGradient id="${id('ground')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C98F4C"/><stop offset="1" stop-color="#9D6A33"/></linearGradient></defs>`;
    s += `<rect width="${W}" height="${H}" fill="url(#${id('sky')})"/><circle cx="470" cy="150" r="120" fill="url(#${id('sun')})"/><circle cx="470" cy="150" r="42" fill="#FFE48A"/>`;
    // far hills + palm silhouettes
    s += `<path d="M0 330Q90 270 190 310T380 290T600 320V400H0Z" fill="#B9D4A6"/><path d="M0 360Q120 320 240 350T470 335T600 360V420H0Z" fill="#9CC48A"/>`;
    [[62, 346, 38], [548, 350, 44]].forEach(([x, y, h]) => {
      s += `<path d="M${x} ${y}q2 -${h * 0.6} -1 -${h}" stroke="#5E7F43" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      for (let k = 0; k < 6; k++) { const a = -150 + k * 36; s += `<path d="M${x - 1} ${y - h}q${round(18 * Math.cos((a * Math.PI) / 180))} ${round(12 * Math.sin((a * Math.PI) / 180) - 6)} ${round(30 * Math.cos((a * Math.PI) / 180))} ${round(26 * Math.sin((a * Math.PI) / 180) + 2)}" stroke="#4F7A3A" stroke-width="3.5" fill="none" stroke-linecap="round"/>`; }
    });
    // village house
    s += `<g transform="translate(118 378)"><rect x="-34" y="-28" width="68" height="34" fill="#F4E3C7"/><path d="M-42 -28L0 -58L42 -28Z" fill="#B5542C"/><rect x="-8" y="-14" width="16" height="20" fill="#7C4A22"/><rect x="16" y="-18" width="12" height="10" fill="#9ED1F0"/><rect x="-28" y="-18" width="12" height="10" fill="#9ED1F0"/></g>`;
    // paddy rows in golden-green
    s += `<rect y="400" width="${W}" height="200" fill="url(#${id('paddy')})"/>`;
    for (let row = 0; row < 7; row++) {
      const y = 412 + row * 27;
      const sp = 14 + row * 5;
      for (let x = (row % 2) * sp / 2; x < W; x += sp) {
        const hh = 9 + row * 3.4;
        s += `<path d="M${round(x)} ${y + hh}q-3 -${round(hh * 0.6)} 0 -${round(hh)}q3 ${round(hh * 0.4)} 0 ${round(hh)}" fill="#6E9A3A" opacity="${round(0.55 + row * 0.06)}"/><path d="M${round(x)} ${y + 2}q2 -8 5 -11" stroke="#E9C64A" stroke-width="2" fill="none" stroke-linecap="round" opacity="${round(0.6 + row * 0.05)}"/>`;
      }
    }
    // field divider paths + water glints
    s += `<path d="M0 468Q300 452 600 470" stroke="#B59334" stroke-opacity=".5" stroke-width="2" fill="none"/><path d="M0 536Q300 520 600 540" stroke="#B59334" stroke-opacity=".5" stroke-width="2.5" fill="none"/>`;
    for (let i = 0; i < 26; i++) s += `<ellipse cx="${round(r() * W)}" cy="${round(430 + r() * 150)}" rx="${round(3 + r() * 6)}" ry="1.2" fill="#fff" opacity="${round(0.25 + r() * 0.3)}"/>`;
    // dirt yard where the tree stands
    s += `<path d="M0 596Q300 560 600 596V720H0Z" fill="url(#${id('ground')})"/><path d="M0 596Q300 560 600 596" stroke="#8F5D2B" stroke-opacity=".5" stroke-width="3" fill="none"/>`;
    for (let i = 0; i < 40; i++) s += `<circle cx="${round(r() * W)}" cy="${round(610 + r() * 100)}" r="${round(1 + r() * 2.2)}" fill="#6B4320" opacity="${round(0.15 + r() * 0.25)}"/>`;
    // dragonflies / birds
    s += `<path d="M330 120q10-8 20 0M350 120q10-8 20 0M400 92q8-6 16 0M416 92q8-6 16 0" stroke="#7A5C3A" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    return s;
  }
  // minimal
  const c = bg.color || '#FBE9D7';
  const light = luminance(c) > 0.35;
  return `<defs><radialGradient id="${id('g')}" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="${shade(c, 0.22)}"/><stop offset="1" stop-color="${shade(c, -0.1)}"/></radialGradient><pattern id="${id('dots')}" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.3" fill="${light ? '#000' : '#fff'}" opacity=".07"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#${id('g')})"/><rect width="${W}" height="${H}" fill="url(#${id('dots')})"/><ellipse cx="300" cy="660" rx="300" ry="60" fill="${shade(c, -0.12)}" opacity=".55"/>`;
}

/* =========================================================
   DECORATIONS
   ========================================================= */
function uniquify(inner, suffix) {
  const ids = new Set();
  inner.replace(/\sid="([^"]+)"/g, (_, i) => { ids.add(i); return _; });
  if (!ids.size) return inner;
  let out = inner;
  ids.forEach((i) => {
    const esc = i.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`\\sid="${esc}"`, 'g'), ` id="${i}-${suffix}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${i}-${suffix})`)
      .replace(new RegExp(`href="#${esc}"`, 'g'), `href="#${i}-${suffix}"`);
  });
  return out;
}

// flip mirrors horizontally
export function transformOf(d) {
  const s = round(d.scale, 3);
  return `translate(${round(d.x)} ${round(d.y)}) rotate(${round(d.rotation)}) scale(${d.flip ? -s : s} ${s})`;
}

export function renderDecoration(d, lib, prefix = '') {
  const a = lib.byId[d.assetId];
  if (!a) return '';
  const w = d.width, h = d.height;
  const color = a.colorable ? d.color || a.defaultColor : '#000000';
  return `<g class="deco${d.locked ? ' locked' : ''}" data-id="${d.instanceId}" transform="${transformOf(d)}" style="color:${color}"><svg x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" viewBox="${a.viewBox}" overflow="visible">${uniquify(a.inner, (prefix + d.instanceId).replace(/[^\w-]/g, ''))}</svg></g>`;
}

/** Standalone SVG for library thumbnails / layer list. */
export function assetSVG(a, color, suffix = 'th') {
  const c = a.colorable ? color || a.defaultColor : '#000000';
  return `<svg viewBox="${a.viewBox}" style="color:${c}" aria-hidden="true" focusable="false">${uniquify(a.inner, `${suffix}-${a.id}`.replace(/[^\w-]/g, ''))}</svg>`;
}

/* =========================================================
   GREETING
   ========================================================= */
let measureCtx = null;
function measure(text, font) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}
const sparkle = (x, y, c) => `<path transform="translate(${round(x)} ${round(y)})" d="M0 -9L2.2 -2.2L9 0L2.2 2.2L0 9L-2.2 2.2L-9 0L-2.2 -2.2Z" fill="${c}"/>`;

export function renderGreeting(g) {
  if (!g || !g.visible) return '';
  let s = '';
  const text = (g.text || '').trim();
  if (text) {
    let size = 23;
    let tw = measure(text, `800 ${size}px Epilogue, sans-serif`);
    const maxW = W - 120;
    if (tw > maxW) { size = Math.max(14, Math.floor((size * maxW) / tw)); tw = measure(text, `800 ${size}px Epilogue, sans-serif`); }
    const pw = tw + 96;
    const x = (W - pw) / 2;
    const h = size + 20;
    const by = 12;
    s += `<g class="greeting-banner"><rect x="${round(x)}" y="${by}" width="${round(pw)}" height="${h}" rx="${h / 2}" fill="#FDFBF7" opacity=".93"/><rect x="${round(x)}" y="${by}" width="${round(pw)}" height="${h}" rx="${h / 2}" fill="none" stroke="#E8DCBE" stroke-width="1.5"/>${sparkle(x + 26, by + h / 2, '#B90C17')}${sparkle(x + pw - 26, by + h / 2, '#B90C17')}<text x="${W / 2}" y="${round(by + h / 2 + size * 0.36)}" text-anchor="middle" font-family="Epilogue, 'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="${size}" fill="${g.color || '#0E472A'}">${escapeHtml(text)}</text></g>`;
  }
  const parts = [g.name ? `Thân gửi từ ${g.name.trim()}` : '', (g.date || '').trim()].filter(Boolean);
  if (parts.length) {
    const line = parts.join('  ·  ');
    const size = 16;
    const tw = Math.min(measure(line, `600 ${size}px 'Plus Jakarta Sans', sans-serif`), W - 80);
    const pw = tw + 40;
    s += `<g class="greeting-sign"><rect x="${round((W - pw) / 2)}" y="${H - 54}" width="${round(pw)}" height="34" rx="17" fill="#FDFBF7" opacity=".9"/><text x="${W / 2}" y="${H - 31.5}" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-weight="600" font-size="${size}" fill="#3F4942" textLength="${tw < W - 80 ? '' : round(tw)}">${escapeHtml(line)}</text></g>`.replace(' textLength=""', '');
  }
  return s;
}

/* =========================================================
   FULL DESIGN
   ========================================================= */
export function renderDesignSVG(design, lib, { uid: u = uid('d'), extraStyle = '', className = '', title = '' } = {}) {
  const deco = design.decorations.map((d) => renderDecoration(d, lib, u + '-')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="${className}" role="img" aria-label="${escapeHtml(title || design.name || 'Cây thông Noel')}">${extraStyle ? `<style>${extraStyle}</style>` : ''}<g class="layer-bg">${renderBackground(design.background, u + 'b')}</g><g class="layer-tree">${renderTree(design.tree, u + 't')}</g><g class="layer-decos">${deco}</g><g class="layer-greeting">${renderGreeting(design.greeting)}</g></svg>`;
}

/* ---------------- PNG export ---------------- */
let fontCssPromise = null;
async function embeddedFontCss() {
  if (fontCssPromise) return fontCssPromise;
  fontCssPromise = (async () => {
    const files = [
      ['Epilogue', 'assets/fonts/epilogue.woff2', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122'],
      ['Epilogue', 'assets/fonts/epilogue-vi.woff2', 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB'],
      ['Plus Jakarta Sans', 'assets/fonts/plus-jakarta-sans.woff2', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122'],
      ['Plus Jakarta Sans', 'assets/fonts/plus-jakarta-sans-vi.woff2', 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB'],
    ];
    const parts = await Promise.all(files.map(async ([fam, url, range]) => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return `@font-face{font-family:'${fam}';src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2');font-weight:200 800;unicode-range:${range};}`;
      } catch { return ''; }
    }));
    return parts.join('');
  })();
  return fontCssPromise;
}

/** An SVG loaded into <img> cannot fetch external files, so raster decorations are inlined as data URIs. */
async function rasterDataUrl(asset) {
  if (asset.dataUrl) return asset.dataUrl;
  const blob = await (await fetch(asset.image)).blob();
  asset.dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('Không đọc được ảnh sản phẩm')); fr.readAsDataURL(blob); });
  return asset.dataUrl;
}

export async function designToPngBlob(design, lib, scale = 2) {
  try { await document.fonts.ready; } catch { /* ignore */ }
  const css = await embeddedFontCss();
  let svg = renderDesignSVG(design, lib, { uid: 'x', extraStyle: css });
  const rasters = [...new Set(design.decorations.map((d) => lib.byId[d.assetId]).filter((a) => a && a.type === 'image'))];
  const dataUrls = await Promise.all(rasters.map(rasterDataUrl));
  rasters.forEach((a, i) => { svg = svg.split(`href="${a.image}"`).join(`href="${dataUrls[i]}"`); });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Không thể tạo ảnh')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Không mã hoá được ảnh PNG'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

/* =========================================================
   RANDOM DECORATOR
   ========================================================= */
const ORNAMENT_CATS = ['products', 'balls', 'ribbons', 'characters', 'extras'];

export function placeTopper(tree, asset) {
  const geo = treeGeometry(tree);
  const [x, y] = geo.apex;
  return { x, y: y - asset.height * 0.28 };
}

/**
 * @param {object} opts {tree, lib, pool?: string[], colors?: string[], count?: number, seed?, topper?: {assetId,color}|null, gifts?: number, strands?: number}
 */
export function generateDecorations(opts) {
  const { tree, lib } = opts;
  const r = rng(opts.seed ?? Math.floor(Math.random() * 1e9));
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const geo = treeGeometry(tree);
  const s = geo.size;
  const pool = (opts.pool?.length ? opts.pool : lib.decorations.map((a) => a.id)).filter((id) => lib.byId[id]);
  const colors = opts.colors?.length ? opts.colors : ['#C9182B', '#E9A93B', '#FFFFFF', '#1E7F4F', '#4E9BE0'];
  const make = (assetId, x, y, extra = {}) => {
    const a = lib.byId[assetId];
    return { instanceId: uid('placed'), assetId, x: round(x, 1), y: round(y, 1), width: a.width, height: a.height, rotation: 0, scale: 1, color: a.colorable ? (extra.color || pick(colors)) : null, locked: false, flip: false, ...extra, ...(a.colorable ? {} : { color: null }) };
  };
  const out = { strands: [], ornaments: [], toppers: [], gifts: [] };

  // strands across tiers
  const strandIds = pool.filter((id) => lib.byId[id].category === 'lights' && lib.byId[id].width > 120 || id === 'ribbon-swag');
  const nStrands = Math.min(opts.strands ?? (strandIds.length ? 2 : 0), geo.tiers.length - 1);
  const tierIdx = [...geo.tiers.keys()].slice(1).sort(() => r() - 0.5).slice(0, nStrands);
  tierIdx.forEach((ti) => {
    const t = geo.tiers[ti];
    const prevBot = geo.tiers[ti - 1].bot;
    const ly = prevBot + (t.bot - prevBot) * 0.42;
    const hw = geo.halfWidthAt(ly);
    const id = pick(strandIds);
    const a = lib.byId[id];
    const [x, y] = geo.toStage(CX, ly);
    const scale = clamp(((hw * 2 - 30) * s) / a.width, 0.5, 2.2);
    out.strands.push(make(id, x + (r() - 0.5) * 10, y, { scale: round(scale, 2), rotation: round((r() - 0.5) * 6, 1) }));
  });

  // ornaments: best-candidate sampling inside the silhouette
  const ornIds = pool.filter((id) => ORNAMENT_CATS.includes(lib.byId[id].category) && id !== 'ribbon-swag' && id !== 'stocking');
  const count = opts.count ?? 14;
  const pts = [];
  const top = geo.toStage(CX, geo.tiers[0].top)[1];
  const bot = geo.toStage(CX, geo.tiers[geo.tiers.length - 1].bot)[1];
  for (let i = 0; i < count && ornIds.length; i++) {
    let best = null, bestD = -1;
    for (let c = 0; c < 40; c++) {
      const x = CX + (r() - 0.5) * 2 * 215 * s;
      const y = top + 40 * s + r() * (bot - top - 50 * s);
      if (!geo.insideTree(x, y, 22)) continue;
      const dmin = pts.reduce((m, p) => Math.min(m, Math.hypot(p[0] - x, (p[1] - y) * 1.15)), 1e9);
      if (dmin > bestD) { bestD = dmin; best = [x, y]; }
    }
    if (!best) continue;
    pts.push(best);
    const id = pick(ornIds);
    out.ornaments.push(make(id, best[0], best[1], { scale: round((0.82 + r() * 0.3) * Math.max(0.8, s), 2), rotation: round((r() - 0.5) * 26, 1) }));
  }

  // topper
  if (opts.topper !== null) {
    const topperIds = pool.filter((id) => lib.byId[id].category === 'toppers');
    const tId = opts.topper?.assetId || (topperIds.length ? pick(topperIds) : 'star-topper');
    if (lib.byId[tId]) {
      const p = placeTopper(tree, lib.byId[tId]);
      out.toppers.push(make(tId, p.x, p.y, { color: opts.topper?.color || (lib.byId[tId].colorable ? lib.byId[tId].defaultColor : null) }));
    }
  }

  // gifts at the base
  const giftIds = pool.filter((id) => lib.byId[id].category === 'gifts' || id === 'stocking');
  const nGifts = Math.min(opts.gifts ?? 3, 5);
  const slots = [-150, -96, 96, 150, -40].sort(() => r() - 0.5).slice(0, nGifts);
  if (giftIds.length) {
    slots.forEach((dx) => {
      const id = pick(giftIds);
      const a = lib.byId[id];
      const sc = round(0.85 + r() * 0.25, 2);
      out.gifts.push(make(id, CX + dx * Math.max(0.85, s) + (r() - 0.5) * 14, ANCHOR_Y - 8 - (a.height * sc) / 2 + 6 + r() * 14, { scale: sc, rotation: round((r() - 0.5) * 8, 1) }));
    });
    out.gifts.sort((a, b) => a.y - b.y);
  }
  return [...out.strands, ...out.ornaments, ...out.toppers, ...out.gifts];
}

/** Smart drop position for the "Add" button. */
export function suggestPosition(design, asset, lib) {
  const geo = treeGeometry(design.tree);
  const s = geo.size;
  if (asset.category === 'toppers') return placeTopper(design.tree, asset);
  if (asset.category === 'gifts' || asset.id === 'stocking') {
    const dx = (Math.random() < 0.5 ? -1 : 1) * (70 + Math.random() * 90) * s;
    return { x: CX + dx, y: ANCHOR_Y - 4 - asset.height / 2 };
  }
  if (asset.width > 120) {
    const ti = 1 + Math.floor(Math.random() * (geo.tiers.length - 1));
    const t = geo.tiers[ti];
    const prevBot = geo.tiers[ti - 1].bot;
    const [x, y] = geo.toStage(CX, prevBot + (t.bot - prevBot) * 0.42);
    return { x, y };
  }
  const pts = design.decorations.map((d) => [d.x, d.y]);
  const top = geo.toStage(CX, geo.tiers[0].top)[1];
  const bot = geo.toStage(CX, geo.tiers[geo.tiers.length - 1].bot)[1];
  let best = { x: CX, y: (top + bot) / 2 }, bestD = -1;
  for (let c = 0; c < 60; c++) {
    const x = CX + (Math.random() - 0.5) * 430 * s;
    const y = top + 40 * s + Math.random() * (bot - top - 50 * s);
    if (!geo.insideTree(x, y, 20)) continue;
    const dmin = pts.reduce((m, p) => Math.min(m, Math.hypot(p[0] - x, p[1] - y)), 1e9);
    if (dmin > bestD) { bestD = dmin; best = { x, y }; }
  }
  return best;
}
