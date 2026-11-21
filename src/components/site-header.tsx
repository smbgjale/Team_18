import Link from "next/link";
import { Home } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Home className="size-4" />
          </span>
          HOMELY AI
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Design a room</Link>
          <Link href="/shop" className="hover:text-foreground">Shop catalogue</Link>
        </nav>
      </div>
    </header>
  );
}
