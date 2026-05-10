// Country dial-code metadata for the phone-auth picker (S-007).
// Pinned ordering: SI and US float to the top because Paul (US) and Jože (SI)
// are the two dogfood phones for the launch-readiness test (S-008).
//
// `nsnLengths` is the set of valid National Significant Number lengths
// (digits after the dial code) per the ITU E.164 numbering plan. It is used
// by `lib/phone/validate.ts`. Where ranges exist (e.g. UK 9–10) all valid
// integer lengths are listed.

export interface Country {
  /** ISO 3166-1 alpha-2 code, lowercased. */
  iso2: string;
  /** Display name in English. */
  name: string;
  /** E.164 dial code without the leading '+'. */
  dialCode: string;
  /** Unicode flag emoji. */
  flag: string;
  /** Allowed national-significant-number lengths. */
  nsnLengths: number[];
  /** Pinned to the top of the picker, ordered by `pinnedRank`. */
  pinned?: boolean;
  pinnedRank?: number;
}

export const COUNTRIES: Country[] = [
  // Pinned — Slovenia first per Jože's request.
  { iso2: "si", name: "Slovenia",       dialCode: "386", flag: "🇸🇮", nsnLengths: [8],     pinned: true, pinnedRank: 1 },
  { iso2: "us", name: "United States",  dialCode: "1",   flag: "🇺🇸", nsnLengths: [10],    pinned: true, pinnedRank: 2 },

  // Rest, alphabetical by English name.
  { iso2: "at", name: "Austria",        dialCode: "43",  flag: "🇦🇹", nsnLengths: [10, 11, 12, 13] },
  { iso2: "au", name: "Australia",      dialCode: "61",  flag: "🇦🇺", nsnLengths: [9] },
  { iso2: "be", name: "Belgium",        dialCode: "32",  flag: "🇧🇪", nsnLengths: [9] },
  { iso2: "br", name: "Brazil",         dialCode: "55",  flag: "🇧🇷", nsnLengths: [10, 11] },
  { iso2: "ca", name: "Canada",         dialCode: "1",   flag: "🇨🇦", nsnLengths: [10] },
  { iso2: "ch", name: "Switzerland",    dialCode: "41",  flag: "🇨🇭", nsnLengths: [9] },
  { iso2: "cn", name: "China",          dialCode: "86",  flag: "🇨🇳", nsnLengths: [11] },
  { iso2: "cz", name: "Czechia",        dialCode: "420", flag: "🇨🇿", nsnLengths: [9] },
  { iso2: "de", name: "Germany",        dialCode: "49",  flag: "🇩🇪", nsnLengths: [10, 11] },
  { iso2: "dk", name: "Denmark",        dialCode: "45",  flag: "🇩🇰", nsnLengths: [8] },
  { iso2: "es", name: "Spain",          dialCode: "34",  flag: "🇪🇸", nsnLengths: [9] },
  { iso2: "fi", name: "Finland",        dialCode: "358", flag: "🇫🇮", nsnLengths: [9, 10] },
  { iso2: "fr", name: "France",         dialCode: "33",  flag: "🇫🇷", nsnLengths: [9] },
  { iso2: "gb", name: "United Kingdom", dialCode: "44",  flag: "🇬🇧", nsnLengths: [9, 10] },
  { iso2: "gr", name: "Greece",         dialCode: "30",  flag: "🇬🇷", nsnLengths: [10] },
  { iso2: "hr", name: "Croatia",        dialCode: "385", flag: "🇭🇷", nsnLengths: [8, 9] },
  { iso2: "hu", name: "Hungary",        dialCode: "36",  flag: "🇭🇺", nsnLengths: [8, 9] },
  { iso2: "ie", name: "Ireland",        dialCode: "353", flag: "🇮🇪", nsnLengths: [9] },
  { iso2: "il", name: "Israel",         dialCode: "972", flag: "🇮🇱", nsnLengths: [8, 9] },
  { iso2: "in", name: "India",          dialCode: "91",  flag: "🇮🇳", nsnLengths: [10] },
  { iso2: "it", name: "Italy",          dialCode: "39",  flag: "🇮🇹", nsnLengths: [9, 10, 11] },
  { iso2: "jp", name: "Japan",          dialCode: "81",  flag: "🇯🇵", nsnLengths: [10, 11] },
  { iso2: "kr", name: "South Korea",    dialCode: "82",  flag: "🇰🇷", nsnLengths: [9, 10] },
  { iso2: "mx", name: "Mexico",         dialCode: "52",  flag: "🇲🇽", nsnLengths: [10] },
  { iso2: "nl", name: "Netherlands",    dialCode: "31",  flag: "🇳🇱", nsnLengths: [9] },
  { iso2: "no", name: "Norway",         dialCode: "47",  flag: "🇳🇴", nsnLengths: [8] },
  { iso2: "nz", name: "New Zealand",    dialCode: "64",  flag: "🇳🇿", nsnLengths: [8, 9, 10] },
  { iso2: "pl", name: "Poland",         dialCode: "48",  flag: "🇵🇱", nsnLengths: [9] },
  { iso2: "pt", name: "Portugal",       dialCode: "351", flag: "🇵🇹", nsnLengths: [9] },
  { iso2: "ro", name: "Romania",        dialCode: "40",  flag: "🇷🇴", nsnLengths: [9] },
  { iso2: "rs", name: "Serbia",         dialCode: "381", flag: "🇷🇸", nsnLengths: [8, 9, 10] },
  { iso2: "se", name: "Sweden",         dialCode: "46",  flag: "🇸🇪", nsnLengths: [8, 9] },
  { iso2: "sk", name: "Slovakia",       dialCode: "421", flag: "🇸🇰", nsnLengths: [9] },
  { iso2: "tr", name: "Turkey",         dialCode: "90",  flag: "🇹🇷", nsnLengths: [10] },
  { iso2: "ua", name: "Ukraine",        dialCode: "380", flag: "🇺🇦", nsnLengths: [9] },
  { iso2: "za", name: "South Africa",   dialCode: "27",  flag: "🇿🇦", nsnLengths: [9] },
];

/** Picker order: pinned countries first (by `pinnedRank`), then alphabetical by name. */
export function orderedCountries(): Country[] {
  const pinned = COUNTRIES.filter((c) => c.pinned)
    .sort((a, b) => (a.pinnedRank ?? 999) - (b.pinnedRank ?? 999));
  const rest = COUNTRIES.filter((c) => !c.pinned)
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...pinned, ...rest];
}

export function findCountryByIso2(iso2: string): Country | undefined {
  return COUNTRIES.find((c) => c.iso2 === iso2.toLowerCase());
}

export function findCountryByDialCode(dialCode: string): Country | undefined {
  // Multiple countries can share a dial code (e.g. +1 → US/CA). The pinned
  // one wins; otherwise first alphabetical.
  const candidates = COUNTRIES.filter((c) => c.dialCode === dialCode);
  const pinned = candidates.find((c) => c.pinned);
  if (pinned) return pinned;
  return [...candidates].sort((a, b) => a.name.localeCompare(b.name))[0];
}
