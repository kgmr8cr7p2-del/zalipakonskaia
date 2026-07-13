import { requireVerifiedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleRouteError, ok } from "@/lib/http";
import { personalBoardSchema } from "@/lib/validators";

export async function GET() {
  const user = await requireVerifiedUser();
  const boards = await prisma.board.findMany({
    where: { ownerId: user.id },
    select: { id: true, name: true, createdAt: true, _count: { select: { columns: true } } },
    orderBy: { createdAt: "asc" },
  });
  return ok({ boards });
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const input = personalBoardSchema.parse(await request.json());
    const duplicate = await prisma.board.findFirst({ where: { ownerId: user.id, name: input.name }, select: { id: true } });
    if (duplicate) return fail("Личная доска с таким названием уже существует", 409);

    const sharedBoard = await prisma.board.findFirst({
      where: { ownerId: null },
      select: { columns: { orderBy: { position: "asc" }, select: { name: true, position: true } } },
    });
    const templateColumns = sharedBoard?.columns.length
      ? sharedBoard.columns
      : ["Новые", "В работе", "На проверке", "Готово"].map((name, position) => ({ name, position }));

    const board = await prisma.board.create({
      data: {
        name: input.name,
        ownerId: user.id,
        columns: { create: templateColumns.map((column) => ({ name: column.name, position: column.position })) },
      },
      select: { id: true, name: true, createdAt: true, _count: { select: { columns: true } } },
    });
    return ok({ board }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
