/* js/notif.js — notifikasi transaksi REALTIME di dalam aplikasi (dimuat di semua halaman).
   Sumber: INSERT pada tabel history lewat Supabase Realtime (WebSocket), jadi banner + suara muncul
   hitungan milidetik setelah server mencatat transaksi — tanpa menunggu web push.
   Jalur kedua: pesan PUSH_SOUND dari sw.js (web push) memakai fungsi yang sama; keduanya dideduplikasi per id.
   - Hanya baris dari aksi Gx (gx_id terisi), sama seperti trigger server history_notifikasi_push.
   - Teks pesan sama persis dengan fungsi SQL history_pesan_notifikasi.
   - Suara: mynotification.mp3 lewat window.GPBunyi (update.js). Saat aplikasi tersembunyi, yang berbunyi
     notifikasi sistem dari web push.
   - Menawarkan pengaktifan web push (aktifkanNotifikasi dari push.js) lewat satu tombol, karena izin
     notifikasi wajib diminta dari sentuhan pengguna. */
(function () {
  'use strict';
  var ui = document.getElementById('ui');
  var GP = window.GP = window.GP || {};
  if (!ui) return;

  var HALAMAN_RIWAYAT = '';   // isi 'riwayat.html' bila halaman itu ada; kosong = ketuk banner hanya menutupnya
  var TAMPIL_MS = 5000, SKIP_KEY = 'gp_notif_skip', SKIP_MS = 3 * 864e5;
  var sudah = {};                                   // id history yang sudah dibunyikan/ditampilkan
  var bannerEl = null, tutupT = 0;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ribuan(n) { return String(Math.round(Math.abs(+n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function nom(r) { return r.satuan === 'coins' ? ribuan(r.nominal) + ' Coins' : 'Rp' + ribuan(r.nominal); }

  /* sama dengan public.history_pesan_notifikasi(history) */
  function pesan(r) {
    var n = nom(r);
    if (r.status === 'gagal') {
      if (r.jenis === 'topup') return 'Top up failed. ' + n + ' could not be processed.';
      if (r.jenis === 'bayar_teman') return 'Payment failed. ' + n + ' could not be processed.';
      return 'Transaction failed. ' + n + ' could not be processed.';
    }
    if (r.jenis === 'topup') return 'Top up successful. ' + n + ' added to GoPay.';
    if (r.jenis === 'bayar_teman') return r.arah === 'keluar' ? 'You have paid ' + n + ' from GoPay.' : 'You have received ' + n + ' on GoPay.';
    return 'Transaction successful. ' + n + '.';
  }

  /* ---- gaya (disuntik sekali) ---- */
  var st = document.createElement('style');
  st.textContent =
    '.gpn{position:absolute;left:8px;right:8px;top:calc(8px + var(--safe-t,0px));z-index:2147482500;display:flex;gap:10px;align-items:center;padding:11px 12px;border-radius:16px;' +
    'background:#e9edf0;color:#15181b;box-shadow:0 8px 24px rgba(0,0,0,.35);font:600 12.5px/1.35 "Plus Jakarta Sans",system-ui,sans-serif;' +
    'transform:translateY(-130%);opacity:0;transition:transform .28s cubic-bezier(.2,.8,.2,1),opacity .2s;cursor:pointer}' +
    '.gpn.on{transform:translateY(0);opacity:1}' +
    '.gpn i{flex:none;width:30px;height:30px;border-radius:9px;background:#00aed6;display:grid;place-items:center;color:#fff;font:800 13px/1 "Plus Jakarta Sans",system-ui,sans-serif;font-style:normal}' +
    '.gpn b{display:block;font-size:11px;font-weight:700;color:#5b646b;margin-bottom:1px}' +
    '.gpn span{display:block;word-break:break-word}' +
    '.gpn button{flex:none;border:0;border-radius:10px;padding:7px 11px;background:#00aed6;color:#fff;font:700 12px "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer}' +
    '.gpn button.q{background:transparent;color:#5b646b;padding:7px 6px}';
  document.head.appendChild(st);

  function info(teks) {
    if (GP.say) GP.say(teks); else banner('<i>G</i><div><span>' + esc(teks) + '</span></div>', 3500, null);
  }

  function tutup() {
    clearTimeout(tutupT);
    if (!bannerEl) return;
    var el = bannerEl; bannerEl = null;
    el.classList.remove('on');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
  }
  function banner(html, ms, onClick) {
    tutup();
    var el = document.createElement('div');
    el.className = 'gpn'; el.setAttribute('role', 'status'); el.innerHTML = html;
    ui.appendChild(el); bannerEl = el;
    void el.offsetWidth; el.classList.add('on');
    if (onClick) el.addEventListener('click', function (e) { if (e.target.tagName === 'BUTTON') return; onClick(); });
    if (ms) tutupT = setTimeout(tutup, ms);
    return el;
  }

  /* notifikasi sistem (silent) dari sw.js tidak perlu dobel bila banner ini sudah tampil */
  function tutupNotifSistem(id) {
    if (!('serviceWorker' in navigator)) return;
    var tag = 'notif-' + id;
    function tutupSemua() {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (!reg || !reg.getNotifications) return;
        return reg.getNotifications({ tag: tag }).then(function (l) { l.forEach(function (n) { n.close(); }); });
      }).catch(function () {});
    }
    setTimeout(tutupSemua, 400); setTimeout(tutupSemua, 2500);
  }

  /* titik masuk tunggal: realtime DAN web push memanggil ini */
  function tampil(id, teks, judul) {
    if (id != null) { if (sudah[id]) return; sudah[id] = 1; }
    if (!teks) return;
    if (!document.hidden) {
      if (window.GPBunyi) window.GPBunyi();
      banner('<i>G</i><div><b>' + esc(judul || 'GoPay') + '</b><span>' + esc(teks) + '</span></div>', TAMPIL_MS, function () {
        tutup();
        if (HALAMAN_RIWAYAT && location.pathname.slice(-HALAMAN_RIWAYAT.length) !== HALAMAN_RIWAYAT) location.href = HALAMAN_RIWAYAT;
      });
      if (id != null) tutupNotifSistem(id);
    }
  }
  GP.notif = tampil;

  /* ---- jalur 1: Supabase Realtime (tercepat) ---- */
  var sb = (GP.sb && GP.sb()) || window.__sb ||
    (window.supabase && window.GP_CFG ? (window.__sb = window.supabase.createClient(window.GP_CFG.url, window.GP_CFG.key)) : null);
  function prosesHistoryRealtime(p) {
    var r = p && p.new;
    if (!r || r.gx_id == null) return;                           // hanya dari aksi Gx, seperti trigger server
    tampil(r.id, pesan(r), 'GoPay');
  }
  // Halaman Riwayat sudah memiliki subscription untuk semua perubahan history.
  // Pakai event INSERT dari kanal itu agar tidak membuka kanal history kedua.
  GP._notifHistoryRealtime = prosesHistoryRealtime;
  if (sb && document.body.getAttribute('data-tab') !== 'Riwayat') {
    sb.channel('notif-history')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history' }, prosesHistoryRealtime)
      .subscribe();
  }

  /* ---- jalur 2: web push (sw.js memberi tahu halaman yang terlihat) ---- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      var m = e.data || {};
      if (m.type === 'PUSH_SOUND') tampil(m.id, m.body, m.title);
    });
  }

  /* ---- tawaran mengaktifkan web push (perlu satu ketukan pengguna) ---- */
  function bolehTawar() {
    if (!window.aktifkanNotifikasi || !window.Notification || !('PushManager' in window) || !('serviceWorker' in navigator)) return false;
    if (Notification.permission !== 'default') return false;
    try { if (Date.now() - Number(localStorage.getItem(SKIP_KEY) || 0) < SKIP_MS) return false; } catch (_) {}
    return true;
  }
  function tawarkan() {
    if (!bolehTawar() || bannerEl) return;
    var el = banner('<i>G</i><div><b>Notifikasi</b><span>Aktifkan agar transaksi langsung terbunyi dan muncul di perangkat ini.</span></div>' +
      '<button type="button" data-a="ya">Aktifkan</button><button type="button" class="q" data-a="nanti">Nanti</button>', 0, null);
    el.addEventListener('click', function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
      if (!a) return;
      if (a === 'nanti') { try { localStorage.setItem(SKIP_KEY, String(Date.now())); } catch (_) {} tutup(); return; }
      window.aktifkanNotifikasi().then(function (r) {
        tutup();
        info(r && r.ok ? 'Notifikasi diaktifkan' : (r && r.alasan) || 'Notifikasi belum aktif');
      }).catch(function (err) {
        tutup(); info('Gagal mengaktifkan notifikasi' + (err && err.message ? ': ' + err.message : ''));
      });
    });
  }
  // beri ruang bagi popup "Pasang GoPay": selama #pwa masih ada, tunda (maks. ~30 dtk)
  function mulai(n) {
    if (document.getElementById('pwa') && n < 20) { setTimeout(function () { mulai(n + 1); }, 1500); return; }
    tawarkan();
  }
  setTimeout(function () { mulai(0); }, 2500);
})();
