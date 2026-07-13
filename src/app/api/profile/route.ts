import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleRouteError, ok } from "@/lib/http";
import { profileSchema } from "@/lib/validators";
import { formatUserName } from "@/lib/user-name";

const DEFAULT_TELEGRAM_CHAT_ID = "-5575713442";

export async function PATCH(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const input = profileSchema.parse(await request.json());
    const profile = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: formatUserName(input),
        lastName: input.lastName,
        firstName: input.firstName,
        middleName: input.middleName,
        jobTitle: input.jobTitle,
        handle: input.handle,
      },
      select: { id: true, name: true, lastName: true, firstName: true, middleName: true, email: true, jobTitle: true, handle: true, profileStatus: true, currentActivity: true, lastActiveAt: true, avatarUrl: true },
    });
    await prisma.telegramConnection.upsert({
      where: { userId: user.id },
      update: { chatId: DEFAULT_TELEGRAM_CHAT_ID, enabled: true },
      create: { userId: user.id, chatId: DEFAULT_TELEGRAM_CHAT_ID },
    });
    return ok({ profile });
  } catch (error) {
    return handleRouteError(error);
  }
}
