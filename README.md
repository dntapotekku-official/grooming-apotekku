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
- **Item Pemeriksaan**: tambah, edit, dan hapus item. Item yang dihapus hilang dari daftar pengaturan dan pemeriksaan baru; penanda penghapusan disimpan agar item bawaan tidak muncul kembali dan riwayat tetap utuh. Setiap item memiliki pilihan **Hari Berlaku** dan keterangan / ketentuan khusus per hari. Secara bawaan, Nametag hanya Rabu dan item lain setiap hari. Aturan khusus per hari berlaku bagi semua jenis kelamin; isian kosong mengikuti aturan umum atau bawaan. Jadwal dan aturan baru hanya diterapkan pada pemeriksaan baru. Banner harian mengikuti item pemeriksaan yang ditampilkan.
- Master item disimpan di dokumen Firestore `grooming/meta-items`, terpisah dari hasil pemeriksaan. Pembaruan menggunakan transaksi dan versi per item untuk mencegah form usang menimpa perubahan atau mengaktifkan kembali item yang sudah dihapus.
- Pemeriksaan baru menyimpan salinan nama, keterangan, dan ketentuan item. Pemeriksaan lama tetap mengikuti ID item yang sudah tersimpan, tanpa menambahkan item baru secara otomatis. Dashboard, rekap, dan ekspor memakai nama dari riwayat pemeriksaan.

## Pemeriksaan lokal
Jalankan `node --test tests/checklist.test.cjs` untuk memeriksa aturan harian, navigasi pengaturan, kompatibilitas riwayat lama, salinan item, total pelanggaran, dan penyimpanan master terpisah dengan mock Firestore. Pengujian ini tidak mengakses database produksi.

- Status pemeriksaan menjadi **Tersimpan** setelah penyimpanan dikonfirmasi. Kegagalan mempertahankan draft dan hasil lama. Transaksi per pemeriksaan mempertahankan data karyawan lain dan menolak konflik pemeriksaan yang sama.
- Dashboard, rekap, dan Excel memisahkan item berdasarkan ID serta nama historis. Nama sama diberi pembeda keterangan / nomor item.
- Jika semua item dihapus, checklist menampilkan petunjuk dan tombol Simpan dinonaktifkan; riwayat lama tetap dapat dibuka.
- GitHub Actions menjalankan pengujian regresi sebelum deploy Hosting.
