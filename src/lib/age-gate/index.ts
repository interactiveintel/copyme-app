// Age-of-digital-consent gate (S-110).
//
// We don't ship country-specific age tables for every territory; we ship the
// ones we care about and default to 16 (CopyMe's house minimum, per Terms §2)
// for the rest. This is intentionally conservative.

const COUNTRY_MIN_AGE: Record<string, number> = {
  // EU GDPR allows member states to set 13–16; we list known choices.
  at: 14,
  be: 13,
  bg: 14,
  cy: 14,
  cz: 15,
  de: 16,
  dk: 13,
  ee: 13,
  es: 14,
  fi: 13,
  fr: 15,
  gr: 15,
  hr: 16,
  hu: 16,
  ie: 16,
  it: 14,
  lt: 14,
  lu: 16,
  lv: 13,
  mt: 13,
  nl: 16,
  pl: 16,
  pt: 13,
  ro: 16,
  se: 13,
  si: 15,
  sk: 16,
  // Non-EU
  ch: 16,
  gb: 13,
  no: 13,
  // US — COPPA = 13.
  us: 13,
  ca: 13,
  // Catch-alls fall through to default (16).
};

export const HOUSE_MINIMUM = 16;

export function minAgeForCountry(iso2: string): number {
  return COUNTRY_MIN_AGE[iso2.toLowerCase()] ?? HOUSE_MINIMUM;
}

/** True if a person born `birthdate` is at least the minimum age for `iso2`. */
export function meetsAgeGate(iso2: string, birthdate: Date, now: Date = new Date()): boolean {
  const min = minAgeForCountry(iso2);
  const age = computeAge(birthdate, now);
  return age >= min;
}

export function computeAge(birthdate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthdate.getFullYear();
  const m = now.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthdate.getDate())) age--;
  return age;
}

export interface GateResult {
  allowed: boolean;
  minAge: number;
  ageProvided: number;
  countryIso2: string;
}

export function checkAge(iso2: string, birthdate: Date, now: Date = new Date()): GateResult {
  const min = minAgeForCountry(iso2);
  const age = computeAge(birthdate, now);
  return { allowed: age >= min, minAge: min, ageProvided: age, countryIso2: iso2.toLowerCase() };
}
