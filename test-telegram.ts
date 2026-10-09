import "dotenv/config";

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error(
      "Token atau Chat ID belum diatur di file .env",
    );
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Tes berhasil! Bot notifikasi Saweria siap dikembangkan.",
      }),
    },
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(JSON.stringify(result));
  }

  console.log("Pesan berhasil dikirim:", result.ok);
}

main().catch((error: unknown) => {
  console.error("Gagal:", error);
  process.exitCode = 1;
});