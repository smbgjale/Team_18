import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[oklch(0.88_0.015_95)] bg-[oklch(0.985_0.006_95/0.88)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4">
        <Link
          href="/"
          className="notranslate min-w-0 truncate font-heading text-base font-medium tracking-[-0.03em] text-[oklch(0.28_0.04_155)] sm:text-lg"
        >
          Gojjodesign
        </Link>
        <div className="flex shrink-0 items-center gap-3 sm:gap-6">
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link href="/#start" className="transition hover:text-foreground">
              Design a room
            </Link>
            <Link href="/shop" className="transition hover:text-foreground">
              Shop catalogue
            </Link>
          </nav>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
