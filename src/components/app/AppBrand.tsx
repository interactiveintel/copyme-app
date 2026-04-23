"use client";

// ---------------------------------------------------------------------------
// AppBrand — small CopyMe wordmark sitting at the top of each in-app screen.
//
// Sits above the per-screen h1 (Messages, Discover, Yogi, Profile, ...) so
// the brand is always visible regardless of where in the app the user is.
// Compact by design — does not steal vertical space from the screen content.
// ---------------------------------------------------------------------------

interface AppBrandProps {
  className?: string;
}

export default function AppBrand({ className = "" }: AppBrandProps) {
  return (
    <div className={`inline-flex items-center gap-0.5 select-none ${className}`}>
      <span className="text-sm font-extrabold tracking-tight text-slate-900">
        Copy
      </span>
      <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
        Me
      </span>
    </div>
  );
}
