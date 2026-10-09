import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { formatDonationMessage, sendTelegramNotification } from "./telegram.js";
import type { DonationData } from "./telegram.js";
import { startTelegramPolling, handleTelegramMessage, registerBotCommands } from "./bot.js";
import type { TelegramUpdate } from "./bot.js";
import { recordDonationStats } from "./stats.js";

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
app.get(["/", "/health", "/api"], (_req: Request, res: Response) => {
  res.json({
    status: "online",
    platform: process.env.VERCEL ? "Vercel Serverless" : "Local/Node",
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

    // Saweria mengirimkan:
    // - amount_raw : nominal murni donasi dari donatur (misal 5.000)
    // - cut        : potongan biaya layanan platform (misal 250)
    // - amount     : total pembayaran payment gateway termasuk PPN/biaya QRIS (misal 5.036)
    const gross = body.amount_raw ?? body.etc?.amount_to_display ?? body.amount ?? 0;
    const amount = typeof gross === "number" ? gross : parseInt(String(gross), 10) || 0;

    let cut: number | undefined = undefined;
    if (typeof body.cut === "number") {
      cut = body.cut;
    } else if (body.cut !== undefined && body.cut !== null) {
      cut = parseInt(String(body.cut), 10) || undefined;
    }

    // Jika cut tidak dikirim oleh webhook, gunakan kalkulasi standar 5% Saweria
    if (cut === undefined && amount > 0) {
      cut = Math.round(amount * 0.05);
    }

    const netAmount = Math.max(0, amount - (cut || 0));

    // Catat ke total akumulasi saldo
    const stats = recordDonationStats(amount, netAmount);

    const message = body.message || body.msg || body.note || "-";

    const donation: DonationData = {
      donator: String(donator),
      amount,
      cut,
      netAmount,
      totalAccumulated: stats.totalNet,
      donationCount: stats.donationCount,
      message: String(message),
      media: body.media,
    };

    // Format dan kirim notifikasi ke Telegram (mencatat log pesan untuk fitur /hapus_log)
    const teleText = formatDonationMessage(donation);
    await sendTelegramNotification(teleText, {
      donator: donation.donator,
      amount: donation.amount,
    });

    console.log(
      `[SUCCESS] Donasi '${donator}' senilai Rp ${amount.toLocaleString("id-ID")} (bersih: Rp ${netAmount.toLocaleString("id-ID")}, total: Rp ${stats.totalNet.toLocaleString("id-ID")}) berhasil dikirim.`
    );

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
app.post(["/webhook/saweria", "//webhook/saweria", "/webhook", "/saweria", "/api/saweria"], handleSaweriaWebhook);

/**
 * Endpoint Webhook Telegram (Untuk Vercel / Cloud Serverless)
 */
async function handleTelegramWebhook(req: Request, res: Response): Promise<void> {
  try {
    const update = req.body as TelegramUpdate;
    if (update?.message) {
      await handleTelegramMessage(update.message);
    }
    res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("[ERROR] Gagal memproses webhook Telegram:", error);
    res.status(200).json({ ok: false, error: error?.message });
  }
}

app.post(["/api/telegram", "/telegram/webhook"], handleTelegramWebhook);

/**
 * Route bantuan untuk menghubungkan webhook Telegram sekali klik di browser Vercel
 */
app.get("/setup-webhook", async (req: Request, res: Response) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    res.status(500).send("TELEGRAM_BOT_TOKEN belum diatur!");
    return;
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const webhookUrl = `${proto}://${host}/api/telegram`;

  try {
    // Daftarkan webhook Telegram
    const whRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const whData = await whRes.json();

    // Daftarkan menu tombol perintah [≡]
    await registerBotCommands();

    res.json({
      success: true,
      message: "Webhook Telegram dan Menu Perintah berhasil didaftarkan!",
      webhookUrl,
      telegramResponse: whData,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Endpoint uji coba donasi
app.all("/test-donation", async (req: Request, res: Response) => {
  const query = req.query as Record<string, string>;
  const body = (req.body || {}) as Record<string, any>;

  const nominal = parseInt(body.amount || query.amount || "50000", 10);
  const cut = Math.round(nominal * 0.05);
  const net = nominal - cut;
  const stats = recordDonationStats(nominal, net);

  const testData: DonationData = {
    donator: body.donator || query.donator || "Budi Dermawan (Test)",
    amount: nominal,
    cut,
    netAmount: net,
    totalAccumulated: stats.totalNet,
    donationCount: stats.donationCount,
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

// Hanya jalankan listener lokal jika TIDAK berada di lingkungan Vercel serverless
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log("==================================================");
    console.log(`🚀 Server Webhook Saweria berjalan di port ${PORT}`);
    console.log(`📡 URL Lokal: http://localhost:${PORT}`);
    console.log(`🔗 Endpoint Webhook: http://localhost:${PORT}/webhook/saweria`);
    console.log(`🧪 Tes via Browser: http://localhost:${PORT}/test-donation`);
    console.log("==================================================");

    // Menjalankan listener perintah Telegram lokal
    startTelegramPolling();
  });
}

export default app;
