import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface LogEntry {
  message_id: number;
  chat_id: string | number;
  donator: string;
  amount: number;
  sent_at: string;
}

// Menggunakan os.tmpdir() agar kompatibel baik di Windows lokal maupun di Vercel/Cloud Serverless
const LOG_FILE = path.resolve(os.tmpdir(), "saweria_bot_logs.json");

/**
 * Membaca semua log pesan donasi yang tersimpan
 */
export function getLogs(): LogEntry[] {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return [];
    }
    const data = fs.readFileSync(LOG_FILE, "utf-8");
    return JSON.parse(data) as LogEntry[];
  } catch {
    return [];
  }
}

/**
 * Menyimpan pesan log donasi baru ke logs.json
 */
export function addLog(entry: Omit<LogEntry, "sent_at">): void {
  try {
    const logs = getLogs();
    logs.push({
      ...entry,
      sent_at: new Date().toISOString(),
    });
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), "utf-8");
  } catch (error) {
    console.error("[LOGGER] Gagal menulis log:", error);
  }
}

/**
 * Menghapus seluruh data riwayat log di file logs.json
 */
export function clearLogs(): void {
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2), "utf-8");
  } catch (error) {
    console.error("[LOGGER] Gagal mengosongkan log:", error);
  }
}
