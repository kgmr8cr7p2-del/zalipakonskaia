import { Priority, RoleName } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  lastName: z.string().trim().min(2, "Введите фамилию").max(80),
  firstName: z.string().trim().min(2, "Введите имя").max(80),
  middleName: z.string().trim().max(80).default(""),
  email: z.string().email("Введите корректную почту").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Минимум 8 символов"),
});

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

const taskDateSchema = (requiredMessage = "Укажите дату") => z.string({ required_error: requiredMessage, invalid_type_error: requiredMessage })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Укажите корректную дату");

export const taskSchema = z.object({
  title: z.string().trim().min(2, "Введите название задачи").max(180).transform((value) => value.replace(/\s+/g, " ")),
  description: z.string().max(4000).default(""),
  columnId: z.string().min(1),
  oilDepotId: z.string().optional().nullable(),
  priority: z.nativeEnum(Priority),
  startDate: taskDateSchema().optional().nullable(),
  deadline: taskDateSchema("Укажите дедлайн задачи"),
  assigneeId: z.string().optional().nullable(),
  assigneeIds: z.array(z.string().min(1)).max(30).optional(),
  initialComment: z.string().max(2000).optional().nullable(),
  initialChecklist: z.array(z.string().max(240)).default([]),
  tags: z.array(z.string().min(1).max(32)).default([]),
});

export const columnSchema = z.object({
  name: z.string().min(2).max(60),
});

export const personalBoardSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const oilDepotSchema = z.object({
  name: z.string().min(2).max(120),
  active: z.boolean().optional(),
});

export const commentSchema = z.object({
  text: z.string().min(1).max(2000),
});

export const checklistItemSchema = z.object({
  text: z.string().min(1).max(240),
});

export const profileSchema = z.object({
  lastName: z.string().trim().min(2, "Введите фамилию").max(80),
  firstName: z.string().trim().min(2, "Введите имя").max(80),
  middleName: z.string().trim().max(80).default(""),
  jobTitle: z.string().trim().max(100).default(""),
  handle: z.string().trim().max(40).regex(/^[\p{L}\p{N}._-]*$/u, "Используйте буквы, цифры, точку, дефис или подчёркивание").default(""),
  telegramChatId: z.string().max(80).optional(),
});

export const userRoleSchema = z.object({
  role: z.nativeEnum(RoleName),
});

export const userInviteSchema = z.object({
  email: z.string().email("Введите корректную почту").transform((value) => value.toLowerCase()),
  role: z.nativeEnum(RoleName),
});
