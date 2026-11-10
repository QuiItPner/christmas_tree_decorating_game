/* Ready-made Christmas themes. Each one sets coordinated colours,
   a background and a decoration pool, then the random decorator
   lays them out. Users can keep editing afterwards. */
import { defaultDesign, clone } from './core.js';
import { generateDecorations } from './render.js';

export const THEMES = [
  {
    id: 'classic-heritage', name: 'Classic Heritage', group: 'traditional',
    badge: 'Most Popular', badgeIcon: 'star', photo: 'assets/themes/classic-heritage.jpg', photoLabel: 'Spruce', icon: 'workspace_premium',
    description: 'Deep forest green, cranberry red, polished gold baubles, a star topper, tartan ribbon and a cozy warm wood base.',
    tags: ['Traditional', 'Cozy Hearth', 'Victorian Brass'],
    palette: ['#0E472A', '#B90C17', '#F4A261', '#FFBA27'],
    tree: { style: 'classic', leavesColor: '#145A38', trunkColor: '#6B4423', snow: 0, skirtColor: '#B90C17', lights: true },
    background: { theme: 'fireplace' },
    topper: { assetId: 'star-topper', color: '#FFBA27' },
    pool: ['ruby-bauble', 'gold-bauble', 'velvet-bow', 'candy-cane', 'golden-bell', 'jingle-bells', 'ribbon-swag', 'pine-present', 'striped-gift', 'gift-stack'],
    colors: ['#B90C17', '#E9A93B', '#C9182B', '#F2C14E'],
    count: 15, gifts: 3, strands: 1,
    greeting: 'Merry Christmas & Happy Holidays!',
  },
  {
    id: 'winter-wonderland', name: 'Winter Wonderland', group: 'rustic',
    badge: 'Frosted', badgeIcon: 'ac_unit', photo: 'assets/themes/winter-wonderland.jpg', photoLabel: 'Flocked Pine', icon: 'ac_unit',
    description: 'Icy frosted branches, silver bells, crystal snowflakes, cool blue baubles and a glittering angel topper.',
    tags: ['Frostbite', 'Silver & Ice', 'Chilled Aura'],
    palette: ['#FFFFFF', '#B9C6D3', '#A4F4C3', '#F2E8E1'],
    tree: { style: 'snowy', leavesColor: '#4F7F7A', trunkColor: '#6E5A48', snow: 85, skirtColor: '#DCE8F5', lights: true },
    background: { theme: 'snowy-forest' },
    topper: { assetId: 'angel-topper', color: '#F4FAFF' },
    pool: ['frost-bauble', 'teardrop', 'frost-flake', 'golden-bell', 'tiny-star', 'warm-garland', 'tall-gift', 'pine-present'],
    colors: ['#BFD7EA', '#E8EEF3', '#4E9BE0', '#C0C7D0', '#9FD3F0'],
    count: 16, gifts: 3, strands: 1,
    greeting: 'Let it snow, let it glow!',
  },
  {
    id: 'pastel-sugar-plum', name: 'Pastel Sugar Plum', group: 'whimsical',
    badge: 'Confectionery', badgeIcon: 'cake', photo: 'assets/themes/pastel-sugar-plum.jpg', photoLabel: 'Sugar Blush', icon: 'icecream',
    description: 'Soft pink, cream, mint leaves, pastel macaron baubles, iridescent ribbon and an elegant champagne star.',
    tags: ['Nutcracker', 'Cotton Candy', 'Whimsical'],
    palette: ['#F7C6D9', '#F2E8D5', '#A8E6CF', '#FCE7B2'],
    tree: { style: 'mini', leavesColor: '#8FD3B0', trunkColor: '#C49A6C', snow: 20, skirtColor: '#F7C6D9', lights: true },
    background: { theme: 'minimal', color: '#FBE0EA' },
    topper: { assetId: 'north-star', color: '#F5D7A1' },
    pool: ['peppermint-ball', 'polka-bauble', 'teardrop', 'velvet-bow', 'candy-cane', 'tiny-star', 'ribbon-swag', 'tall-gift', 'striped-gift'],
    colors: ['#F7A8C4', '#FCE7B2', '#A8E6CF', '#C5B3E6', '#FFD6E0'],
    count: 13, gifts: 3, strands: 1,
    greeting: 'Sweetest wishes this Christmas',
  },
  {
    id: 'nordic-forest', name: 'Nordic Forest & Nature', group: 'rustic',
    badge: 'Organic', badgeIcon: 'eco', photo: 'assets/themes/nordic-forest.jpg', photoLabel: 'Wild Cedar', icon: 'forest', photoPosition: '78% center',
    description: 'Natural pinecones, wooden reindeer, burlap garland, warm white fairy lights and a minimalist wooden star.',
    tags: ['Hygge', 'Earthy Timber', 'Artisan Wood'],
    palette: ['#0E472A', '#8B5A2B', '#E8DCBE', '#F2E8E1'],
    tree: { style: 'minimalist', leavesColor: '#2F5D3A', trunkColor: '#7A5230', snow: 10, skirtColor: '#D9C7A7', lights: false },
    background: { theme: 'cozy-room' },
    topper: { assetId: 'star-topper', color: '#C49A6C' },
    pool: ['pine-cone', 'reindeer', 'holly', 'frost-flake', 'tiny-star', 'warm-garland', 'gift-stack', 'pine-present'],
    colors: ['#C49A6C', '#F2E8D5', '#FFFFFF', '#E8DCBE'],
    count: 12, gifts: 2, strands: 2,
    greeting: 'Peace, warmth & pine',
  },
  {
    id: 'gingerbread-bakery', name: 'Gingerbread Bakery', group: 'whimsical',
    badge: 'Sweet Spices', badgeIcon: 'bakery_dining', photo: 'assets/themes/gingerbread-bakery.jpg', photoLabel: 'Cinnamon Bark', icon: 'cookie',
    description: 'Cute gingerbread figures, peppermint candy canes, warm cinnamon lights, spiced cookie ornaments and frosting bows.',
    tags: ['Spiced Honey', 'Candy Cane', 'Playful Family'],
    palette: ['#7C5700', '#E63946', '#FFFFFF', '#F4A261'],
    tree: { style: 'classic', leavesColor: '#2E6B4A', trunkColor: '#8B5A2B', snow: 30, skirtColor: '#8B5A2B', lights: true },
    background: { theme: 'cozy-room' },
    topper: { assetId: 'bow-topper', color: '#D62828' },
    pool: ['gingerbread', 'candy-cane', 'peppermint-ball', 'velvet-bow', 'golden-bell', 'tiny-santa', 'fairy-strand', 'stocking', 'striped-gift'],
    colors: ['#D62828', '#F4A261', '#FFFFFF', '#E63946'],
    count: 15, gifts: 3, strands: 1,
    greeting: 'Baked with love this Christmas',
  },
  {
    id: 'midnight-starlight', name: 'Midnight Starlight', group: 'traditional',
    badge: 'Celestial', badgeIcon: 'nights_stay', photo: 'assets/themes/midnight-starlight.jpg', photoLabel: 'Midnight Fir', icon: 'auto_awesome',
    description: 'Deep navy velvet atmosphere, shimmering gold garlands, radiant celestial toppers and twinkling constellation lights.',
    tags: ['Cosmic Night', 'Pure Gold', 'Luminous'],
    palette: ['#231A11', '#FFBA27', '#F4A261', '#FDFBF7'],
    tree: { style: 'classic', leavesColor: '#123F2E', trunkColor: '#4A3424', snow: 0, skirtColor: '#1E2A4A', lights: true },
    background: { theme: 'night-sky' },
    topper: { assetId: 'north-star', color: '#FFC93C' },
    pool: ['gold-bauble', 'teardrop', 'tiny-star', 'glow-bulb', 'warm-garland', 'polka-bauble', 'tall-gift', 'gift-stack'],
    colors: ['#FFC93C', '#F4A261', '#E8EEF3', '#E9A93B'],
    count: 16, gifts: 3, strands: 2,
    greeting: 'Starlit wishes for you',
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || null;

/** Builds a complete design for a theme. Pass a base design to keep its greeting/name. */
export function designFromTheme(theme, lib, { base = null, seed } = {}) {
  const d = base ? clone(base) : defaultDesign();
  d.themeId = theme.id;
  d.tree = { ...d.tree, ...theme.tree, branchesLinked: true, size: 1, snowColor: '#FFFFFF', skirt: true };
  d.background = { ...d.background, ...theme.background };
  d.decorations = generateDecorations({
    tree: d.tree, lib, pool: theme.pool, colors: theme.colors, count: theme.count,
    topper: theme.topper, gifts: theme.gifts, strands: theme.strands, seed: seed ?? theme.id,
  });
  if (!base) { d.greeting.text = theme.greeting; d.name = theme.name; }
  return d;
}
