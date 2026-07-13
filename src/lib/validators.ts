import { Priority, RoleName } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Введите имя"),
  email: z.string().email("Введите корректную почту").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Минимум 8 символов"),
});

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

export const taskSchema = z.object({
  title: z.string().min(2).max(180),
  description: z.string().max(4000).default(""),
  columnId: z.string().min(1),
  oilDepotId: z.string().optional().nullable(),
  priority: z.nativeEnum(Priority),
  deadline: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
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
  name: z.string().min(2).max(80),
  telegramChatId: z.string().max(80).optional(),
});

export const userRoleSchema = z.object({
  role: z.nativeEnum(RoleName),
});

export const userInviteSchema = z.object({
  email: z.string().email("Введите корректную почту").transform((value) => value.toLowerCase()),
  role: z.nativeEnum(RoleName),
});
