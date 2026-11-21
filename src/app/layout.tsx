import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HOMELY AI: 3D-style room redesign and shop-the-look",
  description: "Upload a room photo, get a 3D-style AI redesign, and find matching furniture from integrated shops.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <footer className="border-t py-6 text-center text-xs text-muted-foreground">
          HOMELY AI MVP. Designs are AI-generated 3D-style images, not editable 3D models. Prices and availability come from partner shops and may change.
        </footer>
      </body>
    </html>
  );
}
