# GoPay PWA — siap deploy ke Vercel

Situs statis (tanpa build). Halaman: `index.html` (Beranda), `akun.html`, `masuk.html`, `onboarding.html`, `pin.html`, `qris.html` (alur scan QRIS).
Semua CSS/JS/gambar halaman sudah tertanam di HTML, jadi hanya perlu folder `icons/` dan berkas PWA berikut.

| Berkas | Fungsi |
|---|---|
| `manifest.webmanifest` | Nama, ikon, `background_color` splash Android (`#00aed6`) |
| `icons/splash/` | 13 gambar splash iOS (`apple-touch-startup-image`, sudah ditautkan di `<head>` tiap halaman) |
| `icons/` | Ikon aplikasi, maskable, monochrome, apple-touch-icon, favicon, badge |
| `sw.js` | Service worker (cache + offline). Daftar halaman di `CORE`; **tambahkan halaman baru ke sana** |
| `js/install.js` + `css/install.css` | Popup "Pasang GoPay di perangkatmu" di awal halaman (`index.html`, `akun.html`). Android/desktop: tombol Pasang memanggil dialog instal browser. iOS: langkah Bagikan > Tambah ke Layar Utama. **Tidak pernah muncul** bila dibuka dari app terpasang (display-mode standalone, `navigator.standalone`, TWA) |
| `push.js` | `aktifkanNotifikasi()`: minta izin, subscribe web push (VAPID), simpan perangkat ke Supabase lewat RPC `daftar_perangkat` |
| `js/notif.js` | Banner + suara realtime saat app terbuka (INSERT `history` dengan `gx_id`), dan tawaran "Aktifkan notifikasi" |
| `js/config.js` | URL + anon key Supabase (dipakai `notif.js`) |
| `mynotification.mp3` | Suara notifikasi (dibunyikan `update.js` saat app terbuka) |
| `update.js` | Mendaftarkan `sw.js` + toast pembaruan (dipakai `index.html`; halaman lain sudah menanamnya) |
| Rincian transaksi (di `index.html`) | Overlay `#gxr`: ketuk list **Layanan Via GoPay** (`history.jenis = bayar_teman`) di tab Riwayat membuka halaman rincian. Logo dari `layanan_history.icon_data`; rincian (status, ditambahkan ke, waktu, tanggal, ID transaksi, jumlah, total) dari tabel `gx` lewat `history.gx_id`. Ketuk list **Layanan Top Up** (`history.jenis = topup`, semua Via: bank, gerai, Mitra GoPay, kustom) memakai overlay yang sama dengan varian `#gxr.tu`: judul "GoPay Top Up" (Via tidak ditampilkan), tombol Chat dengan CS, rincian langsung terbuka, baris **Order ID** (`gx.order_id`) di bawah ID transaksi, dan panel bawah hanya Bagi bukti bayar. Jenis lain tetap tidak bisa diketuk; tambahkan jenis di `HIST_CFG.rincian`. Tombol Kembali/back perangkat menutup halaman rincian |
| `qris.html` | Alur QRIS: scan kamera / Upload QR (parser QRIS EMV: nama, kota, kode pos, Merchant PAN, terminal) -> Isi nominal -> Review pembayaran (animasi loading, promo, rincian) -> PIN -> simpan ke tabel `gcx` lewat RPC `input_gcx` (saldo `g` berkurang). Dibuka dari tombol QRIS di bar bawah beranda. Uji tanpa QR: `qris.html?demo=1`. Aset hasil ekstraksi screenshot di `assets/qris/` dan font di `assets/fonts/` |
| `offline.html` | Cadangan saat offline dan halaman belum ter-cache |
| `vercel.json` | Header cache untuk `sw.js`, manifest, ikon |

## Deploy
1. Push folder ini ke GitHub.
2. Vercel > Add New > Project > pilih repo. Framework Preset: **Other**. Build Command dan Output Directory dikosongkan (root).
3. Deploy. Wajib HTTPS (otomatis di Vercel) agar service worker dan install PWA jalan.

Uji lokal: `npx serve .`

## Popup pasang aplikasi
- Muncul ~1,2 dtk setelah halaman terbuka (kunjungan pertama) atau ~0,4 dtk (berikutnya).
- "Nanti saja" / tutup = disembunyikan 3 hari (`SNOOZE_MS` di `js/install.js`). Terpasang = tidak muncul lagi.
- Uji ulang di konsol: `GPInstall.reset()` lalu muat ulang.
- Tidak muncul di tab browser bila Chrome belum menganggap app layak-pasang (butuh HTTPS + manifest + service worker, sudah ada) atau sudah terpasang.

## Notifikasi (hanya di `index.html`)
- Urutan script: supabase-js -> `js/config.js` -> `push.js` -> `js/notif.js` -> `update.js` -> `js/install.js`.
- Banner "Aktifkan notifikasi" muncul ~2,5 dtk setelah halaman terbuka, **menunggu popup Pasang selesai** agar tidak bertumpuk. "Nanti" = disembunyikan 3 hari (`SKIP_MS`). Tidak muncul bila izin sudah diberikan/ditolak atau browser tanpa `PushManager` (mis. iPhone di tab Safari: push iOS hanya jalan setelah app ditambahkan ke Layar Utama).
- App terbuka: banner + bunyi dari Supabase Realtime (id yang sama dari push tidak dobel). App tertutup: notifikasi sistem dari `sw.js`.
- `HALAMAN_RIWAYAT` di `js/notif.js` kosong (repo ini belum punya `riwayat.html`); isi bila halaman itu dibuat agar ketuk banner membukanya.
- **Butuh sisi server di proyek Supabase Anda** (tidak ada di repo ini): tabel `history`, tabel `push_perangkat`, RPC `daftar_perangkat`, trigger `history_notifikasi_push`, dan edge function `kirim-push` (+ kunci VAPID privat). Tanpa itu, banner realtime tetap jalan bila `history` ada, tetapi web push tidak terkirim.

## Catatan
- Kalau mengubah halaman, naikkan `CACHE` di `sw.js` (mis. `app-runtime-7`) bila ingin memaksa semua pengguna mengambil ulang.
- Supabase (URL + anon key) tertanam di `akun/masuk/onboarding/pin.html` (blok `js/config.js`).
