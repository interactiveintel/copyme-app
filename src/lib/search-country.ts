// ---------------------------------------------------------------------------
// Country-name → dial-code resolution for search (v4.16.23)
// ---------------------------------------------------------------------------
//
// UserLocation stores the country as a dial code (country_phone_code,
// varchar(10) — "+1", "+386"). No column anywhere holds the string
// "United States", so Joze's search for his contact's country could
// never match ("If I try to search for Paul Pereira as United States,
// Florida… still not find"). This helper turns a free-text query into
// the dial codes of any countries it names, so the search route can
// add `countryPhoneCode IN (...)` to its location OR-set.
//
// Reuses the canonical COUNTRIES list from the phone picker plus a few
// colloquial aliases the picker doesn't need.

import { COUNTRIES } from "@/lib/phone/countries";

const ALIASES: Record<string, string> = {
  usa: "+1",
  "u.s.": "+1",
  "u.s.a.": "+1",
  america: "+1",
  "united states of america": "+1",
  uk: "+44",
  "great britain": "+44",
  england: "+44",
  britain: "+44",
  holland: "+31",
  slovenija: "+386",
  deutschland: "+49",
  españa: "+34",
  espana: "+34",
  brasil: "+55",
};

/**
 * Return dial codes (with leading +) for every country the query names.
 * Matching is bidirectional-contains on names ≥4 chars ("United States"
 * matches the query "united states florida"), exact for short aliases
 * ("uk", "usa"). Empty array when the query names no known country —
 * the search route then skips the countryPhoneCode clause entirely.
 */
export function dialCodesForQuery(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const codes = new Set<string>();

  for (const c of COUNTRIES) {
    const name = c.name.toLowerCase();
    if (name.length >= 4 ? q.includes(name) || name.includes(q) : q === name) {
      codes.add(`+${c.dialCode}`);
    }
  }
  for (const [alias, code] of Object.entries(ALIASES)) {
    if (alias.length >= 4 ? q.includes(alias) : q === alias) {
      codes.add(code);
    }
  }
  return Array.from(codes);
}
