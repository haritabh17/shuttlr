import Link from "next/link";

interface ClubCardProps {
  club: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    visibility: string;
    created_at: string;
  };
  role: "manager" | "player";
}

export function ClubCard({ club, role }: ClubCardProps) {
  return (
    <Link
      href={`/clubs/${club.slug}`}
      className="block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-zinc-900 dark:text-zinc-50">
          {club.name}
        </h4>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            role === "manager"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          }`}
        >
          {role}
        </span>
      </div>
      {club.description && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
          {club.description}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
        <span className="capitalize">{club.visibility}</span>
      </div>
    </Link>
  );
}
