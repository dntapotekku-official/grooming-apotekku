# Checklist Grooming 57 Titik — SSC ApotekKU

Aplikasi checklist grooming harian (audit CEO/COO) dengan penyimpanan Firebase Firestore.

- **Aplikasi live:** https://groming-apotekku.web.app
- **File aplikasi:** `public/index.html`
- **Deploy:** otomatis via GitHub Actions setiap ada perubahan di branch `main` (lihat `.github/workflows/deploy.yml`). Perlu secret `FIREBASE_SERVICE_ACCOUNT` (kunci service account Firebase) di Settings → Secrets and variables → Actions.

## Cara update aplikasi
1. Ganti isi `public/index.html` dengan versi terbaru (upload/commit ke branch `main`).
2. GitHub Actions akan deploy otomatis (± 1 menit). Data checklist aman — tersimpan di Firestore, bukan di file ini.
