"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SelectedPlayer {
  id: string;
  source: "court" | "pool";
}

interface SwapContextType {
  selected: SelectedPlayer | null;
  loading: boolean;
  select: (player: SelectedPlayer) => void;
  clear: () => void;
}

const SwapContext = createContext<SwapContextType>({
  selected: null,
  loading: false,
  select: () => {},
  clear: () => {},
});

export function useSwap() {
  return useContext(SwapContext);
}

export function SwapProvider({
  sessionId,
  enabled,
  children,
}: {
  sessionId: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<SelectedPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const doSwap = useCallback(async (player1Id: string, player2Id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player1Id, player2Id }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Swap failed:", data.error);
      }
    } catch (err) {
      console.error("Swap error:", err);
    }
    setLoading(false);
    setSelected(null);
    router.refresh();
  }, [sessionId, router]);

  const select = useCallback((player: SelectedPlayer) => {
    if (!enabled) return;

    if (!selected) {
      // First tap — select
      setSelected(player);
      return;
    }

    if (selected.id === player.id) {
      // Same player — deselect
      setSelected(null);
      return;
    }

    // Second tap — at least one must be on court
    if (selected.source === "pool" && player.source === "pool") {
      // Both in pool — just switch selection
      setSelected(player);
      return;
    }

    // Execute swap
    doSwap(selected.id, player.id);
  }, [enabled, selected, doSwap]);

  const clear = useCallback(() => setSelected(null), []);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <SwapContext.Provider value={{ selected, loading, select, clear }}>
      {children}
    </SwapContext.Provider>
  );
}
