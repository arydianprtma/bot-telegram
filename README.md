# Bot Telegram Notifikasi Donasi Saweria 🚀

Bot ini menerima webhook dari [Saweria](https://saweria.co) setiap kali ada donasi masuk, lalu otomatis mengirimkan notifikasi rincian donatur dan pesan donasi ke bot/grup/channel Telegram Anda.

---

## 🛠️ Persiapan & Konfigurasi

Pastikan file `.env` sudah terisi:
```env
TELEGRAM_BOT_TOKEN=8891137405:AAEuFeF9WFTmREmqac1Doec0fAVL3crdzCE
TELEGRAM_CHAT_ID=6584433452
PORT=5000
```

---

## 🚀 Cara Menjalankan

### Langkah 1: Jalankan Server Bot
Buka terminal pertama di folder project ini:
```bash
npm run dev
```
Server akan aktif di `http://localhost:5000`.

---

### Langkah 2: Buat URL Publik (Tunneling)
Karena Saweria memerlukan URL publik (HTTPS) untuk mengirimkan data ke komputer Anda:

Buka terminal kedua dan jalankan:
```bash
npm run tunnel
```
*(Menggunakan Cloudflared bawaan yang sudah terinstal di komputer Anda)*

Anda akan mendapatkan URL publik seperti:
```text
https://random-subdomain.trycloudflare.com
```

> **Alternatif Ngrok:**
> Jika ingin menggunakan ngrok, Anda bisa menjalankan:
> ```bash
> npm run tunnel:ngrok
> ```

---

### Langkah 3: Sambungkan ke Dashboard Saweria
1. Buka dan login ke [saweria.co](https://saweria.co).
2. Buka menu **Integrasi** (Integrations) > **Webhook**.
3. Di kolom **Webhook URL**, masukkan URL publik Anda ditambah `/webhook/saweria`, contoh:
   ```text
   https://random-subdomain.trycloudflare.com/webhook/saweria
   ```
4. Simpan pengaturan.

---

### Langkah 4: Uji Coba

1. **Uji Coba Langsung di Browser / Lokal:**
   Buka URL berikut di browser Anda:
   ```text
   http://localhost:5000/test-donation
   ```
   Atau dengan data kustom:
   ```text
   http://localhost:5000/test-donation?donator=Ahmad&amount=50000&message=Semangat+bang!
   ```
   Pesan donasi langsung masuk ke Telegram Anda!

2. **Uji Coba dari Saweria:**
   Di menu Webhook dashboard Saweria, tekan tombol **"Kirim Uji Coba" / "Test Webhook"**. Notifikasi akan otomatis terkirim ke Telegram.

---

## 🤖 Perintah Bot Telegram

Bot ini sekarang dilengkapi dengan pendengar perintah langsung dari Telegram:

- `/hapus log` : **Menghapus seluruh pesan notifikasi donasi** yang telah dikirim ke chat Telegram Anda, sekaligus membersihkan pesan perintah tersebut agar chat tetap bersih dan rapi.
- `/status` : Menampilkan status bot dan jumlah notifikasi donasi yang saat ini tersimpan di chat.
- `/help` : Menampilkan panduan bantuan perintah.

---

## 📦 Perintah Tambahan

- `npm run dev` : Menjalankan server webhook dan listener perintah Telegram.
- `npm run tunnel` : Menjalankan Cloudflared tunnel untuk mendapatkan URL publik.
- `npm run tunnel:ngrok` : Menjalankan Ngrok tunnel (alternatif).
- `npm run test:tele` : Menguji koneksi bot Telegram.
- `npm run typecheck` : Memeriksa tipe TypeScript tanpa error.
