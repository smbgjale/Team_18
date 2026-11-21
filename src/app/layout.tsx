import type { Metadata } from "next";
import "@fontsource/fraunces/latin-400.css";
import "@fontsource/fraunces/latin-500.css";
import "@fontsource/fraunces/latin-600.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import { GoogleTranslate } from "@/components/google-translate";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gojjodesign: interactive 3D room redesign and shop-the-look",
  description:
    "Upload a room photo, explore an interactive 3D layout with real furniture, and shop matching pieces from partner catalogues.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <GoogleTranslate />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <footer className="border-t bg-[oklch(0.97_0.008_95)] py-8 text-center text-xs leading-relaxed text-muted-foreground">
          <div className="mx-auto max-w-3xl px-4">
            Gojjodesign MVP. The interactive 3D view places real catalogue products at their listed sizes.
            A 3D-style AI image may also be generated as a preview. Prices and availability come from partner
            shops and may change.
          </div>
        </footer>
      </body>
    </html>
  );
}
