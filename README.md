# My Little Christmas Tree

Website trang trí cây thông Noel. Đây là site tĩnh viết bằng HTML/CSS/JS thuần, không có backend và không cần bước build.
Thiết kế dựa trên [My_Little_Christmas_Tree_Project_Blueprint.md](My_Little_Christmas_Tree_Project_Blueprint.md) và các mockup trong [store/](store/).

## Chạy ở máy

Site dùng ES modules và `fetch()`, nên phải chạy qua HTTP. Mở trực tiếp file HTML (`file://`) sẽ không chạy.

```bash
npm start                         # chạy http://localhost:5173 (dùng gói serve qua npx)
# hoặc
cd public && python -m http.server 5173
```

## Deploy lên Vercel

Push repo lên rồi import vào Vercel. File `vercel.json` đã đặt `outputDirectory` là `public`, không cần build command.

## Cấu trúc

```text
public/
├── index.html        Trang chủ, mục About & Greetings
├── studio.html       Tree Studio (trình chỉnh sửa)
├── themes.html       Themes & Styles + bộ trộn màu
├── gallery.html      My Gallery (lưu trong LocalStorage)
├── css/styles.css
├── js/
│   ├── core.js         lưu trữ, thư viện asset, model design, header/footer, toast, dialog, nhạc, share link
│   ├── render.js       render SVG: cây, nền, đồ trang trí, lời chúc, xuất PNG, Random Decorate
│   ├── themes-data.js  6 theme dựng sẵn
│   └── studio.js / themes.js / gallery.js / home.js
└── assets/
    ├── manifest.json   danh mục đồ trang trí
    ├── decorations/<category>/*.svg
    ├── themes/*.jpg    ảnh minh hoạ theme
    └── fonts/          Epilogue + Plus Jakarta Sans, có bản tiếng Việt (nhúng vào khi xuất PNG)
```

## Thêm đồ trang trí mới

Không cần sửa code của editor:

1. Đặt file SVG vào `public/assets/decorations/<category>/`.
2. Thêm một mục vào `public/assets/manifest.json`:

```json
{
  "id": "my-ornament",
  "name": "My Ornament",
  "category": "balls",
  "image": "assets/decorations/balls/my-ornament.svg",
  "colorable": true,
  "defaultColor": "#C9182B",
  "width": 46,
  "height": 46,
  "keywords": "ball red shiny"
}
```

- `id` cần giữ cố định, vì các design đã lưu tham chiếu tới nó.
- Nếu đồ trang trí đổi được màu, các phần cần đổi màu phải dùng `fill="currentColor"` (hoặc `stroke`).
- Những phần tử có `class="twinkle"` sẽ nhấp nháy khi bật Twinkle.
- `width` và `height` là kích thước mặc định trên stage 600×720.
- `category` phải là một trong các giá trị: `balls`, `toppers`, `ribbons`, `characters`, `lights`, `gifts`, `extras`. Bạn cũng có thể thêm category mới trong `categories`.

## Tính năng

- Cây gồm 4 kiểu: Classic, Mini, Snowy, Minimalist. Lá, cành, thân, váy cây và tuyết đổi màu riêng được, chọn bằng swatch, color picker hoặc nhập HEX.
- Có thể chỉnh kích thước cây, độ phủ tuyết và bật/tắt dây đèn.
- Thư viện có 31 đồ trang trí trong 7 nhóm, tìm kiếm được.
- Đặt đồ trang trí bằng kéo-thả (chuột, hoặc nhấn giữ trên màn hình cảm ứng) hay nút Add.
- Với đồ đã đặt: di chuyển, scale, xoay (bằng handle, slider hoặc pinch 2 ngón), nhân bản, lật, đổi lớp, khoá, xoá, đổi màu. Có bảng Layers.
- Phím tắt: Undo/Redo, Reset, Clear, Random Decorate, Preview, Zoom, `Del`, `Ctrl+D`, phím mũi tên, `[` `]`.
- 5 kiểu nền, tuyết rơi, đèn nhấp nháy. Nhạc nền tắt sẵn (tự bật lên).
- Lời chúc gồm nội dung, tên và ngày hoặc lời đề tặng.
- 6 theme dựng sẵn, cùng bộ trộn màu để tự tạo theme.
- Thiết kế đang làm được tự động lưu. My Gallery chứa tối đa 20 cây: đánh dấu yêu thích, đổi tên, nhân bản, import/export JSON, xem dạng thiệp.
- Xuất PNG độ phân giải 1200×1440.
- Link chia sẻ chứa toàn bộ design, nén trong phần `#hash` của URL, nên không cần server.
