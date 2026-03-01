"use client";

interface Court {
  name: string;
  game_type: string | null;
  players: {
    id: string;
    full_name: string;
    level: number | null;
    gender: string | null;
  }[];
}

interface NextUpPanelProps {
  courts: Court[];
  round: number;
}

const AVATAR_COLORS = [
  "bg-violet-600",
  "bg-cyan-600",
  "bg-orange-700",
  "bg-green-700",
  "bg-red-700",
  "bg-indigo-600",
  "bg-teal-600",
  "bg-amber-700",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function NextUpPanel({ courts, round }: NextUpPanelProps) {
  if (courts.length === 0) return null;

  return (
    <div className="mt-4">
      {/* Banner */}
      <div className="mx-0 mb-3 flex items-center gap-3 rounded-xl border border-blue-800 bg-blue-950/50 px-4 py-2.5">
        <span className="text-lg">🔜</span>
        <div>
          <p className="text-sm font-semibold text-blue-300">
            Next Up — Round {round}
          </p>
          <p className="text-xs text-zinc-500">Get ready!</p>
        </div>
      </div>

      {/* Courts */}
      <div className="space-y-3">
        {courts.map((court, i) => (
          <div
            key={i}
            className="rounded-xl border border-blue-900 bg-blue-950/30 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">
                {court.name}
              </span>
              {court.game_type && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    court.game_type === "mixed"
                      ? "bg-teal-900/50 text-teal-300"
                      : "bg-blue-900/50 text-blue-300"
                  }`}
                >
                  {court.game_type === "mixed" ? "Mixed" : "Doubles"}
                </span>
              )}
            </div>

            {court.players.length >= 4 ? (
              <div className="flex items-center gap-2">
                {/* Team A */}
                <div className="flex-1 space-y-1">
                  {court.players.slice(0, 2).map((p) => (
                    <PlayerRow key={p.id} player={p} />
                  ))}
                </div>
                <span className="text-xs font-bold text-zinc-600">vs</span>
                {/* Team B */}
                <div className="flex-1 space-y-1">
                  {court.players.slice(2, 4).map((p) => (
                    <PlayerRow key={p.id} player={p} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {court.players.map((p) => (
                  <PlayerRow key={p.id} player={p} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerRow({
  player,
}: {
  player: { id: string; full_name: string; level: number | null };
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white ${getAvatarColor(player.id)}`}
      >
        {getInitials(player.full_name)}
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-200">
          {player.full_name}
        </p>
        {player.level && (
          <p className="text-[10px] text-zinc-500">Lvl {player.level}</p>
        )}
      </div>
    </div>
  );
}
