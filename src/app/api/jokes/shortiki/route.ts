import { NextResponse } from "next/server";

const SOURCE_URL = "https://shortiki.com/random.php";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(SOURCE_URL, {
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "TeamKanban-TV/1.0 (+https://kanban.region-free.online)",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) throw new Error(`Shortiki responded with ${response.status}`);

    const html = await response.text();
    const jokes = extractJokes(html);
    if (!jokes.length) throw new Error("No jokes found in Shortiki response");

    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    return NextResponse.json(
      { joke, source: "shortiki.com", sourceUrl: "https://shortiki.com/random.php", updatedAt: new Date().toISOString() },
      { headers: { "cache-control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Источник анекдотов временно недоступен" },
      { status: 502, headers: { "cache-control": "no-store, max-age=0" } },
    );
  }
}

function extractJokes(html: string) {
  return Array.from(html.matchAll(/<div\s+class=["']shortik["'][^>]*>([\s\S]*?)<\/div>/gi))
    .map((match) => sanitizeText(match[1]))
    .filter((joke) => joke.length >= 12 && joke.length <= 420);
}

function sanitizeText(value: string) {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    laquo: "«",
    lt: "<",
    mdash: "—",
    nbsp: " ",
    ndash: "–",
    quot: '"',
    raquo: "»",
  };

  return value.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return named[code.toLowerCase()] ?? entity;
  });
}
