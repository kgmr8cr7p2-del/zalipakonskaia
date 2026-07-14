import { requireVerifiedUser } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const viewer = await requireVerifiedUser();
    const [users, messages] = await Promise.all([
      prisma.user.findMany({
        where: { id: { not: viewer.id }, emailVerifiedAt: { not: null }, approvedAt: { not: null } },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          handle: true,
          avatarUrl: true,
          currentActivity: true,
          lastActiveAt: true,
        },
      }),
      prisma.directMessage.findMany({
        where: { OR: [{ senderId: viewer.id }, { recipientId: viewer.id }] },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          text: true,
          senderId: true,
          recipientId: true,
          fileName: true,
          readAt: true,
          createdAt: true,
        },
      }),
    ]);

    const summaries = new Map<string, { latest: (typeof messages)[number] | null; unreadCount: number }>();
    for (const message of messages) {
      const peerId = message.senderId === viewer.id ? message.recipientId : message.senderId;
      const summary = summaries.get(peerId) ?? { latest: null, unreadCount: 0 };
      if (!summary.latest) summary.latest = message;
      if (message.recipientId === viewer.id && !message.readAt) summary.unreadCount += 1;
      summaries.set(peerId, summary);
    }

    const conversations = users
      .map((user) => ({ user, ...(summaries.get(user.id) ?? { latest: null, unreadCount: 0 }) }))
      .sort((a, b) => {
        const aTime = a.latest?.createdAt.getTime() ?? 0;
        const bTime = b.latest?.createdAt.getTime() ?? 0;
        return bTime - aTime || a.user.name.localeCompare(b.user.name, "ru");
      });

    return ok({
      conversations,
      unreadTotal: conversations.reduce((sum, item) => sum + item.unreadCount, 0),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
