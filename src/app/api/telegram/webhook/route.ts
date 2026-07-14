import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendTelegramStartMessage } from "@/lib/telegram";
import { verifyTelegramStartToken } from "@/lib/telegram-link";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string; type?: string };
    text?: string;
  };
};

const startCommand = /^\/start(?:@[a-z0-9_]+)?(?:\s+(\S+))?$/i;

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
  const command = text.match(startCommand);
  if (chatId === undefined || !command) {
    return Response.json({ ok: true, handled: false });
  }

  const linkedUserId = command[1] && update.message?.chat?.type === "private"
    ? verifyTelegramStartToken(command[1])
    : null;
  let connected = false;
  if (linkedUserId) {
    const user = await prisma.user.findFirst({
      where: { id: linkedUserId, emailVerifiedAt: { not: null }, approvedAt: { not: null } },
      select: { id: true },
    });
    if (user) {
      await prisma.telegramConnection.upsert({
        where: { userId: user.id },
        update: { chatId: String(chatId), enabled: true },
        create: { userId: user.id, chatId: String(chatId), enabled: true },
      });
      connected = true;
    }
  }

  const delivery = await sendTelegramStartMessage(String(chatId), connected);
  return Response.json({ ok: true, handled: true, linked: connected, delivered: delivery.sent > 0 });
}

function hasValidSecret(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!expected) return false;

  const received = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
