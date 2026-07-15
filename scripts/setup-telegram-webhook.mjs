import { readFile } from "node:fs/promises";

await loadLocalEnv();

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
if (!appUrl) throw new Error("APP_URL is not configured");
if (!appUrl.startsWith("https://")) throw new Error("APP_URL must use HTTPS for a Telegram webhook");

const webhookUrl = `${appUrl}/api/telegram/webhook`;
if (secret) {
  const probe = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    body: "{}",
  });
  if (!probe.ok) {
    throw new Error(`Telegram webhook secret probe failed: HTTP ${probe.status}`);
  }
}

// Recreate the webhook so Telegram cannot keep a secret from an older release.
// Pending updates are preserved and delivered after the new secret is registered.
await callTelegram("deleteWebhook", { drop_pending_updates: false });
await callTelegram("setWebhook", {
  url: webhookUrl,
  allowed_updates: ["message"],
  drop_pending_updates: false,
  ...(secret ? { secret_token: secret } : {}),
});
await callTelegramOptional("setMyCommands", {
  commands: [{ command: "start", description: "Подключить уведомления" }],
});
await callTelegramOptional("setChatMenuButton", { menu_button: { type: "default" } });
await callTelegramOptional("setMyName", { name: "Taskora · Личные напоминания" });
await callTelegramOptional("setMyDescription", {
  description: "Личные напоминания только о задачах с ваших личных досок Taskora.",
});
await callTelegramOptional("setMyShortDescription", {
  short_description: "Напоминания с личных досок Taskora",
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

async function callTelegramOptional(method, payload) {
  try {
    await callTelegram(method, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Optional Telegram setup skipped: ${message}`);
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
