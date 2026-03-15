"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Member {
  nickname?: string;
  invited_name?: string;
  invited_gender?: string;
  invited_level?: number;
  status: string;
  role: string;
  user?: {
    full_name?: string;
    email?: string;
    gender?: string;
    level?: number;
  } | null;
}

interface ParsedRow {
  name: string;
  gender: string;
  level: number;
  email: string;
  error?: string;
}

export function ImportExportMembers({
  clubId,
  members,
  memberCount,
  memberLimit,
}: {
  clubId: string;
  members: Member[];
  memberCount: number;
  memberLimit: number;
}) {
  const [showImport, setShowImport] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: { name: string; reason: string }[];
    errors: { name: string; reason: string }[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleExport() {
    const header = "name,gender,level,email";
    const rows = members.map((m) => {
      const name = m.nickname || m.user?.full_name || m.invited_name || "";
      const gender = m.user?.gender || m.invited_gender || "";
      const level = m.invited_level ?? m.user?.level ?? "";
      const email = m.user?.email || "";
      return `"${name.replace(/"/g, '""')}",${gender},${level},${email}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());

      // Detect if first line is a header
      const firstLine = lines[0]?.toLowerCase();
      const hasHeader =
        firstLine?.includes("name") || firstLine?.includes("gender");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const rows: ParsedRow[] = dataLines.map((line) => {
        // Handle quoted CSV fields
        const fields = parseCSVLine(line);
        const [name = "", gender = "", levelStr = "", email = ""] = fields;
        const level = parseInt(levelStr, 10);

        const row: ParsedRow = {
          name: name.trim(),
          gender: gender.trim(),
          level: isNaN(level) ? 0 : level,
          email: email.trim(),
        };

        // Validate
        if (!row.name) row.error = "Name is required";
        else if (!normalizeGender(row.gender))
          row.error = "Gender must be M or F";
        else if (row.level < 1 || row.level > 10)
          row.error = "Level must be 1-10";

        return row;
      });

      setParsed(rows);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const valid = parsed.filter((r) => !r.error);
    if (valid.length === 0) return;

    if (memberCount + valid.length > memberLimit) {
      alert(
        `This would exceed the member limit (${memberLimit}). You have ${memberCount} members and are trying to add ${valid.length}.`
      );
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/members/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          members: valid.map((r) => ({
            name: r.name,
            gender: r.gender,
            level: r.level,
            email: r.email || null,
          })),
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.imported > 0) {
        router.refresh();
      }
    } catch {
      alert("Import failed. Please try again.");
    }
    setImporting(false);
  }

  function reset() {
    setParsed([]);
    setResult(null);
    setShowImport(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const validCount = parsed.filter((r) => !r.error).length;
  const errorCount = parsed.filter((r) => r.error).length;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Export CSV
      </button>
      <button
        onClick={() => setShowImport(true)}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Import CSV
      </button>

      {showImport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={reset}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Import Members
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              CSV format: <code>name,gender,level,email</code> (email is optional)
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="mt-4 block w-full text-sm text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-700 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
            />

            {parsed.length > 0 && !result && (
              <>
                <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                        <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                          Name
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                          Gender
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                          Level
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                          Email
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-t border-zinc-100 dark:border-zinc-800 ${
                            row.error
                              ? "bg-red-50 dark:bg-red-950/20"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100">
                            {row.name || "—"}
                          </td>
                          <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                            {row.gender || "—"}
                          </td>
                          <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                            {row.level || "—"}
                          </td>
                          <td className="px-3 py-2 text-zinc-400 dark:text-zinc-500">
                            {row.email || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {row.error ? (
                              <span className="text-xs text-red-500">
                                {row.error}
                              </span>
                            ) : (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {validCount} ready to import
                    {errorCount > 0 && (
                      <span className="text-red-500">
                        {" "}· {errorCount} with errors (will be skipped)
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={reset}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing || validCount === 0}
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      {importing
                        ? "Importing..."
                        : `Import ${validCount} members`}
                    </button>
                  </div>
                </div>
              </>
            )}

            {result && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  ✅ {result.imported} members imported
                </p>
                {result.skipped.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                      ⚠ {result.skipped.length} skipped (duplicates):
                    </p>
                    <ul className="mt-1 text-xs text-zinc-500">
                      {result.skipped.map((s, i) => (
                        <li key={i}>
                          {s.name} — {s.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-500">
                      ❌ {result.errors.length} errors:
                    </p>
                    <ul className="mt-1 text-xs text-zinc-500">
                      {result.errors.map((e, i) => (
                        <li key={i}>
                          {e.name} — {e.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={reset}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeGender(g: string): "M" | "F" | null {
  if (!g) return null;
  const n = g.trim().toUpperCase();
  if (n === "M" || n === "MALE") return "M";
  if (n === "F" || n === "FEMALE") return "F";
  return null;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}
