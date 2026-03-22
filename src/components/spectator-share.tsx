"use client";

import { useState } from "react";

function generatePin(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

export function SpectatorShareButton({ sessionId, currentPin }: { sessionId: string; currentPin: string | null }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState(currentPin || generatePin());
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [enabled, setEnabled] = useState(!!currentPin);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/sessions/${sessionId}/spectator`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      setEnabled(true);
    }
    setSaving(false);
  }

  async function handleDisable() {
    setSaving(true);
    await fetch(`/api/sessions/${sessionId}/spectator`, { method: "DELETE" });
    setEnabled(false);
    setSaving(false);
  }

  function copyLink() {
    const url = `${window.location.origin}/watch/${sessionId}`;
    const text = `Watch live: ${url}\nPIN: ${pin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareLink() {
    const url = `${window.location.origin}/watch/${sessionId}`;
    const text = `Watch our badminton session live!\n\n${url}\nPIN: ${pin}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Watch Session", text });
      } catch {
        copyLink();
      }
    } else {
      copyLink();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        📡 Share
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Spectator Link
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Share a view-only link with anyone — no sign-up needed.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  PIN
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-center font-mono text-lg tracking-wider dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    onClick={() => setPin(generatePin())}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    title="Generate new PIN"
                  >
                    🎲
                  </button>
                </div>
              </div>

              {!enabled ? (
                <button
                  onClick={handleSave}
                  disabled={saving || pin.length < 4}
                  className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? "Enabling..." : "Enable Spectator Link"}
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || pin.length < 4}
                    className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Update PIN"}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={shareLink}
                      className="flex-1 rounded-xl border border-teal-200 bg-teal-50 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50"
                    >
                      {copied ? "✅ Copied!" : "📋 Copy Link + PIN"}
                    </button>
                    <button
                      onClick={handleDisable}
                      disabled={saving}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                    >
                      Disable
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
