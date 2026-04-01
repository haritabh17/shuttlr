"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface PartnerStats {
  partner_id: string;
  partner_name: string;
  times_paired: number;
}

export function PlayerPartnerModal({
  playerId,
  playerName,
  sessionId,
  onClose,
  nicknameMap,
}: {
  playerId: string;
  playerName: string;
  sessionId: string;
  onClose: () => void;
  nicknameMap?: Record<string, string>;
}) {
  const [partners, setPartners] = useState<PartnerStats[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadPartners() {
      const { data, error } = await (supabase as any)
        .from("partner_history")
        .select(`
          times_paired,
          player1_id,
          player2_id
        `)
        .eq("session_id", sessionId)
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .order("times_paired", { ascending: false });

      if (error) {
        console.error("Failed to load partners:", error);
        setLoading(false);
        return;
      }

      const partnerIds = (data ?? []).map((ph: any) =>
        ph.player1_id === playerId ? ph.player2_id : ph.player1_id
      );

      if (partnerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", partnerIds);

        const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

        const enriched = (data ?? []).map((ph: any) => {
          const partnerId = ph.player1_id === playerId ? ph.player2_id : ph.player1_id;
          return {
            partner_id: partnerId,
            partner_name: nameMap.get(partnerId) || "Unknown",
            times_paired: ph.times_paired,
          };
        });

        setPartners(enriched);
      }

      setLoading(false);
    }

    loadPartners();
  }, [playerId, sessionId, supabase]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Partners — {playerName}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-center text-zinc-500 py-4">Loading...</p>
        ) : partners.length === 0 ? (
          <p className="text-center text-zinc-500 py-4">
            No partners yet — stats appear after Round 1
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {partners.map((p) => (
              <div
                key={p.partner_id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
              >
                <span className="text-sm text-zinc-900 dark:text-zinc-100">
                  {nicknameMap?.[p.partner_id] || p.partner_name}
                </span>
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {p.times_paired}× played
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}