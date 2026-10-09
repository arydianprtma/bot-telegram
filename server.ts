import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { formatDonationMessage, sendTelegramNotification } from "./telegram.js";
import type { DonationData } from "./telegram.js";
import { startTelegramPolling } from "./bot.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging untuk setiap request masuk
app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString("id-ID")}] ${req.method} ${req.url}`);
  next();
});

// Route Beranda & Health Check
app.get(["/", "/health"], (_req: Request, res: Response) => {
  res.json({
    status: "online",
    message: "Server Webhook Saweria ke Telegram aktif dan siap menerima data!",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Handler utama untuk webhook donasi Saweria
 */
async function handleSaweriaWebhook(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body || {};
    console.log("--> Data Payload Webhook Diterima:", JSON.stringify(body, null, 2));

    // Mengambil data donasi dengan toleransi variasi field dari Saweria
    const donator =
      body.donator ||
      body.donator_name ||
      body.name ||
      body.from ||
      "Anonim";

    const rawAmount = body.amount ?? body.amount_raw ?? 0;
    const amount = typeof rawAmount === "number" ? rawAmount : parseInt(String(rawAmount), 10) || 0;

    const message = body.message || body.msg || body.note || "-";

    const donation: DonationData = {
      donator: String(donator),
      amount,
      message: String(message),
      media: body.media,
    };

    // Format dan kirim notifikasi ke Telegram (mencatat log pesan untuk fitur /hapus log)
    const teleText = formatDonationMessage(donation);
    await sendTelegramNotification(teleText, {
      donator: donation.donator,
      amount: donation.amount,
    });

    console.log(`[SUCCESS] Notifikasi donasi dari '${donator}' senilai Rp ${amount.toLocaleString("id-ID")} berhasil dikirim ke Telegram.`);

    res.status(200).json({
      ok: true,
      message: "Notifikasi berhasil diteruskan ke Telegram",
    });
  } catch (error: any) {
    console.error("[ERROR] Gagal memproses webhook Saweria:", error?.message || error);
    res.status(500).json({
      ok: false,
      error: error?.message || "Internal Server Error",
    });
  }
}

// Endpoint webhook Saweria
app.post("/webhook/saweria", handleSaweriaWebhook);
app.post("/webhook", handleSaweriaWebhook);
app.post("/saweria", handleSaweriaWebhook);

// Endpoint uji coba donasi
app.all("/test-donation", async (req: Request, res: Response) => {
  const query = req.query as Record<string, string>;
  const body = (req.body || {}) as Record<string, any>;

  const testData: DonationData = {
    donator: body.donator || query.donator || "Budi Dermawan (Test)",
    amount: parseInt(body.amount || query.amount || "50000", 10),
    message: body.message || query.message || "Semangat terus kontennya bang! 🔥",
  };

  try {
    const teleText = formatDonationMessage(testData);
    await sendTelegramNotification(teleText, {
      donator: testData.donator,
      amount: testData.amount,
    });

    res.json({
      ok: true,
      message: "Uji coba donasi berhasil dikirim ke bot Telegram!",
      data: testData,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message || "Gagal mengirim tes",
    });
  }
});

app.listen(PORT, () => {
  console.log("==================================================");
  console.log(`🚀 Server Webhook Saweria berjalan di port ${PORT}`);
  console.log(`📡 URL Lokal: http://localhost:${PORT}`);
  console.log(`🔗 Endpoint Webhook: http://localhost:${PORT}/webhook/saweria`);
  console.log(`🧪 Tes via Browser: http://localhost:${PORT}/test-donation`);
  console.log("==================================================");

  // Menjalankan listener perintah Telegram (seperti /hapus log)
  startTelegramPolling();
});
