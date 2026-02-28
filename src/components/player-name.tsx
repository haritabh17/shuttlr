export function PlayerName({
  name,
  gender,
  className = "",
}: {
  name: string;
  gender?: string | null;
  className?: string;
}) {
  const icon = gender === "F" ? "♀" : gender === "M" ? "♂" : null;
  const color =
    gender === "F"
      ? "text-pink-500"
      : gender === "M"
        ? "text-blue-500"
        : "text-zinc-400";

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {name}
      {icon && <span className={`text-xs ${color}`}>{icon}</span>}
    </span>
  );
}
