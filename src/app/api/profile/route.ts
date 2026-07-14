import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleRouteError, ok } from "@/lib/http";
import { profileSchema } from "@/lib/validators";
import { formatUserName } from "@/lib/user-name";

export async function PATCH(request: Request) {
  try {
    const user = await requireAccountUser();
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
    return ok({ profile });
  } catch (error) {
    return handleRouteError(error);
  }
}
