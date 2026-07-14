import { destroySession } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function POST() {
  await destroySession();
  const response = ok({ ok: true });
  response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
  return response;
}
