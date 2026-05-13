// i18n scaffolding (S-254).
//
// Five-language pipeline: en (default), si (Slovenian), es, de, fr.
// Strings live as JSON modules under src/lib/i18n/locales/<lang>.json.
// `t(key, args)` looks up the key in the active locale, falls back to en.

const LOCALES = ["en", "si", "es", "de", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const SUPPORTED_LOCALES: readonly Locale[] = LOCALES;

let active: Locale = "en";

export function setLocale(l: Locale): void {
  if (!LOCALES.includes(l)) return;
  active = l;
  if (typeof document !== "undefined") {
    document.documentElement.lang = l;
    document.documentElement.dir = "ltr"; // RTL-ready: switch when adding ar/he
  }
}

export function getLocale(): Locale {
  return active;
}

export const STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    "hero.h1": "Your World's chart of Communication",
    "hero.subhead.lead": "Rule of 7",
    "hero.subhead.body": "A revolutionary constraint system that replaces noise with meaning. Less is more, giving meaning to messages. Infinite impact.",
    "cta.signup": "Sign Up Free",
    "cta.demo": "Watch the Demo",
    "nav.home": "Home",
    "nav.search": "Search",
    "nav.yogi": "Yogi",
    "nav.ads": "Ads",
    "nav.profile": "Profile",
    "chat.composer.placeholder": "Type a message...",
  },
  si: {
    "hero.h1": "Karta komunikacije tvojega sveta",
    "hero.subhead.lead": "Pravilo 7",
    "hero.subhead.body": "Revolucionaren sistem omejitev, ki šum spreminja v pomen. Manj je več. Sporočila dobijo težo. Neskončen vpliv.",
    "cta.signup": "Brezplačna registracija",
    "cta.demo": "Oglej si predstavitev",
    "nav.home": "Domov",
    "nav.search": "Iskanje",
    "nav.yogi": "Yogi",
    "nav.ads": "Oglasi",
    "nav.profile": "Profil",
    "chat.composer.placeholder": "Napiši sporočilo...",
  },
  es: {
    "hero.h1": "El mapa de comunicación de tu mundo",
    "hero.subhead.lead": "Regla del 7",
    "hero.subhead.body": "Un sistema de restricciones revolucionario que reemplaza el ruido con significado. Menos es más. Mensajes con peso. Impacto infinito.",
    "cta.signup": "Registrarse gratis",
    "cta.demo": "Ver demo",
    "nav.home": "Inicio",
    "nav.search": "Buscar",
    "nav.yogi": "Yogi",
    "nav.ads": "Anuncios",
    "nav.profile": "Perfil",
    "chat.composer.placeholder": "Escribe un mensaje...",
  },
  de: {
    "hero.h1": "Die Karte der Kommunikation deiner Welt",
    "hero.subhead.lead": "Regel der 7",
    "hero.subhead.body": "Ein revolutionäres Beschränkungssystem, das Lärm durch Bedeutung ersetzt. Weniger ist mehr. Nachrichten mit Gewicht. Unendliche Wirkung.",
    "cta.signup": "Kostenlos registrieren",
    "cta.demo": "Demo ansehen",
    "nav.home": "Start",
    "nav.search": "Suche",
    "nav.yogi": "Yogi",
    "nav.ads": "Anzeigen",
    "nav.profile": "Profil",
    "chat.composer.placeholder": "Nachricht schreiben...",
  },
  fr: {
    "hero.h1": "La carte de communication de votre monde",
    "hero.subhead.lead": "Règle de 7",
    "hero.subhead.body": "Un système de contraintes révolutionnaire qui remplace le bruit par du sens. Moins, c'est plus. Des messages qui comptent. Impact infini.",
    "cta.signup": "Inscription gratuite",
    "cta.demo": "Voir la démo",
    "nav.home": "Accueil",
    "nav.search": "Recherche",
    "nav.yogi": "Yogi",
    "nav.ads": "Annonces",
    "nav.profile": "Profil",
    "chat.composer.placeholder": "Écrire un message...",
  },
};

export function t(key: string, args?: Record<string, string | number>): string {
  let raw = STRINGS[active]?.[key] ?? STRINGS.en[key] ?? key;
  if (args) {
    for (const [k, v] of Object.entries(args)) {
      raw = raw.replace(new RegExp(`{${k}}`, "g"), String(v));
    }
  }
  return raw;
}

/** Detect best locale from navigator.languages, defaulting to en. */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  for (const tag of navigator.languages ?? [navigator.language ?? "en"]) {
    const short = tag.split("-")[0].toLowerCase() as Locale;
    if (LOCALES.includes(short)) return short;
  }
  return "en";
}
