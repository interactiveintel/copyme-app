"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  COUNTRIES,
  orderedCountries,
  findCountryByIso2,
  type Country,
} from "@/lib/phone/countries";
import { validatePhone, type ValidationResult } from "@/lib/phone/validate";

export interface PhoneInputProps {
  /** Default selected country ISO-2. Defaults to "si" (Slovenia) for the dogfood test. */
  defaultIso2?: string;
  /** Notified on every keystroke / country change with the latest validation result. */
  onChange?: (result: ValidationResult) => void;
  /** Placeholder for the local-number field. */
  placeholder?: string;
  /** Test hook so callers can target the inputs in snapshot tests. */
  idPrefix?: string;
}

export default function PhoneInput({
  defaultIso2 = "si",
  onChange,
  placeholder = "31 234 567",
  idPrefix = "phone",
}: PhoneInputProps) {
  const [iso2, setIso2] = useState(defaultIso2);
  const [local, setLocal] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const country: Country =
    findCountryByIso2(iso2) ?? findCountryByIso2(defaultIso2) ?? COUNTRIES[0];

  const list = useMemo(() => {
    const ordered = orderedCountries();
    if (!search.trim()) return ordered;
    const q = search.toLowerCase();
    return ordered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q.replace(/^\+/, "")) ||
        c.iso2.includes(q),
    );
  }, [search]);

  const emit = (nextIso: string, nextLocal: string) => {
    if (!onChange) return;
    onChange(validatePhone(nextIso, nextLocal));
  };

  return (
    <div className="w-full">
      <div className="flex items-stretch gap-2">
        {/* Country trigger */}
        <button
          type="button"
          id={`${idPrefix}-country`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Country code: ${country.name} +${country.dialCode}`}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <span aria-hidden="true">{country.flag}</span>
          <span className="tabular-nums">+{country.dialCode}</span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        {/* Local number */}
        <input
          id={`${idPrefix}-local`}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={placeholder}
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            emit(iso2, e.target.value);
          }}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          id={`${idPrefix}-list`}
          className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="sticky top-0 bg-white p-2 border-b border-slate-100">
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country or +code"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <ul>
            {list.map((c) => (
              <li key={c.iso2}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.iso2 === iso2}
                  onClick={() => {
                    setIso2(c.iso2);
                    setOpen(false);
                    setSearch("");
                    emit(c.iso2, local);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    c.iso2 === iso2 ? "bg-primary/5 text-primary" : "text-slate-700"
                  }`}
                >
                  <span aria-hidden="true" className="text-lg">{c.flag}</span>
                  <span className="flex-1">{c.name}</span>
                  <span className="tabular-nums text-slate-400">+{c.dialCode}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-slate-400">
                No countries match &ldquo;{search}&rdquo;.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
