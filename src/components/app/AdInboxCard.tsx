"use client";

import { ExternalLink, Image as ImageIcon, Sparkles } from "lucide-react";

// ---------------------------------------------------------------------------
// AdInboxCard — the visual representation of a business ad as it will be
// rendered in a consumer's ad inbox / marketplace. Used both by the consumer
// inbox UI and the live preview in /business/ads.
//
// NOTE (follow-up): the consumer InboxScreen.tsx still has its own inline
// ad-tile JSX. A future refactor should swap that to import AdInboxCard so
// the two stay perfectly in sync. This component matches the marketplace
// detail look (header gradient + brand row + body + CTA) which is what the
// user actually clicks through to read the ad.
// ---------------------------------------------------------------------------

export interface AdInboxCardProps {
  brand: string;
  title: string;
  tagline?: string | null;
  body: string;
  imageUrl?: string | null;
  ctaLabel: string;
  ctaUrl?: string;
  /** Tags shown as "Matches your interest in …". */
  sharedInterests?: string[];
}

const PLACEHOLDER_BODY =
  "Your ad copy will appear here. Keep it warm, useful, and respectful of the reader's time.";

export function AdInboxCard({
  brand,
  title,
  tagline,
  body,
  imageUrl,
  ctaLabel,
  ctaUrl,
  sharedInterests = [],
}: AdInboxCardProps) {
  const safeBrand = brand.trim() || "Your brand";
  const safeTitle = title.trim() || "Your ad title";
  const safeTagline = tagline?.trim() || "";
  const safeBody = body.trim() || PLACEHOLDER_BODY;
  const safeCtaLabel = ctaLabel.trim() || "Learn more";

  return (
    <div className="w-full rounded-3xl overflow-hidden shadow-xl bg-white border border-slate-100 max-w-sm">
      {/* Hero banner */}
      <div className="relative w-full h-40 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full border-[3px] border-white" />
          <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full border-[3px] border-white" />
        </div>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={safeTitle}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="relative flex flex-col items-center justify-center text-center px-4">
            <ImageIcon size={22} className="text-white/80 mb-1" />
            <p className="text-white text-base font-bold leading-snug line-clamp-2">{safeTitle}</p>
            {safeTagline && (
              <p className="text-white/75 text-[11px] mt-0.5 line-clamp-1">{safeTagline}</p>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Match-reason chip */}
        {sharedInterests.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 mb-3">
            <Sparkles size={14} className="text-purple-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-0.5">
                Why CopyMe Agent picked this
              </p>
              <p className="text-xs text-purple-700/80 leading-relaxed">
                Surfaced because you&apos;re into {sharedInterests[0]}.
              </p>
            </div>
          </div>
        )}

        {/* Brand + Sponsored label */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">{safeBrand}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-slate-400">Sponsored</span>
              <span className="text-[10px] text-slate-300">·</span>
              <span className="text-[10px] text-purple-400">Live now</span>
            </div>
          </div>
        </div>

        {/* Title (also shown if image was rendered above) */}
        {imageUrl && (
          <p className="text-base font-bold text-slate-900 leading-snug mb-1">{safeTitle}</p>
        )}
        {safeTagline && imageUrl && (
          <p className="text-xs text-slate-500 mb-3">{safeTagline}</p>
        )}

        {/* Body copy */}
        <p className="text-sm text-slate-600 leading-relaxed mb-4 whitespace-pre-line">
          {safeBody}
        </p>

        {/* Shared-interest chips */}
        {sharedInterests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {sharedInterests.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-600 border border-purple-200"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <a
          href={ctaUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // In preview mode (no real URL), don't actually navigate.
            if (!ctaUrl) e.preventDefault();
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white text-sm font-semibold shadow-lg"
        >
          {safeCtaLabel}
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

export default AdInboxCard;
