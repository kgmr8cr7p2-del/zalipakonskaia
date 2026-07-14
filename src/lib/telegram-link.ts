import { createHmac, timingSafeEqual } from "node:crypto";

const LINK_TTL_SECONDS = 7 * 24 * 60 * 60;
let cachedBotUsername = "";

export function createTelegramStartToken(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyTelegramStartToken(token: string) {
  const [userId, expiresAtValue, signature, ...extra] = token.split(".");
  if (!userId || !expiresAtValue || !signature || extra.length) return null;
  const expiresAt = Number(expiresAtValue);
  if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null;

  const expected = sign(`${userId}.${expiresAtValue}`);
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) return null;
  return userId;
}

export async function telegramBotLink() {
  const username = await resolveBotUsername();
  if (!/^[a-z0-9_]{5,32}$/i.test(username)) return null;
  return `https://telegram.me/${username}`;
}

async function resolveBotUsername() {
  const configured = (process.env.TELEGRAM_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  if (configured) return configured;
  if (cachedBotUsername) return cachedBotUsername;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return "";

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { next: { revalidate: 3600 } });
    const payload = await response.json() as { ok?: boolean; result?: { username?: string } };
    cachedBotUsername = payload.ok ? payload.result?.username ?? "" : "";
  } catch {
    cachedBotUsername = "";
  }
  return cachedBotUsername;
}

function sign(payload: string) {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update(`telegram:${payload}`).digest("base64url").slice(0, 16);
}
