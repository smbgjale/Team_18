"use client";

import { Check, Languages } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "am", label: "Amharic", native: "አማርኛ" },
  { code: "om", label: "Afaan Oromoo", native: "Afaan Oromoo" },
] as const;

type LangCode = (typeof LANGUAGES)[number]["code"];

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeGoogTrans(lang: LangCode) {
  const value = lang === "en" ? "/en/en" : `/en/${lang}`;
  document.cookie = `googtrans=${value};path=/`;
  const host = window.location.hostname;
  if (host && host !== "localhost") {
    document.cookie = `googtrans=${value};domain=${host};path=/`;
  }
}

function clearGoogTrans() {
  const expires = "expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  document.cookie = `googtrans=;${expires}`;
  const host = window.location.hostname;
  if (host && host !== "localhost") {
    document.cookie = `googtrans=;domain=${host};${expires}`;
  }
}

function detectLanguage(): LangCode {
  const raw = readCookie("googtrans") ?? "";
  if (raw.includes("/am")) return "am";
  if (raw.includes("/om")) return "om";
  return "en";
}

function applyGoogleLanguage(lang: LangCode) {
  const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (!select) return false;

  const nextValue = lang === "en" ? "en" : lang;
  const options = Array.from(select.options).map((o) => o.value);
  const value =
    options.includes(nextValue)
      ? nextValue
      : lang === "en" && options.includes("")
        ? ""
        : nextValue;

  select.value = value;
  select.dispatchEvent(new Event("change"));
  return true;
}

function waitForTranslateCombo(timeoutMs = 4000) {
  return new Promise<HTMLSelectElement | null>((resolve) => {
    const existing = document.querySelector<HTMLSelectElement>(".goog-te-combo");
    if (existing) {
      resolve(existing);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");
      if (select || Date.now() - started > timeoutMs) {
        window.clearInterval(timer);
        resolve(select);
      }
    }, 100);
  });
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<LangCode>("en");

  useEffect(() => {
    setLang(detectLanguage());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LANGUAGES.find((item) => item.code === lang) ?? LANGUAGES[0];

  const choose = async (next: LangCode) => {
    setOpen(false);
    if (next === lang) return;

    if (next === "en") {
      clearGoogTrans();
      setLang("en");
      await waitForTranslateCombo();
      applyGoogleLanguage("en");
      window.location.reload();
      return;
    }

    writeGoogTrans(next);
    setLang(next);
    await waitForTranslateCombo();
    if (!applyGoogleLanguage(next)) window.location.reload();
  };

  return (
    <div ref={rootRef} className={cn("relative notranslate", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-9 max-w-[9.5rem] items-center gap-1.5 rounded-full border border-[oklch(0.88_0.02_95)]",
          "bg-[oklch(0.995_0.004_95)] px-2.5 text-sm font-medium text-[oklch(0.28_0.04_155)] sm:max-w-none sm:gap-2 sm:px-3",
          "shadow-[0_8px_24px_-18px_oklch(0.35_0.04_155/0.7)] transition",
          "hover:border-[oklch(0.72_0.05_155)] hover:bg-white",
          "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        )}
      >
        <Languages className="size-4 shrink-0 text-[oklch(0.42_0.07_155)]" />
        <span className="truncate">{current.native}</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Choose language"
          className={cn(
            "absolute right-0 z-50 mt-2 w-[min(13rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[oklch(0.88_0.02_95)]",
            "bg-[oklch(0.995_0.004_95)] p-1.5 shadow-[0_24px_50px_-28px_oklch(0.3_0.04_155/0.55)]",
          )}
        >
          {LANGUAGES.map((item) => {
            const active = item.code === lang;
            return (
              <button
                key={item.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(item.code)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  active
                    ? "bg-[oklch(0.94_0.025_155)] text-[oklch(0.28_0.05_155)]"
                    : "text-foreground hover:bg-[oklch(0.96_0.01_95)]",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-tight">{item.native}</span>
                  {item.native !== item.label ? (
                    <span className="block text-xs text-muted-foreground">{item.label}</span>
                  ) : (
                    <span className="block text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {item.code}
                    </span>
                  )}
                </span>
                {active ? <Check className="size-4 shrink-0 text-[oklch(0.42_0.07_155)]" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
