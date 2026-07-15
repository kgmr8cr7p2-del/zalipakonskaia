self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Taskora", body: event.data ? event.data.text() : "Новое уведомление" };
  }
  const title = payload.title || "Taskora";
  const options = {
    body: payload.body || "Новое уведомление",
    icon: payload.icon || "/taskora-icon.png",
    badge: payload.badge || "/taskora-icon.png",
    tag: payload.id ? `taskora-${payload.id}` : undefined,
    timestamp: Number(payload.timestamp) || Date.now(),
    lang: "ru",
    renotify: Boolean(payload.id),
    silent: false,
    actions: [{ action: "open", title: "Открыть Taskora" }],
    data: { href: payload.href || "/notifications" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let targetUrl = new URL("/notifications", self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.href || "/notifications", self.location.origin);
    if (candidate.origin === self.location.origin) targetUrl = candidate;
  } catch {
    // Keep the safe notification-center fallback.
  }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      if ("navigate" in client) await client.navigate(targetUrl.href);
      return client.focus();
    }
    return self.clients.openWindow(targetUrl.href);
  })());
});
