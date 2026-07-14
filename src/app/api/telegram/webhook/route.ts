import { timingSafeEqual } from "node:crypto";
import { PermissionKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTelegramStartMessage } from "@/lib/telegram";
import { consumeTelegramConnectCode } from "@/lib/telegram-connect-code";
import { verifyTelegramStartToken } from "@/lib/telegram-link";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string; type?: string };
    text?: string;
  };
};

const startCommand = /^\/start(?:@[a-z0-9_]+)?(?:\s+(\S+))?$/i;
const connectCommand = /^\/connect(?:@[a-z0-9_]+)?\s+([a-z0-9 -]+)$/i;

export async function POST(request: Request) {
  if (!hasValidSecret(request)) return Response.json({ ok: false }, { status: 401 });

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const text = update.message?.text?.trim() ?? "";
  const chatId = update.message?.chat?.id;
  const isPrivate = update.message?.chat?.type === "private";
  if (chatId === undefined) return Response.json({ ok: true, handled: false });

  const connect = text.match(connectCommand);
  const start = text.match(startCommand);
  if (!connect && !start) return Response.json({ ok: true, handled: false });

  let userId: string | null = null;
  if (isPrivate && connect?.[1]) {
    userId = (await consumeTelegramConnectCode(connect[1]))?.id ?? null;
  } else if (isPrivate && start?.[1]) {
    const legacyUserId = verifyTelegramStartToken(start[1]);
    if (legacyUserId) {
      userId = (await prisma.user.findFirst({
        where: {
          id: legacyUserId,
          emailVerifiedAt: { not: null },
          approvedAt: { not: null },
          role: { permissions: { has: PermissionKey.USE_TELEGRAM } },
        },
        select: { id: true },
      }))?.id ?? null;
    }
  }

  if (userId) {
    await prisma.$transaction([
      prisma.telegramConnection.updateMany({
        where: { chatId: String(chatId), userId: { not: userId } },
        data: { enabled: false },
      }),
      prisma.telegramConnection.upsert({
        where: { userId },
        update: { chatId: String(chatId), enabled: true },
        create: { userId, chatId: String(chatId), enabled: true },
      }),
    ]);
  }

  const state = userId ? "connected" : connect || start?.[1] ? "invalid" : "instructions";
  const delivery = await sendTelegramStartMessage(String(chatId), state);
  return Response.json({ ok: true, handled: true, linked: Boolean(userId), delivered: delivery.sent > 0 });
}

function hasValidSecret(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!expected) return false;
  const received = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
