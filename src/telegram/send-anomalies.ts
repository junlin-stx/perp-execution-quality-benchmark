import { readFileSync } from "node:fs";
import { sendTelegramMessage } from "./send.js";

interface AnomalyRow {
  message?: unknown;
}

function optionValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const anomaliesPath = optionValue("--anomalies", "public/data/anomalies.json");
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const rows = JSON.parse(readFileSync(anomaliesPath, "utf8")) as AnomalyRow[];
let sent = 0;
let skipped = 0;

for (const row of rows) {
  if (typeof row.message !== "string" || !row.message.trim()) continue;
  const result = await sendTelegramMessage({ token, chatId, text: row.message });
  if (result.status === "sent") sent += 1;
  if (result.status === "skipped") skipped += 1;
}

if (rows.length === 0) {
  console.log("telegram anomalies: no events to send");
} else {
  console.log(`telegram anomalies: sent=${sent} skipped=${skipped}`);
}
