import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface BotStats {
  totalGross: number; // Total donasi kotor
  totalNet: number;   // Total saldo bersih diterima
  donationCount: number;
}

const STATS_FILE = path.resolve(os.tmpdir(), "saweria_bot_stats.json");

/**
 * Mengambil statistik total saldo donasi yang terkumpul
 */
export function getStats(): BotStats {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = fs.readFileSync(STATS_FILE, "utf-8");
      return JSON.parse(data) as BotStats;
    }
  } catch {
    // fallback jika gagal baca
  }
  return { totalGross: 0, totalNet: 0, donationCount: 0 };
}

/**
 * Mencatat donasi baru ke akumulasi total saldo
 */
export function recordDonationStats(gross: number, net: number): BotStats {
  const stats = getStats();
  stats.totalGross += gross;
  stats.totalNet += net;
  stats.donationCount += 1;

  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf-8");
  } catch (error) {
    console.error("[STATS] Gagal menyimpan statistik:", error);
  }

  return stats;
}

/**
 * Mereset akumulasi total saldo donasi (misal untuk mulai live baru)
 */
export function resetStats(): void {
  try {
    fs.writeFileSync(
      STATS_FILE,
      JSON.stringify({ totalGross: 0, totalNet: 0, donationCount: 0 }, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error("[STATS] Gagal mereset statistik:", error);
  }
}
