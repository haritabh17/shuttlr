import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 py-6 text-center text-xs text-zinc-600">
      <div className="flex items-center justify-center gap-3">
        <span>Built for the love of the game 🏸</span>
        <span>·</span>
        <a
          href="https://github.com/haritabh17/shuttlrs"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-400 transition"
        >
          Open Source on GitHub
        </a>
        <span>·</span>
        <Link href="/terms" className="hover:text-zinc-400 transition">
          Terms & Privacy
        </Link>
      </div>
    </footer>
  );
}
