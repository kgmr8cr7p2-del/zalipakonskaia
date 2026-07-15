import { NextRequest, NextResponse } from "next/server";

const mutatingMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const csrfExemptPaths = new Set(["/api/telegram/webhook"]);
const bearerAllowedPaths = new Set(["/api/reports/weekly", "/api/notifications/deadlines"]);

type RateLimitRule = {
  pattern: RegExp;
  methods: readonly string[];
  windowMs: number;
  max: number;
};

const rateLimits: readonly RateLimitRule[] = [
  { pattern: /^\/api\/auth\//, methods: ["POST"], windowMs: 60_000, max: 10 },
  { pattern: /^\/api\/important-files$/, methods: ["POST"], windowMs: 10 * 60_000, max: 20 },
  { pattern: /^\/api\/tasks\/[^/]+\/files$/, methods: ["POST"], windowMs: 10 * 60_000, max: 20 },
  { pattern: /^\/api\/messages$/, methods: ["POST"], windowMs: 10 * 60_000, max: 60 },
  { pattern: /^\/api\/profile\/avatar$/, methods: ["POST"], windowMs: 10 * 60_000, max: 20 },
];

const buckets = new Map<string, { count: number; resetAt: number }>();

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const rateLimited = checkRateLimit(request, path);
  if (rateLimited) return rateLimited;

  if (!mutatingMethods.has(request.method) || csrfExemptPaths.has(path)) {
    return NextResponse.next();
  }

  if (bearerAllowedPaths.has(path) && request.headers.get("authorization")?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.next();
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return forbidden();

  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return forbidden();

  let sourceOrigin = "";
  try {
    sourceOrigin = new URL(source).origin;
  } catch {
    return forbidden();
  }

  if (!allowedOrigins(request).has(sourceOrigin)) return forbidden();
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};

function checkRateLimit(request: NextRequest, path: string) {
  const rule = rateLimits.find((item) => item.pattern.test(path) && item.methods.includes(request.method));
  if (!rule) return null;

  const now = Date.now();
  const key = `${clientIp(request)}:${request.method}:${rule.pattern.source}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= rule.max) return null;

  return NextResponse.json(
    { error: "Слишком много запросов. Попробуйте позже." },
    {
      status: 429,
      headers: { "retry-after": String(Math.ceil((bucket.resetAt - now) / 1000)) },
    },
  );
}

function allowedOrigins(request: NextRequest) {
  const origins = new Set([request.nextUrl.origin]);
  if (process.env.APP_URL) {
    try {
      origins.add(new URL(process.env.APP_URL).origin);
    } catch {
      // Ignore malformed deployment config here; app startup checks should catch it.
    }
  }
  return origins;
}

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function forbidden() {
  return NextResponse.json({ error: "Запрос отклонён политикой безопасности" }, { status: 403 });
}
