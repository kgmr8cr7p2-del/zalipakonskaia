import ExcelJS from "exceljs";
import { requireVerifiedUser } from "@/lib/auth";
import { getBoardView } from "@/lib/board-data";
import { fail } from "@/lib/http";

const priorityLabels = {
  LOW: "Низкий",
  PLANNED: "Плановые работы",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  CRITICAL: "Критический",
};

export async function GET(request: Request) {
  const user = await requireVerifiedUser();
  const view = await getBoardView(user, new URL(request.url).searchParams);
  if (!view) return fail("Доска не найдена", 404);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Задачи");
  sheet.columns = [
    { header: "Название задачи", key: "title", width: 34 },
    { header: "Описание", key: "description", width: 48 },
    { header: "Статус", key: "status", width: 18 },
    { header: "Приоритет", key: "priority", width: 16 },
    { header: "Исполнитель", key: "assignee", width: 24 },
    { header: "Теги", key: "tags", width: 24 },
    { header: "Дедлайн", key: "deadline", width: 16 },
    { header: "Дата создания", key: "createdAt", width: 20 },
    { header: "Дата обновления", key: "updatedAt", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const column of view.board.columns) {
    for (const task of column.tasks) {
      sheet.addRow({
        title: task.title,
        description: task.description,
        status: column.name,
        priority: priorityLabels[task.priority],
        assignee: task.assignees.length ? task.assignees.map((item) => item.user.name).join(", ") : task.assignee?.name ?? "",
        tags: task.tags.map((item) => item.tag.name).join(", "),
        deadline: task.deadline?.toLocaleDateString("ru-RU") ?? "",
        createdAt: task.createdAt.toLocaleString("ru-RU"),
        updatedAt: task.updatedAt.toLocaleString("ru-RU"),
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="team-kanban-tasks.xlsx"',
    },
  });
}
