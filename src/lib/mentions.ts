import { prisma } from "@/lib/prisma";

const mentionPattern = /@([\p{L}\p{N}._-]{2,40})/gu;

export function extractMentionTokens(text: string) {
  return Array.from(text.matchAll(mentionPattern), (match) => normalizeMentionValue(match[1]));
}

function normalizeMentionValue(value: string) {
  return value.replace(/^@/, "").replace(/[.,!?;:()[\]{}]+$/gu, "").trim().toLocaleLowerCase("ru-RU");
}

export async function resolveMentionedUserIds(text: string, excludeUserId?: string) {
  const tokens = new Set(extractMentionTokens(text));
  if (!tokens.size) return [];

  const users = await prisma.user.findMany({
    where: { approvedAt: { not: null }, id: excludeUserId ? { not: excludeUserId } : undefined },
    select: { id: true, name: true, handle: true, firstName: true, lastName: true, middleName: true },
  });
  const ids = new Set<string>();
  for (const user of users) {
    const candidates = [user.handle, user.name, user.firstName, user.lastName, user.middleName]
      .filter(Boolean)
      .flatMap((value) => [value, ...value.split(/\s+/)])
      .map((value) => normalizeMentionValue(value))
      .filter(Boolean);
    if (candidates.some((candidate) => tokens.has(candidate))) ids.add(user.id);
  }
  return Array.from(ids).slice(0, 20);
}

export function truncateNotificationText(text: string, max = 220) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
