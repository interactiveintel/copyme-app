// ---------------------------------------------------------------------------
// Phone-prefix → currency mapping (v4.16.6, F6a follow-up)
// ---------------------------------------------------------------------------
//
// At signup, derive the user's preferredCurrency from their phone's
// E.164 country prefix. Eurozone members default to EUR; everyone else
// stays on the schema default USD. The user can still flip later from
// Profile → Settings (shipped in v4.16.2).
//
// Why: beta tester Joze (Slovenia, +386...) signed up and immediately
// saw "$0.00" in his VAP wallet because the schema's @default(USD)
// applied unconditionally. v4.16.2 gave him a manual picker; this
// removes the friction entirely for new EU users.
//
// Scope deliberately narrow: Eurozone members only (the 20 countries
// that use € as their official currency). Other currencies (GBP, CHF,
// SEK, NOK, PLN, etc.) are NOT supported by the schema's Currency enum
// (USD | EUR only), so adding them would 500 the VapAccount create.
// ---------------------------------------------------------------------------

/**
 * Eurozone E.164 country-code prefixes (20 members as of 2026).
 * Listed longest-first so the matcher returns the most-specific prefix
 * (e.g. "351" Portugal beats a hypothetical "35" prefix).
 */
const EUROZONE_PREFIXES = [
  // 3-digit prefixes first
  "351", // Portugal
  "353", // Ireland
  "356", // Malta
  "357", // Cyprus
  "358", // Finland
  "370", // Lithuania
  "371", // Latvia
  "372", // Estonia
  "386", // Slovenia
  "421", // Slovakia
  // 2-digit prefixes
  "30",  // Greece
  "31",  // Netherlands
  "32",  // Belgium
  "33",  // France
  "34",  // Spain
  "39",  // Italy
  "43",  // Austria
  "49",  // Germany
] as const;

// Single-digit Eurozone prefix doesn't exist — keeps the matcher
// simple. Croatia (+385) joined the Eurozone in 2023; included via
// its 3-digit prefix.
const EUROZONE_3D_EXTRA = ["385"]; // Croatia

const ALL_PREFIXES = [...EUROZONE_PREFIXES, ...EUROZONE_3D_EXTRA].sort(
  (a, b) => b.length - a.length, // longest first
);

/** Strip + and any non-digit characters from a raw phone string. */
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Look at the leading digits of an E.164 phone number and return the
 * default currency for that region. Defaults to USD for anything we
 * don't recognize — safest fallback because the Currency enum only
 * allows USD | EUR and we don't want a signup-time 500.
 */
export function currencyForPhone(rawPhone: string): "USD" | "EUR" {
  const digits = normalizePhone(rawPhone);
  if (!digits) return "USD";
  for (const prefix of ALL_PREFIXES) {
    if (digits.startsWith(prefix)) return "EUR";
  }
  return "USD";
}

/**
 * ISO 3166-1 alpha-2 country codes for Eurozone members. The OTP-
 * signup flow (/api/auth/phone/complete) captures `countryIso2`
 * directly from the phone picker, so we can decide currency without
 * re-parsing the phone string.
 */
const EUROZONE_ISO2 = new Set([
  "AT", // Austria
  "BE", // Belgium
  "HR", // Croatia
  "CY", // Cyprus
  "EE", // Estonia
  "FI", // Finland
  "FR", // France
  "DE", // Germany
  "GR", // Greece
  "IE", // Ireland
  "IT", // Italy
  "LV", // Latvia
  "LT", // Lithuania
  "LU", // Luxembourg
  "MT", // Malta
  "NL", // Netherlands
  "PT", // Portugal
  "SK", // Slovakia
  "SI", // Slovenia
  "ES", // Spain
]);

/** Same idea as currencyForPhone but for the ISO 3166-1 alpha-2 code
 *  collected during OTP signup. */
export function currencyForCountryIso2(iso2: string): "USD" | "EUR" {
  return EUROZONE_ISO2.has(iso2.toUpperCase()) ? "EUR" : "USD";
}
