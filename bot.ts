import "dotenv/config";
import {
  deleteAllDonationLogs,
  deleteTelegramMessage,
  sendTextMessage,
  formatRupiah,
} from "./telegram.js";
import { getLogs } from "./logger.js";
import { getStats, resetStats } from "./stats.js";

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      first_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    text?: string;
    date: number;
  };
}

let isPolling = false;
let lastUpdateId = 0;

/**
 * Mendaftarkan tombol menu perintah [≡] resmi ke Telegram API
 */
export async function registerBotCommands(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "hapus_log", description: "Hapus semua notifikasi log donasi" },
          { command: "status", description: "Cek total saldo & status bot" },
          { command: "reset_total", description: "Reset hitungan total saldo donasi" },
          { command: "help", description: "Bantuan & panduan perintah bot" },
        ],
      }),
    });

    await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: { type: "commands" },
      }),
    });

    console.log("📋 Menu tombol perintah Telegram berhasil didaftarkan!");
  } catch (error) {
    console.error("[BOT] Gagal mendaftarkan menu perintah ke Telegram:", error);
  }
}

/**
 * Memproses pesan masuk dari Telegram (bisa dipanggil via Polling maupun Webhook)
 */
export async function handleTelegramMessage(message: NonNullable<TelegramUpdate["message"]>): Promise<void> {
  const text = (message.text || "").trim();
  const chatId = message.chat.id;
  const configuredChatId = process.env.TELEGRAM_CHAT_ID;

  // Hanya layani chat yang sesuai konfigurasi demi keamanan
  if (configuredChatId && String(chatId) !== String(configuredChatId)) {
    console.log(`[BOT] Pesan diabaikan dari chat tak dikenal: ${chatId}`);
    return;
  }

  // Normalisasi perintah (menghilangkan @username jika dipanggil di grup)
  const lowerText = text.toLowerCase();
  const baseCmd = lowerText.split("@")[0]?.trim() || "";

  // Handler perintah /hapus_log, /hapus log, /hapus, /clear
  if (
    baseCmd === "/hapus_log" ||
    baseCmd === "/hapuslog" ||
    lowerText === "/hapus log" ||
    baseCmd === "/hapus" ||
    baseCmd === "/clear" ||
    baseCmd === "/clearlog"
  ) {
    console.log(`[BOT] Menerima perintah hapus log dari chat ${chatId}`);

    // Hapus juga pesan perintah yang dikirim pengguna agar chat tetap bersih
    await deleteTelegramMessage(chatId, message.message_id);

    const deleted = await deleteAllDonationLogs(chatId, message.message_id);

    if (deleted === 0) {
      const infoMsgId = await sendTextMessage(
        chatId,
        "ℹ️ <i>Tidak ada riwayat log donasi yang tersimpan untuk dihapus.</i>"
      );
      if (infoMsgId) {
        setTimeout(() => deleteTelegramMessage(chatId, infoMsgId), 4000);
      }
      return;
    }

    const successMsgId = await sendTextMessage(
      chatId,
      `🗑️ <b>Berhasil menghapus ${deleted} pesan log donasi</b> dari chat ini.`
    );

    // Hapus pesan konfirmasi otomatis setelah 4 detik agar chat bersih total
    if (successMsgId) {
      setTimeout(() => deleteTelegramMessage(chatId, successMsgId), 4000);
    }
    return;
  }

  // Handler perintah /reset_total
  if (baseCmd === "/reset_total" || baseCmd === "/reset_saldo") {
    resetStats();
    await deleteTelegramMessage(chatId, message.message_id);
    const msgId = await sendTextMessage(
      chatId,
      "🔄 <b>Total saldo donasi terkumpul berhasil di-reset ke Rp 0.</b> (Cocok untuk mulai sesi live baru)"
    );
    if (msgId) {
      setTimeout(() => deleteTelegramMessage(chatId, msgId), 5000);
    }
    return;
  }

  // Handler perintah /status
  if (baseCmd === "/status") {
    const logs = getLogs();
    const stats = getStats();
    await sendTextMessage(
      chatId,
      `📊 <b>Status & Saldo Bot Saweria:</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🟢 Status: <b>Aktif & Siap Menerima Donasi</b>\n` +
      `💼 Total Bersih Terkumpul: <b>${formatRupiah(stats.totalNet)}</b>\n` +
      `💰 Total Kotor Donasi: <b>${formatRupiah(stats.totalGross)}</b> (${stats.donationCount}x donasi)\n` +
      `📝 Log tersimpan di chat: <b>${logs.length} pesan</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 Klik <b>/hapus_log</b> untuk membersihkan pesan chat.\n` +
      `💡 Klik <b>/reset_total</b> untuk mengulang hitungan saldo ke 0.`
    );
    return;
  }

  // Handler perintah /start atau /help
  if (baseCmd === "/start" || baseCmd === "/help") {
    const stats = getStats();
    await sendTextMessage(
      chatId,
      `👋 <b>Halo! Bot Notifikasi Saweria Aktif.</b>\n\n` +
      `Setiap donasi masuk di Saweria akan otomatis diteruskan ke sini.\n\n` +
      `💼 <b>Total Saldo Terkumpul Saat Ini:</b> <b>${formatRupiah(stats.totalNet)}</b>\n\n` +
      `<b>Gunakan tombol menu [≡] atau klik perintah berikut:</b>\n` +
      `• /hapus_log : Menghapus semua pesan donasi yang masuk ke chat ini\n` +
      `• /status : Melihat total saldo terkumpul dan status bot\n` +
      `• /reset_total : Mereset hitungan total saldo donasi ke Rp 0\n` +
      `• /help : Menampilkan pesan bantuan ini`
    );
    return;
  }
}

/**
 * Menjalankan long-polling untuk menerima update dan perintah dari Telegram (Mode Lokal)
 */
export async function startTelegramPolling(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[BOT] TELEGRAM_BOT_TOKEN belum disetel, polling tidak dijalankan.");
    return;
  }

  if (isPolling) return;
  isPolling = true;

  // Daftarkan tombol menu perintah [≡] saat bot mulai
  await registerBotCommands();

  console.log("🤖 Telegram Command Listener aktif (Mode Polling Lokal)");

  while (isPolling) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId}&timeout=25`;
      const response = await fetch(url);
      const data = (await response.json()) as {
        ok: boolean;
        result?: TelegramUpdate[];
      };

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id + 1;
          if (update.message) {
            await handleTelegramMessage(update.message);
          }
        }
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}
