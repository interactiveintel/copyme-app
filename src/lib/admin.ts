// ---------------------------------------------------------------------------
// Admin access gate.
//
// The admin surface (/admin/metrics and /api/admin/*) is guarded by an
// allow-list of user UUIDs supplied via the ADMIN_USER_IDS env var
// (comma-separated). We intentionally don't add an isAdmin boolean to
// the User table — there's no DB migration risk and promoting / demoting
// someone is a one-line env-var change on Vercel.
//
// Until ADMIN_USER_IDS is set, the admin surface returns 403 to everyone,
// including the founders. Explicit opt-in only.
// ---------------------------------------------------------------------------

export function adminUserIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return adminUserIds().has(userId.toLowerCase());
}
