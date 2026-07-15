import { createECDH, createHash } from "node:crypto";
import webPush from "web-push";
import { prisma } from "@/lib/prisma";

type PushNotice = {
  id: string;
  title: string;
  body: string;
  href?: string | null;
};

let cachedKeys: { publicKey: string; privateKey: string } | null = null;
let configured = false;

export function getWebPushPublicKey() {
  return getWebPushKeys().publicKey;
}

export async function sendWebPushNotification(userId: string, notice: PushNotice) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });
  if (!subscriptions.length) return { sent: 0, failed: 0 };

  configureWebPush();
  const payload = JSON.stringify({
    id: notice.id,
    title: notice.title,
    body: notice.body,
    href: notice.href || "/notifications",
    icon: "/taskora-icon.png",
    badge: "/taskora-icon.png",
    timestamp: Date.now(),
  });
  const expiredEndpoints: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payload, { TTL: 60 * 60, timeout: 5_000, urgency: "high" });
      sent += 1;
    } catch (error) {
      failed += 1;
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) expiredEndpoints.push(subscription.endpoint);
    }
  }));

  if (expiredEndpoints.length) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: expiredEndpoints } } });
  }
  return { sent, failed };
}

function configureWebPush() {
  if (configured) return;
  const keys = getWebPushKeys();
  webPush.setVapidDetails(
    process.env.WEB_PUSH_SUBJECT || "mailto:notifications@region-free.online",
    keys.publicKey,
    keys.privateKey,
  );
  configured = true;
}

function getWebPushKeys() {
  if (cachedKeys) return cachedKeys;
  const secret = process.env.WEB_PUSH_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("WEB_PUSH_SECRET or SESSION_SECRET is required for browser push notifications");

  const ecdh = createECDH("prime256v1");
  let privateKey = createHash("sha256").update(`taskora:web-push:${secret}`).digest();
  for (let attempt = 0; attempt < 16; attempt += 1) {
    try {
      ecdh.setPrivateKey(privateKey);
      cachedKeys = {
        publicKey: ecdh.getPublicKey(undefined, "uncompressed").toString("base64url"),
        privateKey: privateKey.toString("base64url"),
      };
      return cachedKeys;
    } catch {
      privateKey = createHash("sha256").update(privateKey).digest();
    }
  }
  throw new Error("Unable to derive a valid browser push key");
}
