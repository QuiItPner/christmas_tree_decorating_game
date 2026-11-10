/* Classic (non-module) script: it still runs when the page is opened straight from disk
   (file://), where the browser blocks the ES modules. Instead of the page hanging on its
   "Đang tải…" placeholders, show what went wrong and how to fix it.
   Usage: <script src="js/boot-check.js" data-ready="CSS selector that exists once the page has loaded"></script> */
(function () {
  var script = document.currentScript;
  var readySelector = (script && script.getAttribute('data-ready')) || '';

  function warn(html) {
    if (document.getElementById('boot-warning')) return;
    var box = document.createElement('div');
    box.id = 'boot-warning';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:1000;max-width:720px;margin:0 auto;'
      + 'background:#fff;color:#13261B;border-left:6px solid #B90C17;border-radius:14px;padding:16px 20px;'
      + 'box-shadow:0 18px 40px rgba(0,0,0,.25);font:500 15px/1.55 "Plus Jakarta Sans",system-ui,sans-serif;';
    box.innerHTML = html;
    document.body.appendChild(box);
  }
  var code = 'style="background:#EBF1E4;padding:1px 6px;border-radius:5px;font-family:ui-monospace,Consolas,monospace"';

  if (location.protocol === 'file:') {
    var start = function () {
      warn('<b>Trang đang được mở trực tiếp từ file nên trình duyệt chặn tải dữ liệu.</b><br>'
        + 'Hãy chạy server rồi mở <a href="http://localhost:5173/" style="color:#0B6B3A;font-weight:700">http://localhost:5173</a>:<br>'
        + 'mở terminal tại thư mục dự án và gõ <span ' + code + '>cd public</span> rồi <span ' + code + '>python -m http.server 5173</span>.');
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
    return;
  }

  if (!readySelector) return;
  window.addEventListener('load', function () {
    setTimeout(function () {
      if (document.querySelector(readySelector)) return;
      warn('<b>Không tải được dữ liệu của trang.</b><br>'
        + 'Kiểm tra server ở máy còn chạy không (<span ' + code + '>python -m http.server 5173</span> trong thư mục <span ' + code + '>public</span>), '
        + 'rồi tải lại trang bằng <span ' + code + '>Ctrl + F5</span>.');
    }, 8000);
  });
})();
