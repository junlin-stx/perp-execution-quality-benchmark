export interface TelegramSendInput {
  token: string | undefined;
  chatId: string | undefined;
  text: string;
}

export type TelegramSendResult =
  | { status: "sent" }
  | { status: "skipped"; reason: "missing_telegram_config" };

export async function sendTelegramMessage(input: TelegramSendInput): Promise<TelegramSendResult> {
  if (!input.token || !input.chatId) {
    return { status: "skipped", reason: "missing_telegram_config" };
  }

  const response = await fetch(`https://api.telegram.org/bot${input.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`telegram send failed: ${response.status} ${body.slice(0, 200)}`);
  }

  return { status: "sent" };
}
