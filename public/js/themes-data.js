/* Ready-made Christmas themes. Each one sets coordinated colours,
   a background and a decoration pool, then the random decorator
   lays them out. Users can keep editing afterwards. */
import { defaultDesign, clone } from './core.js?v=20261111h';
import { generateDecorations } from './render.js?v=20261111h';

export const THEMES = [
  {
    id: 'phu-nong-harvest', name: 'Mùa Vàng Phú Nông', group: 'traditional',
    badge: 'Phú Nông', badgeIcon: 'eco', photo: 'assets/themes/phu-nong-harvest.jpg?v=2', photoPosition: 'center 35%', photoLabel: 'Đồng lúa', icon: 'agriculture',
    description: 'Cây thông mùa gặt: chai thuốc BVTV và phân bón Phú Nông treo lên cành, quả châu vàng lúa chín, đỏ thắm, ngôi sao sáng giữa cánh đồng bội thu.',
    tags: ['Nông nghiệp', 'Thuốc BVTV', 'Bội thu'],
    palette: ['#176B45', '#E0B93A', '#C9182B', '#FFF8E6'],
    tree: { style: 'classic', leavesColor: '#1E7F4F', trunkColor: '#7A5230', snow: 0, skirtColor: '#E0B93A', lights: true },
    background: { theme: 'rice-field' },
    topper: { assetId: 'star-topper', color: '#FFBA27' },
    pool: ['pn-airforce-300sc', 'pn-anti-one-200sc', 'pn-clicks-500sc', 'pn-fanmax-350sc', 'pn-goldstar-450sc', 'pn-new-vario-250sc', 'pn-trobin-top-325sc', 'pn-nuximgold-40ec', 'pn-fertiplant-1', 'pn-raykat', 'pn-humi-first-wg', 'pn-quizalo-50ec', 'pn-superkumi-200sc', 'pn-picoros-300sc',
      'gold-bauble', 'ruby-bauble', 'velvet-bow', 'warm-garland', 'ribbon-swag', 'gift-stack', 'pine-present', 'striped-gift'],
    colors: ['#E0B93A', '#C9182B', '#FFBA27', '#1E7F4F'],
    count: 16, gifts: 3, strands: 1,
    greeting: 'Giáng Sinh an lành — Mùa vàng bội thu!',
  },
  {
    id: 'classic-heritage', name: 'Cổ Điển Truyền Thống', group: 'traditional',
    badge: 'Phổ biến nhất', badgeIcon: 'star', photo: 'assets/themes/classic-heritage.jpg', photoLabel: 'Vân sam', icon: 'workspace_premium',
    description: 'Xanh rừng thẫm, đỏ nam việt quất, quả châu vàng bóng, ngôi sao đỉnh cây, ruy băng caro và chân đế gỗ ấm cúng.',
    tags: ['Truyền thống', 'Lò sưởi ấm', 'Đồng cổ điển'],
    palette: ['#0E472A', '#B90C17', '#F4A261', '#FFBA27'],
    tree: { style: 'classic', leavesColor: '#145A38', trunkColor: '#6B4423', snow: 0, skirtColor: '#B90C17', lights: true },
    background: { theme: 'fireplace' },
    topper: { assetId: 'star-topper', color: '#FFBA27' },
    pool: ['ruby-bauble', 'gold-bauble', 'velvet-bow', 'candy-cane', 'golden-bell', 'jingle-bells', 'ribbon-swag', 'pine-present', 'striped-gift', 'gift-stack'],
    colors: ['#B90C17', '#E9A93B', '#C9182B', '#F2C14E'],
    count: 15, gifts: 3, strands: 1,
    greeting: 'Chúc Mừng Giáng Sinh & Năm Mới!',
  },
  {
    id: 'winter-wonderland', name: 'Xứ Sở Mùa Đông', group: 'rustic',
    badge: 'Băng giá', badgeIcon: 'ac_unit', photo: 'assets/themes/winter-wonderland.jpg', photoLabel: 'Thông phủ tuyết', icon: 'ac_unit',
    description: 'Cành phủ băng giá, chuông bạc, bông tuyết pha lê, quả châu xanh lạnh và thiên thần lấp lánh trên đỉnh.',
    tags: ['Băng giá', 'Bạc & băng', 'Hơi lạnh mùa đông'],
    palette: ['#FFFFFF', '#B9C6D3', '#A4F4C3', '#F2E8E1'],
    tree: { style: 'snowy', leavesColor: '#4F7F7A', trunkColor: '#6E5A48', snow: 85, skirtColor: '#DCE8F5', lights: true },
    background: { theme: 'snowy-forest' },
    topper: { assetId: 'angel-topper', color: '#F4FAFF' },
    pool: ['frost-bauble', 'teardrop', 'frost-flake', 'golden-bell', 'tiny-star', 'warm-garland', 'tall-gift', 'pine-present'],
    colors: ['#BFD7EA', '#E8EEF3', '#4E9BE0', '#C0C7D0', '#9FD3F0'],
    count: 16, gifts: 3, strands: 1,
    greeting: 'Tuyết rơi, đèn sáng, lòng ấm áp!',
  },
  {
    id: 'pastel-sugar-plum', name: 'Kẹo Ngọt Pastel', group: 'whimsical',
    badge: 'Ngọt ngào', badgeIcon: 'cake', photo: 'assets/themes/pastel-sugar-plum.jpg', photoLabel: 'Hồng đường', icon: 'icecream',
    description: 'Hồng phấn, kem, lá bạc hà, quả châu màu macaron, ruy băng óng ánh và ngôi sao màu sâm panh thanh lịch.',
    tags: ['Kẹp hạt dẻ', 'Kẹo bông', 'Vui nhộn'],
    palette: ['#F7C6D9', '#F2E8D5', '#A8E6CF', '#FCE7B2'],
    tree: { style: 'mini', leavesColor: '#8FD3B0', trunkColor: '#C49A6C', snow: 20, skirtColor: '#F7C6D9', lights: true },
    background: { theme: 'minimal', color: '#FBE0EA' },
    topper: { assetId: 'north-star', color: '#F5D7A1' },
    pool: ['peppermint-ball', 'polka-bauble', 'teardrop', 'velvet-bow', 'candy-cane', 'tiny-star', 'ribbon-swag', 'tall-gift', 'striped-gift'],
    colors: ['#F7A8C4', '#FCE7B2', '#A8E6CF', '#C5B3E6', '#FFD6E0'],
    count: 13, gifts: 3, strands: 1,
    greeting: 'Giáng Sinh ngọt ngào nhất!',
  },
  {
    id: 'nordic-forest', name: 'Rừng Bắc Âu & Thiên Nhiên', group: 'rustic',
    badge: 'Tự nhiên', badgeIcon: 'eco', photo: 'assets/themes/nordic-forest.jpg', photoLabel: 'Tuyết tùng', icon: 'forest', photoPosition: '78% center',
    description: 'Quả thông tự nhiên, tuần lộc gỗ, dây vải bố, đèn trắng ấm và ngôi sao gỗ tối giản.',
    tags: ['Hygge', 'Gỗ mộc', 'Thủ công'],
    palette: ['#0E472A', '#8B5A2B', '#E8DCBE', '#F2E8E1'],
    tree: { style: 'mini', leavesColor: '#2F5D3A', trunkColor: '#7A5230', snow: 10, skirtColor: '#D9C7A7', lights: false },
    background: { theme: 'cozy-room' },
    topper: { assetId: 'star-topper', color: '#C49A6C' },
    pool: ['pine-cone', 'reindeer', 'holly', 'frost-flake', 'tiny-star', 'warm-garland', 'gift-stack', 'pine-present'],
    colors: ['#C49A6C', '#F2E8D5', '#FFFFFF', '#E8DCBE'],
    count: 12, gifts: 2, strands: 2,
    greeting: 'Bình yên & ấm áp mùa lễ',
  },
  {
    id: 'gingerbread-bakery', name: 'Tiệm Bánh Gừng', group: 'whimsical',
    badge: 'Thơm vị quế', badgeIcon: 'bakery_dining', photo: 'assets/themes/gingerbread-bakery.jpg', photoLabel: 'Vỏ quế', icon: 'cookie',
    description: 'Người bánh gừng đáng yêu, gậy kẹo bạc hà, đèn ấm màu quế, bánh quy trang trí và nơ kem đường.',
    tags: ['Mật ong quế', 'Gậy kẹo', 'Gia đình vui vẻ'],
    palette: ['#7C5700', '#E63946', '#FFFFFF', '#F4A261'],
    tree: { style: 'classic', leavesColor: '#2E6B4A', trunkColor: '#8B5A2B', snow: 30, skirtColor: '#8B5A2B', lights: true },
    background: { theme: 'cozy-room' },
    topper: { assetId: 'bow-topper', color: '#D62828' },
    pool: ['gingerbread', 'candy-cane', 'peppermint-ball', 'velvet-bow', 'golden-bell', 'tiny-santa', 'fairy-strand', 'stocking', 'striped-gift'],
    colors: ['#D62828', '#F4A261', '#FFFFFF', '#E63946'],
    count: 15, gifts: 3, strands: 1,
    greeting: 'Giáng Sinh thơm ngọt yêu thương!',
  },
  {
    id: 'midnight-starlight', name: 'Đêm Sao Lấp Lánh', group: 'traditional',
    badge: 'Bầu trời sao', badgeIcon: 'nights_stay', photo: 'assets/themes/midnight-starlight.jpg', photoLabel: 'Linh sam đêm', icon: 'auto_awesome',
    description: 'Không gian xanh nhung đêm, dây kim tuyến vàng óng, ngôi sao rực rỡ trên đỉnh và đèn nhấp nháy như chòm sao.',
    tags: ['Đêm vũ trụ', 'Vàng ròng', 'Rực sáng'],
    palette: ['#231A11', '#FFBA27', '#F4A261', '#FDFBF7'],
    tree: { style: 'classic', leavesColor: '#123F2E', trunkColor: '#4A3424', snow: 0, skirtColor: '#1E2A4A', lights: true },
    background: { theme: 'night-sky' },
    topper: { assetId: 'north-star', color: '#FFC93C' },
    pool: ['gold-bauble', 'teardrop', 'tiny-star', 'glow-bulb', 'warm-garland', 'polka-bauble', 'tall-gift', 'gift-stack'],
    colors: ['#FFC93C', '#F4A261', '#E8EEF3', '#E9A93B'],
    count: 16, gifts: 3, strands: 2,
    greeting: 'Gửi bạn ánh sao lời chúc!',
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
