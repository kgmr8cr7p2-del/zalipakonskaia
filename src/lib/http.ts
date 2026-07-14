import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown) {
  unstable_rethrow(error);
  console.error(error);
  if (error instanceof ZodError) {
    return fail(error.issues[0]?.message ?? "Некорректные данные", 422);
  }
  return fail("Не удалось выполнить действие", 500);
}
