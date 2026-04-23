"use client";

// ---------------------------------------------------------------------------
// Global error boundary — catches React render errors anywhere in the App
// Router tree and reports them to Sentry. Required for Sentry to receive
// unhandled client-side render exceptions in App Router (page-level
// error.tsx files only catch errors below them in the tree).
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import NextError from "next/error";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        {/* `NextError` is the default Next.js error page component, which
            ships with sensible markup. We don't need a fancy UI here — this
            only renders when something has gone catastrophically wrong. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
