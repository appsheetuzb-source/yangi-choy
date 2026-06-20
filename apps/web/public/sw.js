/* Musaffo Tea — Web Push service worker */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : "" }; }
  const title = d.title || "Ogohlantirish — Musaffo Tea";
  const options = {
    body: d.body || "",
    icon: d.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.tag || "ogoh-push",
    renotify: true,
    requireInteraction: true,
    vibrate: [120, 60, 120],
    actions: [{ action: "open", title: "Ogohlantirishni ochish" }],
    data: { url: d.url || "/ogohlantirish" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawTarget = (event.notification.data && event.notification.data.url) || "/ogohlantirish";
  const targetUrl = new URL(rawTarget, self.location.origin).href;
  const targetPath = new URL(targetUrl).pathname;

  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    // 1) Allaqachon Ogohlantirishda turgan tab bo'lsa — fokus
    for (const c of list) {
      try { if (new URL(c.url).pathname.startsWith(targetPath)) { await c.focus(); return; } } catch {}
    }

    // 2) Yangi oyna ochish (eng ishonchli yo'l)
    if (self.clients.openWindow) {
      try { const w = await self.clients.openWindow(targetUrl); if (w) return; } catch {}
    }

    // 3) Oxirgi chora — birinchi tab'ni fokuslab yo'naltirish
    for (const c of list) {
      try { await c.focus(); if ("navigate" in c) await c.navigate(targetUrl); return; } catch {}
    }
  })());
});
