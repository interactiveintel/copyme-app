"use client";

// BlockedUsersSheet — bottom sheet listing everyone the signed-in user has
// blocked, with an Unblock button per row.
//
// Mounted from ProfileScreen → Settings. Uses GET /api/users/blocked for
// the list and DELETE /api/blocks (RESTful collection — keep this one;
// the resource-style /api/users/:id/block was removed when the two
// implementations were consolidated) for unblock.

import { motion } from "framer-motion";
import { X, ShieldOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Avatar from "../ui/Avatar";

interface BlockRow {
  id: string;
  displayName: string;
  accountTier?: string | null;
  blockedAt: string;
  reason: string | null;
}

interface Props {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
}

export default function BlockedUsersSheet({ authFetch, onClose }: Props) {
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/users/blocked");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError("Couldn't load your blocked list.");
        return;
      }
      setRows(
        (data.data?.blocks ?? []).map((b: Partial<BlockRow>) => ({
          id: String(b.id ?? ""),
          displayName: String(b.displayName ?? "Unknown"),
          accountTier: b.accountTier ?? null,
          blockedAt: String(b.blockedAt ?? new Date().toISOString()),
          reason: b.reason ?? null,
        })),
      );
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = useCallback(
    async (userId: string) => {
      if (pending) return;
      setPending(userId);
      setError(null);
      try {
        const res = await authFetch("/api/blocks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          setError("Couldn't unblock. Try again.");
          return;
        }
        // Optimistic: drop the row from local state. Reload would also work
        // but feels laggy on slow networks.
        setRows((prev) => prev.filter((r) => r.id !== userId));
      } catch {
        setError("Network error.");
      } finally {
        setPending(null);
      }
    },
    [authFetch, pending],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
              <ShieldOff size={16} className="text-rose-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Blocked users</h3>
              <p className="text-[11px] text-slate-500">They can&apos;t see or message you.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
            aria-label="Close blocked users"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-xs text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {error}
            </p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-slate-500 text-sm font-medium">No one is blocked.</p>
              <p className="text-slate-400 text-xs mt-1">
                You can block someone from any chat&apos;s menu.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <Avatar name={row.displayName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {row.displayName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Blocked{" "}
                      {new Date(row.blockedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => unblock(row.id)}
                    disabled={pending === row.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-600 border border-purple-200 bg-white hover:bg-purple-50 disabled:opacity-50"
                  >
                    {pending === row.id ? "…" : "Unblock"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
