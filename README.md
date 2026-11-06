# Checklist Grooming 57 Titik — SSC ApotekKU

Aplikasi checklist grooming harian (audit CEO/COO) dengan penyimpanan Firebase Firestore.

- **Aplikasi live:** https://groming-apotekku.web.app
- **File aplikasi:** `public/index.html`
- **Deploy:** otomatis via GitHub Actions setiap ada perubahan di branch `main` (lihat `.github/workflows/deploy.yml`). Perlu secret `FIREBASE_SERVICE_ACCOUNT` (kunci service account Firebase) di Settings → Secrets and variables → Actions.

## Cara update aplikasi
1. Ganti isi `public/index.html` dengan versi terbaru (upload/commit ke branch `main`).
2. GitHub Actions akan deploy otomatis (± 1 menit). Data checklist aman — tersimpan di Firestore, bukan di file ini.

<!-- deploy pertama: dipicu setelah secret FIREBASE_SERVICE_ACCOUNT terpasang -->

## Pengaturan Data
- **Data Karyawan SSC**: kelola data karyawan seperti sebelumnya.
- **Item Pemeriksaan**: tambah, edit, nonaktifkan, dan aktifkan kembali item. Item tambahan berlaku untuk semua hari dan jenis kelamin; item bawaan tetap mengikuti jadwal dan jenis kelamin kecuali keterangannya diganti.
- Master item disimpan di dokumen Firestore `grooming/meta-items`, terpisah dari hasil pemeriksaan. Pembaruan menggunakan transaksi agar perubahan item berbeda dari beberapa perangkat tetap tersimpan.
- Pemeriksaan baru menyimpan salinan nama, keterangan, dan ketentuan item. Pemeriksaan lama tetap mengikuti ID item yang sudah tersimpan, tanpa menambahkan item baru secara otomatis. Dashboard, rekap, dan ekspor memakai nama dari riwayat pemeriksaan.

## Pemeriksaan lokal
Jalankan `node tests/checklist.test.cjs` untuk memeriksa aturan harian, navigasi pengaturan, kompatibilitas riwayat lama, salinan item, total pelanggaran, dan penyimpanan master terpisah dengan mock Firestore. Pengujian ini tidak mengakses database produksi.
