import { readFile } from "node:fs/promises";

await loadLocalEnv();

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
if (!appUrl) throw new Error("APP_URL is not configured");
if (!appUrl.startsWith("https://")) throw new Error("APP_URL must use HTTPS for a Telegram webhook");

const webhookUrl = `${appUrl}/api/telegram/webhook`;
await callTelegram("setWebhook", {
  url: webhookUrl,
  allowed_updates: ["message"],
  drop_pending_updates: false,
  ...(secret ? { secret_token: secret } : {}),
});
await callTelegram("setMyCommands", {
  commands: [{ command: "start", description: "Создать новую задачу" }],
});

console.log(`Telegram webhook configured: ${webhookUrl}`);

async function callTelegram(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(`Telegram ${method} failed: ${result.description ?? response.status}`);
  }
}

async function loadLocalEnv() {
  let source = "";
  try {
    source = await readFile(new URL("../.env", import.meta.url), "utf8");
  } catch {
    return;
  }

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].trim().replace(/^(?:"(.*)"|'(.*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted ?? "");
    process.env[match[1]] = value;
  }
}
