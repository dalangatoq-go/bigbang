/* ============================================================================
   sw.js — Service Worker "update langsung" (tidak perlu diubah-ubah lagi)
   ----------------------------------------------------------------------------
   Prinsip:
   - Berkas statis (CSS, JS, font, ikon, gambar, suara) memakai "cache dulu, perbarui di belakang layar":
     app langsung muncul walau sinyal lemah, seperti aplikasi native.
   - Halaman HTML memakai jaringan dulu dengan batas waktu singkat (NAV_TIMEOUT), lalu cache.
   - Saat index.html berubah, SW menyegarkan semua berkas inti di cache lalu memberi tahu halaman
     (APP_UPDATED); halaman menampilkan toast, tidak memuat ulang mendadak (lihat update.js).
   - Offline: halaman tak ter-cache jatuh ke offline.html yang rapi.
   - install -> skipWaiting, activate -> clients.claim: SW baru langsung aktif.
   - Halaman bisa minta pengecekan ("CHECK"); jika index berubah, SW membalas
     "APP_UPDATED" dan halaman (lihat update.js) memuat ulang otomatis.
   - Menangani notifikasi push (dikirim dari tabel history lewat edge function kirim-push).
   Tidak ada nomor versi yang perlu dinaikkan. Bila suatu saat ingin menghapus
   semua cache paksa, ganti CACHE saja.
   ========================================================================== */
var CACHE = 'app-runtime-13';
var GAMBAR = [];   // dibuat otomatis dari assets/img (lihat README)
var CORE = ['./', './index.html', './akun.html', './masuk.html', './onboarding.html', './pin.html', './qris.html', './bantuan.html', './offline.html',
            './manifest.webmanifest', './update.js', './js/install.js', './css/install.css', './push.js', './js/notif.js', './js/config.js', './mynotification.mp3',
            './icons/icon-192.png', './icons/icon-512.png', './icons/badge-96.png', './icons/apple-touch-icon.png',
            './assets/fonts/DMSansEmb.woff', './assets/fonts/BitterEmb.woff', './assets/qris/alfamart.png', './assets/qris/qris-logo.png', './assets/qris/ico-tap.png', './assets/qris/ico-upload.png', './assets/qris/ico-promo.png'];   // shell inti; gambar dihangatkan setelah tampilan pertama siap
var NAV_TIMEOUT = 2500;                                         // ms; HTML lewat ini pakai cache jika ada
var STATIC_RE = /\.(css|js|woff2?|png|webp|svg|jpg|jpeg|gif|ico|mp3|webmanifest)$/i;
var CDN_OK = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];
var CDN_WARM = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'];   // dihangatkan agar tersedia offline sejak pemasangan

function warm(c, u, opt) {
  return fetch(u, opt || { cache: 'no-store' }).then(function (r) { if (r && (r.ok || r.type === 'opaque')) return c.put(u, r); }).catch(function () {});
}
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE.map(function (u) { return warm(c, u); }).concat(CDN_WARM.map(function (u) { return warm(c, new Request(u, { mode: 'no-cors' }), {mode: 'no-cors'}); })));
  }));
});

// Gambar non-kritis di-cache setelah halaman pertama selesai dirender.
// Semua gambar tetap dihangatkan agar dukungan offline dipertahankan, tetapi
// tidak ikut berebut bandwidth pada fase install/initial loading.
var warmingImages = false;
var IMAGE_WARM_MARKER = './__gp_internal__/images-warmed-v1';
self.addEventListener('message', function (event) {
  if (!event.data || event.data.type !== 'WARM_IMAGES' || warmingImages) return;
  warmingImages = true;
  event.waitUntil((async function () {
    try {
      var cache = await caches.open(CACHE);
      var marker = new Request(new URL(IMAGE_WARM_MARKER, self.registration.scope).href);
      // Setelah satu putaran selesai, halaman berikutnya tidak perlu memeriksa
      // ulang seluruh daftar gambar. Cache baru otomatis memulai dari awal.
      if (await cache.match(marker)) return;
      var semuaSiap = true;
      for (var i = 0; i < GAMBAR.length; i += 4) {
        var batch = GAMBAR.slice(i, i + 4);
        var hasilBatch = await Promise.all(batch.map(async function (path) {
          var url = new URL(path, self.registration.scope).href;
          if (await cache.match(url)) return true;
          await warm(cache, url);
          return !!(await cache.match(url));
        }));
        if (hasilBatch.some(function (siap) { return !siap; })) semuaSiap = false;
      }
      // Jangan tandai selesai bila ada gambar yang gagal diunduh; permintaan
      // berikutnya boleh mencoba ulang gambar yang belum berhasil di-cache.
      if (semuaSiap) await cache.put(marker, new Response('ok', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      }));
    } finally {
      warmingImages = false;
    }
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { if (self.registration.navigationPreload) return self.registration.navigationPreload.disable(); })
      .then(function () { return self.clients.claim(); })
  );
});

var CEK = {}, CEK_MS = 10 * 60 * 1000;
function revalidate(event, cache, req, same, force) {
  var k = req.url, n = Date.now();
  if (!force && CEK[k] && n - CEK[k] < CEK_MS) return;
  if (force && CEK[k] && n - CEK[k] < 30000) return;
  CEK[k] = n;
  event.waitUntil((same ? fetch(new Request(req, { cache: 'no-cache' })) : fetch(req)).then(function (r) { if (r && (r.ok || r.type === 'opaque')) return cache.put(req, r.clone()); }).catch(function () {}));
}
function fresh(req) {                       // ambil dari jaringan, lewati cache HTTP browser
  return fetch(new Request(req, { cache: 'no-store' }));
}
function withTimeout(p, ms) {
  return new Promise(function (ok, no) {
    var t = setTimeout(function () { no(new Error('timeout')); }, ms);
    p.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); no(e); });
  });
}
function offlineResp(req) {
  if (req.destination === 'image') return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>', { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
  return new Response('', { status: 503, statusText: 'Offline' });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var same = url.origin === self.location.origin;
  if (!same && CDN_OK.indexOf(url.hostname) < 0) return;      // API (Supabase dll.) tidak disentuh
  if (req.headers.has('range')) return;

  event.respondWith((async function () {
    var cache = await caches.open(CACHE);

    // 1) CDN & berkas statis: cache dulu; periksa pembaruan di belakang layar paling sering 1x / 10 menit per berkas
    if (!same || (STATIC_RE.test(url.pathname) && req.mode !== 'navigate')) {
      var hit = await cache.match(req, same ? { ignoreSearch: true } : undefined);
      if (hit) { revalidate(event, cache, req, same); return hit; }
      var r1 = await (same ? fetch(req) : fetch(req)).then(function (r) { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }).catch(function () { return null; });
      return r1 || offlineResp(req);
    }

    // 2) Halaman HTML: tampilkan dari cache SEKETIKA, perbarui di belakang layar (stale-while-revalidate).
    //    Tanpa cache (kunjungan pertama): jaringan dengan batas waktu, lalu offline.html
    var cached = await cache.match(req, { ignoreSearch: true });
    if (cached) { revalidate(event, cache, req, true, true); return cached; }
    try {
      var r = await withTimeout(fetch(req), NAV_TIMEOUT);
      if (r && r.ok) cache.put(req, r.clone());
      return r;
    } catch (err) {
      if (req.mode === 'navigate') {
        var off = await cache.match('./offline.html');
        if (off) return off;
      }
      return offlineResp(req);
    }
  })());
});

/* ---- Cek pembaruan atas permintaan halaman ---- */
async function sha(buf) {
  var d = await crypto.subtle.digest('SHA-1', buf);
  return Array.prototype.map.call(new Uint8Array(d), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}
var cekUpdateAktif = null;
function cekUpdate() {
  // Beberapa tab/halaman dapat meminta pemeriksaan pada waktu berdekatan.
  // Gunakan satu pemeriksaan bersama agar tidak mengunduh dan membandingkan index berulang.
  if (cekUpdateAktif) return cekUpdateAktif;
  cekUpdateAktif = (async function () {
    var cache = await caches.open(CACHE);
    var key = new Request(new URL('./index.html', self.registration.scope).href);
    var r = await fresh(key); if (!r.ok) return false;
    var baru = await r.clone().arrayBuffer();
    var lama = await cache.match(key);
    var beda = true;
    if (lama) beda = (await sha(await lama.arrayBuffer())) !== (await sha(baru));
    await cache.put(key, r);
    if (beda && lama) {                                      // versi baru: segarkan semua berkas inti agar siap saat muat ulang
      await Promise.all(CORE.map(function (u) { return warm(cache, u); }));
    }
    return beda && !!lama;
  })();
  return cekUpdateAktif.then(function (hasil) {
    cekUpdateAktif = null;
    return hasil;
  }, function (err) {
    cekUpdateAktif = null;
    throw err;
  });
}
self.addEventListener('message', function (event) {
  var m = event.data || {};
  if (m.type === 'SKIP_WAITING') self.skipWaiting();
  if (m.type === 'CHECK') {
    event.waitUntil(cekUpdate().then(function (beda) {
      if (!beda) return;
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (l) {
        l.forEach(function (c) { c.postMessage({ type: 'APP_UPDATED' }); });
      });
    }).catch(function () {}));
  }
});

/* ---- Push: judul & pesan dari server (judul bawaan "GoPay") ---- */
self.addEventListener('push', function (event) {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (l) {
    // Aplikasi sedang terbuka & terlihat: bunyikan mynotification.mp3 dari halaman (notifikasi sistem dibisukan agar tidak dobel).
    // Aplikasi tertutup: web push tidak bisa memakai suara kustom, jadi memakai suara notifikasi bawaan perangkat.
    var tampak = l.filter(function (c) { return c.visibilityState === 'visible'; });
    tampak.forEach(function (c) { c.postMessage({ type: 'PUSH_SOUND', id: d.id == null ? null : d.id, title: d.title || 'GoPay', body: d.body || '' }); });
    return self.registration.showNotification(d.title || 'GoPay', {
      body: d.body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/badge-96.png',
      tag: d.id ? 'notif-' + d.id : undefined,
      silent: tampak.length > 0,
      vibrate: [200, 100, 200],
      data: { url: './' }
    });
  }));
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (l) {
    for (var i = 0; i < l.length; i++) if ('focus' in l[i]) return l[i].focus();
    return self.clients.openWindow(url);
  }));
});
