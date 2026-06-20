"use client";

export type PushStatus = "unsupported" | "denied" | "subscribed" | "default";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** SW ni ro'yxatdan o'tkazib, yangilanishni majburlash (eski SW yangisiga almashadi) */
export async function ensureFreshSW(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await reg.update();
  } catch {}
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) return "subscribed";
  } catch {}
  return "default";
}

export async function enablePush(user?: string): Promise<void> {
  if (!pushSupported()) throw new Error("Brauzer push bildirishnomani qo'llab-quvvatlamaydi");
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) throw new Error("VAPID kalit sozlanmagan");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Bildirishnomaga ruxsat berilmadi");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
    });
  }
  const j = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, user: user || "" }),
  });
  if (!res.ok) throw new Error("Obunani saqlashda xatolik");
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    try {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    } catch {}
    await sub.unsubscribe();
  }
}

/** Qurilmada bildirishnoma ko'rinishini sinash (push serverisiz, mahalliy) */
export async function testLocalNotification(): Promise<void> {
  if (!pushSupported()) throw new Error("Qo'llab-quvvatlanmaydi");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Ruxsat berilmadi");
  await reg.showNotification("🔔 Sinov — Musaffo Tea", {
    body: "Push bildirishnoma ishlayapti ✓",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "ogoh-test",
    requireInteraction: true,
    data: { url: "/ogohlantirish" },
  });
}
