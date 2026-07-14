import { randomBytes } from "node:crypto";
import { PermissionKey } from "@prisma/client";
import { hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const CODE_TTL_MINUTES = 15;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function issueTelegramConnectCode(userId: string) {
  const code = createCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  await prisma.telegramConnectCode.upsert({
    where: { userId },
    update: { codeHash: hashToken(code), expiresAt, createdAt: new Date() },
    create: { userId, codeHash: hashToken(code), expiresAt },
  });

  return { code, expiresAt, expiresInMinutes: CODE_TTL_MINUTES };
}

export async function consumeTelegramConnectCode(value: string) {
  const code = normalizeCode(value);
  if (!/^[A-Z2-9]{8}$/.test(code)) return null;

  const record = await prisma.telegramConnectCode.findUnique({
    where: { codeHash: hashToken(code) },
    include: { user: { include: { role: true } } },
  });
  if (!record) return null;

  await prisma.telegramConnectCode.delete({ where: { id: record.id } });
  const user = record.user;
  if (
    record.expiresAt <= new Date()
    || !user.emailVerifiedAt
    || !user.approvedAt
    || !user.role.permissions.includes(PermissionKey.USE_TELEGRAM)
  ) return null;

  return user;
}

function createCode() {
  const bytes = randomBytes(8);
  return [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replaceAll("-", "").replaceAll(" ", "");
}
