import { timingSafeEqual } from "node:crypto";
import { sendTelegramStartMessage } from "@/lib/telegram";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string };
    text?: string;
  };
};

const startCommand = /^\/start(?:@[a-z0-9_]+)?(?:\s|$)/i;

export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const text = update.message?.text?.trim() ?? "";
  const chatId = update.message?.chat?.id;
  if (chatId === undefined || !startCommand.test(text)) {
    return Response.json({ ok: true, handled: false });
  }

  const delivery = await sendTelegramStartMessage(String(chatId));
  return Response.json({ ok: true, handled: true, delivered: delivery.sent > 0 });
}

function hasValidSecret(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!expected) return true;

  const received = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
