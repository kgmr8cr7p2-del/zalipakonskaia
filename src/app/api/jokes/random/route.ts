import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import jokesData from "@/data/tv-jokes.json";
import { requireVerifiedUser } from "@/lib/auth";

type JokeItem = { id: number; text: string };

const jokes = (jokesData as JokeItem[]).filter(
  (item) => item.text.length <= 105 && item.text.split("\n").length <= 4,
);

export const dynamic = "force-dynamic";

export async function GET() {
  await requireVerifiedUser();
  if (!jokes.length) {
    return NextResponse.json({ error: "База шуток пуста" }, { status: 503 });
  }

  const joke = jokes[randomInt(jokes.length)];
  return NextResponse.json(
    { id: joke.id, joke: joke.text, updatedAt: new Date().toISOString() },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
