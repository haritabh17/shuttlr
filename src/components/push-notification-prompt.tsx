"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PushNotificationPrompt() {
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");

  const supabase = createClient();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "granted") {
      // Already granted — make sure subscription is saved (delay to let auth settle)
      const timer = setTimeout(() => registerAndSave(), 1500);
      return () => clearTimeout(timer);
    }
    if (Notification.permission === "denied") return;
    // Show prompt after a short delay
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function registerAndSave() {
    try {
      setStatus("loading");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Convert base64url VAPID key to Uint8Array
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const padding = "=".repeat((4 - (vapidKey.length % 4)) % 4);
      const base64 = (vapidKey + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray,
      });

      const json = subscription.toJSON();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const resp = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh!,
          auth: json.keys!.auth!,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        console.error("Push subscription save failed:", err);
      } else {
        console.log("Push subscription saved successfully");
      }

      setStatus("granted");
      setShow(false);
    } catch (err: any) {
      console.error("Push registration failed:", err);
      setStatus("denied");
    }
  }

  async function handleEnable() {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      await registerAndSave();
    } else {
      setStatus("denied");
      setShow(false);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-in slide-in-from-bottom rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/30">
          <span className="text-lg">🔔</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Enable notifications?
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Get notified when you&apos;re selected for the next court
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleEnable}
              disabled={status === "loading"}
              className="rounded-lg bg-teal-500/10 border border-teal-500/30 px-3 py-1.5 text-xs font-medium text-teal-600 hover:bg-teal-500/20 dark:text-teal-400 disabled:opacity-50"
            >
              {status === "loading" ? "Enabling..." : "Enable"}
            </button>
            <button
              onClick={() => setShow(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
