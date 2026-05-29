import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTelegramMessage } from "../../src/telegram/send.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("sendTelegramMessage", () => {
  it("skips safely when token or chat id is missing", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await sendTelegramMessage({ token: "", chatId: "", text: "BTC anomaly" });

    expect(result).toEqual({ status: "skipped", reason: "missing_telegram_config" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to Telegram when token and chat id are configured", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await sendTelegramMessage({ token: "bot-token", chatId: "@channel", text: "BTC anomaly" });

    expect(result).toEqual({ status: "sent" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/botbot-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: "@channel", text: "BTC anomaly", disable_web_page_preview: true })
      })
    );
  });
});
