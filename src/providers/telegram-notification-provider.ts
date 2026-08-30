import type {
  NotificationInput,
  NotificationProvider,
} from "./notification-provider";

export interface TelegramNotificationProviderOptions {
  botToken: string;
  defaultChatId?: string | null;
  fetchImpl?: typeof fetch;
}

export class TelegramNotificationProvider implements NotificationProvider {
  private readonly botToken: string;
  private readonly defaultChatId: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TelegramNotificationProviderOptions) {
    const botToken = options.botToken.trim();
    if (!botToken) throw new Error("Telegram bot token is required.");
    this.botToken = botToken;
    this.defaultChatId = options.defaultChatId?.trim() || null;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async notify(input: NotificationInput): Promise<void> {
    const chatId = input.destination?.trim() || this.defaultChatId;
    if (!chatId) throw new Error("Telegram notification destination is not configured.");

    const response = await this.fetchImpl(
      `https://api.telegram.org/bot${this.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `${input.title.trim()}\n\n${input.message.trim()}`,
          disable_web_page_preview: true,
        }),
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: string }
      | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(
        `Telegram notification failed${payload?.description ? `: ${payload.description}` : "."}`,
      );
    }
  }
}

export function getConfiguredNotificationProvider(): NotificationProvider | null {
  const botToken = process.env.MKLMS_TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return null;

  return new TelegramNotificationProvider({
    botToken,
    defaultChatId: process.env.MKLMS_TELEGRAM_CHAT_ID?.trim() || null,
  });
}
