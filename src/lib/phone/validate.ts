// Phone number validation + E.164 formatting (S-007).
// We deliberately avoid pulling in libphonenumber here — its bundle weight
// (~250KB) is unjustified for the small set of countries we ship. The
// per-country `nsnLengths` table in `./countries.ts` is enough for sign-up.

import { COUNTRIES, findCountryByIso2, type Country } from "./countries";

export interface ValidationOk {
  valid: true;
  /** Canonical E.164 form, e.g. "+38631234567". */
  e164: string;
  country: Country;
  /** Just the digits after the dial code. */
  nsn: string;
}

export interface ValidationErr {
  valid: false;
  reason:
    | "EMPTY"
    | "UNKNOWN_COUNTRY"
    | "NOT_DIGITS"
    | "TOO_SHORT"
    | "TOO_LONG"
    | "WRONG_LENGTH";
}

export type ValidationResult = ValidationOk | ValidationErr;

/** Strip everything except 0-9. */
export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * Validate a (countryIso2, localNumber) pair and return E.164 on success.
 *
 * `localNumber` may include spaces, parentheses, or a leading "0" trunk prefix
 * (common in EU dial habits — e.g. SI users type "031 234 567"). The trunk
 * "0" is stripped before length-checking.
 */
export function validatePhone(iso2: string, localNumber: string): ValidationResult {
  if (!localNumber || !localNumber.trim()) {
    return { valid: false, reason: "EMPTY" };
  }
  const country = findCountryByIso2(iso2);
  if (!country) {
    return { valid: false, reason: "UNKNOWN_COUNTRY" };
  }

  let nsn = digitsOnly(localNumber);
  // Strip trunk-prefix "0" (used in many EU countries).
  if (nsn.startsWith("0")) nsn = nsn.replace(/^0+/, "");

  if (nsn.length === 0) {
    return { valid: false, reason: "NOT_DIGITS" };
  }
  const minLen = Math.min(...country.nsnLengths);
  const maxLen = Math.max(...country.nsnLengths);
  if (nsn.length < minLen) return { valid: false, reason: "TOO_SHORT" };
  if (nsn.length > maxLen) return { valid: false, reason: "TOO_LONG" };
  if (!country.nsnLengths.includes(nsn.length)) {
    return { valid: false, reason: "WRONG_LENGTH" };
  }

  return {
    valid: true,
    e164: `+${country.dialCode}${nsn}`,
    country,
    nsn,
  };
}

/**
 * Parse an already-formed E.164 string back into (country, nsn). Returns null
 * if no country in `COUNTRIES` matches.
 */
export function parseE164(e164: string): { country: Country; nsn: string } | null {
  if (!e164.startsWith("+")) return null;
  const digits = e164.slice(1);
  // Match longest dial code first to disambiguate (e.g. "1" vs "12" vs "123").
  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dialCode)) {
      const nsn = digits.slice(c.dialCode.length);
      if (c.nsnLengths.includes(nsn.length)) {
        return { country: c, nsn };
      }
    }
  }
  return null;
}

/** Display formatting — currently a thin wrapper. Kept as a seam for later. */
export function formatPretty(e164: string): string {
  const parsed = parseE164(e164);
  if (!parsed) return e164;
  return `+${parsed.country.dialCode} ${parsed.nsn}`;
}
