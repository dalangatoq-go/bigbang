/* Pendaftaran notifikasi push — muat setelah library Supabase, mis. <script src="push.js"></script>
   Panggil aktifkanNotifikasi() dari KLIK tombol (izin notifikasi wajib dari aksi pengguna). */
(function () {
  var SB_URL = 'https://erspkduznzrntfzchdbk.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyc3BrZHV6bnpybnRmemNoZGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MTIyNDYsImV4cCI6MjExMDM4ODI0Nn0.L3nQicgSXr8j_ctjRC8RxPZLSpHj71tLXljfmA3vy6I'; // anon key publik, sama seperti yang dipakai halaman lain
  var VAPID_PUBLIC = 'BEQJYDGKYGWcZfCyEhLO8-ib3MB9Kc6GVh8L0OEb8OqjvJCkNFdJTji6bLfQClQl0FSOyRggFoPfnIehVKSFjYU';

  if (!window.supabase) {   // library Supabase gagal dimuat (mis. CDN diblokir): jangan merusak halaman
    window.aktifkanNotifikasi = async function () { return { ok: false, alasan: 'Library Supabase belum termuat' }; };
    return;
  }
  var sb = window.__sb || (window.__sb = window.supabase.createClient(SB_URL, SB_KEY, window.GP_CFG && window.GP_CFG.opts));

  function b64ToBytes(s) {
    var p = '='.repeat((4 - s.length % 4) % 4);
    var raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function daftarkan(sub) {
    var j = sub.toJSON();
    var r = await sb.rpc('daftar_perangkat', {
      p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent
    });
    if (r.error) throw r.error;
  }

  window.aktifkanNotifikasi = async function () {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return { ok: false, alasan: 'Perangkat/browser belum mendukung notifikasi push' };
    var izin = await Notification.requestPermission();
    if (izin !== 'granted') return { ok: false, alasan: 'Izin notifikasi ditolak' };
    var reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
    await daftarkan(sub);
    return { ok: true };
  };

  // Sinkron ulang otomatis tiap aplikasi dibuka (jika izin sudah diberikan)
  function sinkron() {
    if (!('serviceWorker' in navigator) || !window.Notification || Notification.permission !== 'granted') return;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      return navigator.serviceWorker.ready.then(function () { return reg.pushManager.getSubscription(); });
    }).then(function (sub) {
      if (sub) return daftarkan(sub);
      // izin masih 'granted' tetapi langganan hilang (data situs dibersihkan, Chrome/Vivo membatalkan, kedaluwarsa): buat ulang tanpa gestur
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
      }).then(daftarkan);
    }).catch(function () {});
  }
  sinkron();
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'RESUBSCRIBE') sinkron(); });
})();
