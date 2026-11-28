# Audit alur Profil › Pengaturan › Keamanan

Referensi: 4 screenshot 720×1465 (@2x = kanvas 360 px, sama dengan `#ui` di index.html).
Semua ukuran di bawah = piksel referensi ÷ 2.

## Temuan pada versi lama
Halaman `#pgn` / `#kmn` sudah ada di index.html, tetapi tidak identik:

| Elemen | Referensi | Versi lama |
|---|---|---|
| Judul baris | 13 px bold | 15.5 px |
| Deskripsi baris | 11.2 px, warna #c6ccd6 | 13 px, #aab1ba |
| Judul section (Akun, Pembayaran…) | 14.5 px | 17 px |
| Judul header "Pengaturan" | 16.5 px | 19 px |
| Tinggi baris | 67 px (1 baris) / 83.5 px (2 baris) | 70 / 88 px |
| Radius kartu | 18 px | 24 px |
| Tile ikon | 39 px, radius 10, warna #141517 | 40 px + border |
| Garis pemisah | mulai x=64 dari tepi kartu, #1f2326 | x=67 |
| Bar progres | inset 30.5 px kiri-kanan, #ba0100 → #ba7c03 | selebar kartu, #bb3100 → #bb7400 |
| Chip "+25%" | 72×34 px, 11.5 px bold, panah kecil 5×8 | 34 px tinggi, 14.5 px |
| Saklar Google | 44×26, knob 22, ring kecil di sisi kanan saat off | 46×26 tanpa ring |
| Ikon | gambar asli dari screenshot | SVG gambar ulang (bentuk berbeda) |

## Yang dilakukan
1. **Ekstraksi aset** dari screenshot → `assets/icons/` (PNG transparan berwarna final, 2x)
   dan `assets/icons-mask/` (mask putih). 16 ikon: keamanan, gopay-plus, layanan-warga,
   app-terhubung, akses-cepat, aksesibilitas, bahasa, hapus-akun (merah), lokasi & step-gopay-plus
   (abu redup #606263), notifikasi, pin, google, perangkat, jaminan, banner-perisai.
   Hero perisai oranye = `assets/hero-keamanan.webp` (sudah tertanam di index.html; selisih rata-rata
   1.4/255 terhadap crop referensi).
2. **CSS `#sub-css` ditulis ulang** dengan angka hasil ukur (font diukur dengan mencocokkan lebar teks
   ke DM Sans Emb yang sudah tertanam di file).
3. **Markup `#pgn` dan `#kmn` diganti**; ID/atribut yang dipakai JS (`#kmn-sum`, `#kmn-fill`, `#kmn-bar`,
   `#kmn-toggle`, `#kmn-steps`, `#kmn-lokasi`, `#kmn-lokasi-chip`, `data-go`, `data-back`, `data-na`)
   dipertahankan, jadi alur dan JS lama tetap jalan tanpa diubah.

## Alur (tidak berubah)
Profil › baris **Pengaturan** → `#pgn` › **Keamanan** → `#kmn`.
Tombol "Perkuat perlindunganmu" di Profil langsung ke `#kmn`. Back / tombol back perangkat menutup layar teratas.
"Izin lokasi" meminta geolocation sungguhan dan menaikkan progres 2/4 → 3/4.

## Batasan
- Verifikasi dilakukan lewat pengukuran piksel dan perhitungan tata letak, **bukan** perbandingan hasil render
  (tidak ada browser di lingkungan ini). Mohon cek di HP dan bandingkan dengan `reference/`.
- Font aslinya tidak diketahui; dipakai DM Sans Emb (sudah ada di file) dengan ukuran yang disesuaikan ke lebar teks.
- Tekstur kecil seperti bayangan kartu dan warna tombol banner diperkirakan dari sampel piksel.
