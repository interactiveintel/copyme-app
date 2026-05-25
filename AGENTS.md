<!-- BEGIN:nextjs-agent-rules -->
# Next.js 15.5 conventions — read before writing code in this repo

This project runs **Next.js 15.5.14 (App Router)** on **React 19.2.4**, deployed
to Vercel Fluid Compute (Node.js runtime by default). Defaults differ from
Next 14 / React 18 in ways your training data may not reflect. Before writing
or modifying any code in `src/app/`, `src/middleware.ts`, `next.config.ts`, or
`instrumentation*.ts`, verify against current Next.js 15 docs:

- Canonical reference: https://nextjs.org/docs/app
- Migration notes: https://nextjs.org/docs/app/guides/upgrading
- API reference: https://nextjs.org/docs/app/api-reference
- CSP guide (relevant to this repo's middleware): https://nextjs.org/docs/app/guides/content-security-policy

The path `node_modules/next/dist/docs/` does NOT exist in Next 15+ —
historical guidance pointed there but Next no longer bundles docs that way.
Use the URLs above.

## Verified conventions in this repo (do not break these)

**Route handlers (`src/app/api/**/route.ts`):**
- Dynamic params are `Promise<{...}>` — always `await params` before destructuring.
- `runtime = "nodejs"` is required on every route that touches Prisma,
  `@signalapp/libsignal-client`, or `bcryptjs`. Edge runtime cannot load
  native addons.
- `maxDuration` (seconds) overrides the 300s default per route — used for
  upload endpoints (avatar=15, message-media=30).

**Server-side APIs:**
- `cookies()`, `headers()`, `draftMode()` are **async** in Next 15 — `await` them.
- `fetch()` is no longer cached by default — opt into caching explicitly
  via `{ next: { revalidate: N } }` or `cache: 'force-cache'`.
- GET route handlers are no longer cached by default — pin
  `export const dynamic = "force-dynamic"` on auth-bound GETs as a
  defensive marker.

**next.config.ts:**
- `serverExternalPackages` (NOT `serverComponentsExternalPackages`).
- Static security headers live in `headers()` here. Per-request CSP with
  nonce lives in middleware (see `src/middleware.ts`).

**Middleware (`src/middleware.ts`):**
- Runs on Node.js by default in Next 15 + Vercel Fluid Compute. Prefer
  `jose` for JWT verification (works on both Edge and Node so future
  matcher changes don't break it).
- This repo's middleware sets a CSP nonce per request and forwards it
  via the `x-nonce` request header. The root layout consumes it to
  satisfy `script-src 'nonce-...'`. **Do not** revert to a static CSP
  in `next.config.ts` — the nonce-based policy in middleware is the
  source of truth.

**Instrumentation:**
- `instrumentation.ts` exports `register()` and `onRequestError` (Next 15
  hook) — Sentry's `captureRequestError` is wired here.
- Client-side Sentry boot lives in `instrumentation-client.ts` (Sentry
  SDK v10 pattern, not the legacy `sentry.client.config.ts`).

**React 19 specifics:**
- React Compiler is NOT enabled (no `experimental.reactCompiler` in
  next.config). `useCallback`/`useMemo` still load-bearing — don't strip them.
- `use()` is available; `useFormState` is renamed to `useActionState`.

## Deprecation notices to heed

Next 15.5.14 emits exactly two deprecation warnings; neither applies to
current code but new code must not introduce them:
- `next/amp` — built-in AMP support will be removed in Next 16.
- `config.experimental.turbo` — use `config.turbopack` instead.

If you find existing code violating any of the conventions above, fix it
in the same change rather than expanding the violation surface.
<!-- END:nextjs-agent-rules -->
