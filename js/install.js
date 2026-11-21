/* install.js — popup pasang PWA di awal halaman.
   Android / Windows / Mac (Chrome, Edge, Samsung Internet, Opera): memakai event `beforeinstallprompt`,
   tombol "Pasang" memanggil dialog instal asli milik browser. Event ini TIDAK dikirim browser bila aplikasi
   sudah terpasang, jadi popup otomatis tidak muncul.
   iPhone / iPad (Safari, dan browser iOS lain): iOS tidak punya dialog instal, jadi popup menampilkan langkah
   "Bagikan > Tambah ke Layar Utama".
   Popup TIDAK muncul bila: dibuka dari aplikasi terpasang (display-mode standalone / navigator.standalone),
   sudah ditutup dalam 3 hari terakhir, atau di iOS pengguna sudah menekan "Sudah terpasang". */
(function () {
  'use strict';
  var ui = document.getElementById('ui'); if (!ui) return;
  /* JAGA KERAS: dibuka dari PWA terpasang (Android/desktop: display-mode, iOS: navigator.standalone, TWA: referrer android-app)
     -> berhenti total di sini, popup tidak pernah dibuat. */
  var K_DONE = 'gp_pwa_done', K_SNOOZE = 'gp_pwa_snooze', SNOOZE_MS = 3 * 864e5, WAIT_SW = 1200;

  function get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (_) {} }
  function mq(q) { try { return matchMedia(q).matches; } catch (_) { return false; } }

  // Berjalan sebagai aplikasi terpasang? (semua mode tampilan PWA + iOS + TWA Android)
  function standalone() {
    return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(function (m) { return mq('(display-mode: ' + m + ')'); }) ||
      navigator.standalone === true ||
      (document.referrer || '').indexOf('android-app://') === 0;
  }
  if (standalone()) return;
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|Snapchat|Twitter|GSA\//.test(ua); // WebView: tidak bisa "Tambah ke Layar Utama"
  function snoozed() { return Date.now() - (+get(K_SNOOZE) || 0) < SNOOZE_MS; }

  var deferred = null, shown = false, pending = false, root = null, layerOn = false;

  function say(m) { if (window.GP && GP.say) GP.say(m); }
  function hide(fromBack) {
    if (!root) return;
    var r = root; root = null;
    if (layerOn) { layerOn = false; if (fromBack !== true && window.GP && GP.layer) GP.layer.pop(); }   // buang entri riwayat milik popup
    r.classList.remove('on'); r.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKey);
    setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 320);
  }
  function snooze() { set(K_SNOOZE, String(Date.now())); hide(); }
  function onKey(e) { if (e.key === 'Escape') snooze(); }

  var SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="#4aa8ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';

  function build(mode) {
    var el = document.createElement('div');
    el.id = 'pwa'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'pwa-h'); el.setAttribute('aria-hidden', 'true');
    var head = '<div class="pwa-head"><img class="pwa-ic" src="icons/icon-192.png" alt="">' +
      '<div><h2 id="pwa-h">' + (mode === 'ios' ? 'Pasang GoPay di perangkatmu' : 'Pasang GoPay di perangkatmu') + '</h2>' +
      '<p>' + (mode === 'ios' ? 'Buka dari layar utama dengan tampilan penuh, tanpa bilah browser.'
                              : 'Buka dari layar utama dengan tampilan penuh, tanpa bilah browser.') + '</p></div></div>';
    var body = mode === 'ios'
      ? '<ol><li><span>Ketuk tombol <b>Bagikan</b> ' + SHARE + ' di Safari</span></li>' +
        '<li><span>Pilih <b>Tambah ke Layar Utama</b></span></li>' +
        '<li><span>Ketuk <b>Tambah</b> di pojok kanan atas</span></li></ol>' +
        '<div class="pwa-btns"><button type="button" class="pwa-no" id="pwa-done">Sudah terpasang</button>' +
        '<button type="button" class="pwa-yes" id="pwa-ok">Mengerti</button></div>'
      : '<div class="pwa-btns"><button type="button" class="pwa-no" id="pwa-later">Nanti saja</button>' +
        '<button type="button" class="pwa-yes" id="pwa-install">Pasang</button></div>';
    el.innerHTML = '<div class="pwa-scrim" id="pwa-scrim"></div><div class="pwa-box">' + head + body + '</div>';
    return el;
  }

  function present() {
    if (shown || standalone() || snoozed()) return;
    var mode = deferred ? 'install' : (ios && !inApp && !get(K_DONE) ? 'ios' : null);
    if (!mode) return;
    shown = true;
    root = build(mode);
    ui.appendChild(root);
    if (window.GP && GP.layer) { layerOn = true; GP.layer.push(function () { set(K_SNOOZE, String(Date.now())); hide(true); }); }   // tombol Back = "Nanti saja"
    var q = function (id) { return root.querySelector('#' + id); };
    q('pwa-scrim').addEventListener('click', snooze);
    if (mode === 'ios') {
      q('pwa-ok').addEventListener('click', snooze);
      q('pwa-done').addEventListener('click', function () { set(K_DONE, '1'); hide(); });
    } else {
      q('pwa-later').addEventListener('click', snooze);
      q('pwa-install').addEventListener('click', function () {
        var d = deferred; deferred = null;
        hide();
        if (!d) return;
        try { d.prompt(); } catch (_) { return; }
        Promise.resolve(d.userChoice).then(function (c) {
          if (c && c.outcome === 'accepted') set(K_DONE, '1'); else set(K_SNOOZE, String(Date.now()));
        }).catch(function () {});
      });
    }
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      if (!root) return;
      root.classList.add('on'); root.setAttribute('aria-hidden', 'false');
      var b = root.querySelector('.pwa-yes'); if (b) b.focus({ preventScroll: true });
    }); });
  }

  // Kunjungan pertama: beri waktu service worker mengambil alih sebelum popup tampil (WAIT_SW).
  function schedule() {
    if (shown || pending) return;
    pending = true;
    var sw = navigator.serviceWorker, fired = false;
    function go() { if (fired) return; fired = true; pending = false; present(); }
    if (!sw || sw.controller) setTimeout(go, 400); else setTimeout(go, WAIT_SW);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();             // tahan dialog bawaan; dipanggil dari tombol "Pasang"
    deferred = e;
    del(K_DONE);                    // browser menawarkan instal = aplikasi belum terpasang
    schedule();
  });
  window.addEventListener('appinstalled', function () {
    deferred = null; set(K_DONE, '1'); hide();
    say('GoPay terpasang. Buka dari layar utama.');
  });
  try {
    var m = matchMedia('(display-mode: standalone)');
    var on = function (e) { if (e.matches) hide(); };
    if (m.addEventListener) m.addEventListener('change', on); else if (m.addListener) m.addListener(on);
  } catch (_) {}

  if (ios && !inApp && !standalone() && !get(K_DONE)) schedule();

  window.GPInstall = { reset: function () { del(K_DONE); del(K_SNOOZE); } };   // untuk uji coba di konsol
})();
