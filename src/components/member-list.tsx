"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayerName } from "./player-name";

interface Member {
  id: string;
  role: string;
  status: string;
  nickname: string | null;
  invited_name: string | null;
  invited_gender: string | null;
  invited_level: number | null;
  user: {
    id: string;
    full_name: string;
    email: string | null;
    gender: string | null;
    level: number | null;
  } | null;
}

function EditMemberModal({
  member,
  clubId,
  onClose,
}: {
  member: Member;
  clubId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const globalName = member.user?.full_name || member.invited_name || "";
  const gender = member.user?.gender || member.invited_gender || "";
  const level = member.invited_level ?? member.user?.level ?? 5;

  const [editNickname, setEditNickname] = useState(member.nickname || "");
  const [editGender, setEditGender] = useState(gender);
  const [editLevel, setEditLevel] = useState(level);
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch(`/api/clubs/${clubId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: member.id,
        nickname: editNickname || null,
        gender: editGender || null,
        level: editLevel,
      }),
    });
    setLoading(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Edit Member
        </h3>
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Name
            </label>
            <p className="mt-1 px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
              {globalName} <span className="text-xs">(global profile)</span>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Club nickname <span className="text-xs font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              placeholder={globalName}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Gender
              </label>
              <select
                value={editGender}
                onChange={(e) => setEditGender(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">—</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Level (1-10)
              </label>
              <input
                type="number"
                value={editLevel}
                onChange={(e) => setEditLevel(Number(e.target.value))}
                min={1}
                max={10}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MemberList({
  members,
  isManager,
  clubId,
}: {
  members: Member[];
  isManager: boolean;
  clubId?: string;
}) {
  const router = useRouter();
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  async function changeRole(memberId: string, newRole: string, name: string) {
    const action = newRole === "manager" ? "Promote" : "Demote";
    if (!clubId || !confirm(`${action} ${name} to ${newRole}?`)) return;
    await fetch(`/api/clubs/${clubId}/members`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role: newRole }),
    });
    router.refresh();
  }

  async function removeMember(memberId: string, name: string) {
    if (!clubId || !confirm(`Remove ${name} from the club?`)) return;
    await fetch(`/api/clubs/${clubId}/members?memberId=${memberId}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-zinc-500 dark:text-zinc-400">No members yet.</p>
      </div>
    );
  }

  return (
    <>
      {editingMember && clubId && (
        <EditMemberModal
          member={editingMember}
          clubId={clubId}
          onClose={() => setEditingMember(null)}
        />
      )}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
                Name
              </th>
              {isManager && (
                <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Level
                </th>
              )}
              <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
                Role
              </th>
              {isManager && (
                <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const displayName = member.nickname || member.user?.full_name || member.invited_name || "Unknown";
              const name = displayName;
              const gender = member.user?.gender || member.invited_gender;
              const level = member.invited_level ?? member.user?.level;

              return (
                <tr
                  key={member.id}
                  className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/50"
                >
                  <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100">
                    <PlayerName name={name} gender={gender} />
                    {member.user?.email && (
                      <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                        {member.user.email}
                      </span>
                    )}
                  </td>
                  {isManager && (
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                      {level ?? "—"}
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        member.role === "manager"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}
                    >
                      {member.role}
                    </span>
                  </td>
                  {isManager && (
                    <td className="px-4 py-2.5 text-right space-x-2">
                      <button
                        onClick={() => setEditingMember(member)}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>
                      {member.role === "player" && (
                        <button
                          onClick={() => changeRole(member.id, "manager", name)}
                          className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                          Promote
                        </button>
                      )}
                      {member.role === "manager" && (
                        <button
                          onClick={() => changeRole(member.id, "player", name)}
                          className="text-xs text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
                        >
                          Demote
                        </button>
                      )}
                      <button
                        onClick={() => removeMember(member.id, name)}
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
