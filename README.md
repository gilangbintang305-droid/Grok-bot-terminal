# Grok Bot (paper trading, Solana)

Aplikasi Android (WebView) berisi bot enam agen: Scout, Filter, Analyst, Executor, Risk, Logger.
Mode **paper**: data pasar asli dari DexScreener + cek mint/freeze lewat RPC Solana, tapi tidak ada uang asli.

## Cara dapat APK
1. Buat repo baru di GitHub, upload semua isi folder ini (termasuk folder `.github`).
2. Buka tab **Actions** → workflow **Build APK** (jalan otomatis saat push, atau klik *Run workflow*).
3. Setelah hijau, buka run-nya → bagian **Artifacts** → unduh `grok-bot-apk` → ekstrak → pasang `app-debug.apk`.

## Catatan
- Filter yang belum dicek (butuh data berbayar/RPC khusus): LP burned, top holder, dev, bundled launch.
- Fee + slippage disimulasikan 1% per sisi. Hasil simulasi bukan jaminan hasil nyata.
- Bot hanya berjalan saat aplikasi terbuka (layar dijaga tetap menyala).
