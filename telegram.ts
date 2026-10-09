import "dotenv/config";
import { addLog, getLogs, clearLogs } from "./logger.js";

export interface DonationData {
  donator: string;
  amount: number;
  message: string;
  media?: unknown;
}

/**
 * Escape karakter HTML agar aman dikirim dengan parse_mode HTML ke Telegram
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Format angka ke format mata uang Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format waktu saat ini ke WIB (Asia/Jakarta)
 */
export function formatWIB(date = new Date()): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "medium",
  }).format(date);
}

/**
 * Format pesan notifikasi donasi Telegram yang menarik dan rapi
 */
export function formatDonationMessage(donation: DonationData): string {
  const safeName = escapeHtml(donation.donator || "Anonim");
  const safeMsg = escapeHtml(donation.message || "-");
  const nominal = formatRupiah(donation.amount);
  const waktu = formatWIB();

  return (
    `🎉 <b>DONASI BARU DITERIMA!</b> 🎉\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Dari:</b> <b>${safeName}</b>\n` +
    `💰 <b>Nominal:</b> <b>${nominal}</b>\n` +
    `💬 <b>Pesan:</b>\n` +
    `<i>"${safeMsg}"</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⏰ <b>Waktu:</b> ${waktu}\n` +
    `❤️ <i>Terima kasih banyak atas donasinya!</i>`
  );
}

/**
 * Mengirim pesan ke channel/chat Telegram dan mencatat message_id ke log
 */
export async function sendTelegramNotification(
  text: string,
  donationInfo?: { donator: string; amount: number }
): Promise<number> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diatur di file .env");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  const result = (await response.json()) as {
    ok: boolean;
    description?: string;
    result?: { message_id: number };
  };

  if (!response.ok || !result.ok || !result.result) {
    throw new Error(result.description || "Gagal mengirim pesan ke Telegram");
  }

  const messageId = result.result.message_id;

  // Catat message_id jika ini merupakan notifikasi donasi
  if (donationInfo) {
    addLog({
      message_id: messageId,
      chat_id: chatId,
      donator: donationInfo.donator,
      amount: donationInfo.amount,
    });
  }

  return messageId;
}

/**
 * Mengirim pesan biasa ke chat Telegram tertentu
 */
export async function sendTextMessage(chatId: string | number, text: string): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    const data = (await res.json()) as any;
    return data?.result?.message_id || null;
  } catch {
    return null;
  }
}

/**
 * Menghapus satu pesan dari chat Telegram
 */
export async function deleteTelegramMessage(chatId: string | number, messageId: number): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });
    const data = (await res.json()) as { ok: boolean };
    return Boolean(data?.ok);
  } catch {
    return false;
  }
}

/**
 * Menghapus semua pesan donasi yang tersimpan di log dari chat Telegram
 */
export async function deleteAllDonationLogs(targetChatId?: string | number): Promise<number> {
  const logs = getLogs();
  if (logs.length === 0) {
    return 0;
  }

  let deletedCount = 0;
  for (const log of logs) {
    const chatId = targetChatId || log.chat_id;
    const ok = await deleteTelegramMessage(chatId, log.message_id);
    if (ok) {
      deletedCount++;
    }
  }

  // Bersihkan data log lokal setelah dihapus dari Telegram
  clearLogs();
  return deletedCount;
}
