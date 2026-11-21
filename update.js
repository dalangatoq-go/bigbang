/* update.js — pasang sekali di index.html (<script src="update.js"></script>), tidak perlu diubah lagi.
   Mendaftarkan sw.js tanpa cache HTTP, mengecek pembaruan tiap aplikasi dibuka/kembali aktif/tiap 5 menit,
   dan menawarkan muat ulang lewat toast saat ada versi baru (tanpa reload mendadak). */
(function () {
  if (!('serviceWorker' in navigator)) return;
  var reloading = false, pending = false, bar = null;
  var hadController = !!navigator.serviceWorker.controller;   // pemasangan pertama (belum ada controller) tidak dianggap pembaruan
  function reload() {
    if (reloading) return; reloading = true;
    try { sessionStorage.setItem('upd_t', String(Date.now())); } catch (_) {}
    location.reload();                                         // posisi scroll tab disimpan core.js (pagehide) dan dipulihkan
  }
  function recentlyReloaded() {                       // cegah loop reload
    try { return Date.now() - Number(sessionStorage.getItem('upd_t') || 0) < 15000; } catch (_) { return false; }
  }
  function sedangMengetik() {                         // jangan ganggu pengguna yang sedang mengisi sesuatu
    var a = document.activeElement;
    return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
  }
  /* Pembaruan tersedia: tampilkan toast "Muat ulang" (tidak memuat ulang mendadak).
     Diterapkan otomatis saat aplikasi di latar belakang dan pengguna tidak sedang mengetik. */
  function tawarkan() {
    if (pending || recentlyReloaded()) return;
    pending = true;
    var host = document.getElementById('app') || document.body;
    bar = document.createElement('div');
    bar.className = 'gp-upd'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>Pembaruan tersedia</span><button type="button" class="go">Muat ulang</button><button type="button" class="x" aria-label="Nanti saja">\u00d7</button>';
    host.appendChild(bar);
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add('show'); }); });
    bar.querySelector('.go').addEventListener('click', reload);
    bar.querySelector('.x').addEventListener('click', function () { bar.classList.remove('show'); });
    if (window.GP && GP.haptic) GP.haptic('ok');
  }
  document.addEventListener('visibilitychange', function () {   // aplikasi pindah ke latar belakang: aman memuat ulang tanpa terlihat
    if (document.hidden && pending && !sedangMengetik()) reload();
  });
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadController && !recentlyReloaded()) tawarkan(); hadController = true; });
  /* Suara notifikasi: mynotification.mp3 dibunyikan saat push masuk dan aplikasi sedang terbuka.
     Browser mewajibkan satu sentuhan pengguna dulu, jadi audio "dibuka kuncinya" pada interaksi pertama. */
  var bunyi = null;
  function siapAudio() { if (!bunyi) { bunyi = new Audio('mynotification.mp3'); bunyi.preload = 'auto'; } return bunyi; }
  function bukaKunci() {
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (n) { document.removeEventListener(n, bukaKunci, true); });
    try {
      var a = siapAudio(); a.muted = true;
      var p = a.play();
      var selesai = function () { a.pause(); a.currentTime = 0; a.muted = false; };
      if (p && p.then) p.then(selesai).catch(function () { a.muted = false; }); else selesai();
    } catch (_) {}
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (n) { document.addEventListener(n, bukaKunci, true); });
  var terakhir = 0;
  function bunyikan() {
    if (document.hidden) return;
    var n = Date.now(); if (n - terakhir < 1500) return;          // realtime + web push untuk transaksi yang sama: satu bunyi
    terakhir = n;
    try { var a = siapAudio(); a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (_) {}
  }
  window.GPBunyi = bunyikan;                                       // dipakai juga oleh js/notif.js (notifikasi realtime)
  navigator.serviceWorker.addEventListener('message', function (e) {
    if (!e.data) return;
    if (e.data.type === 'APP_UPDATED') tawarkan();
    if (e.data.type === 'PUSH_SOUND' && !(window.GP && window.GP.notif)) bunyikan();   // bila notif.js ada, ia yang membunyikan (dengan dedup per id)
  });
  function cek(reg) {
    var n = Date.now(), t = 0; try { t = Number(sessionStorage.getItem('upd_chk') || 0); } catch (_) {}
    if (n - t < 60000) return;                        // maks. 1x / menit, bukan tiap pindah tab
    try { sessionStorage.setItem('upd_chk', String(n)); } catch (_) {}
    reg.update().catch(function () {});               // cek sw.js baru
    var w = navigator.serviceWorker.controller || reg.active;
    if (w) w.postMessage({ type: 'CHECK' });          // cek index.html baru
  }
  function hangatkanGambar(reg) {
    var kirim = function () {
      var worker = navigator.serviceWorker.controller || reg.active;
      if (worker) worker.postMessage({ type: 'WARM_IMAGES' });
    };
    if ('requestIdleCallback' in window) requestIdleCallback(kirim, { timeout: 4000 });
    else setTimeout(kirim, 2500);
  }
  window.addEventListener('load', function () {
    navigator.serviceWorker.ready.then(hangatkanGambar).catch(function () {});
  }, { once: true });

  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
    cek(reg);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) cek(reg); });
    window.addEventListener('online', function () { cek(reg); });
    setInterval(function () { if (!document.hidden) cek(reg); }, 5 * 60 * 1000);
  }).catch(function () {});
})();
