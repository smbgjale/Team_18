import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { UploadForm } from "@/components/upload-form";

const STEPS = [
  {
    n: "01",
    title: "Photograph your room",
    text: "Any living room, bedroom, or dining space. Walls, windows, and doors stay where they are.",
  },
  {
    n: "02",
    title: "Choose a direction",
    text: "Modern or traditional, then a style that fits your home — from Scandinavian to African Heritage.",
  },
  {
    n: "03",
    title: "Open the 3D view",
    text: "Real shop products fill your design. Move, rotate, and swap them in interactive 3D at their listed sizes.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="home-hero relative isolate min-h-[calc(100svh-3.5rem)] overflow-hidden">
        <Image
          src="/hero-room.jpg"
          alt="An empty sunlit room waiting to be redesigned"
          fill
          priority
          sizes="100vw"
          className="home-hero-image object-cover"
        />
        <div className="home-hero-veil absolute inset-0" aria-hidden />

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-6xl flex-col justify-end px-4 pb-10 pt-16 sm:pb-16 sm:pt-20">
          <p className="home-rise notranslate font-heading text-[clamp(2.5rem,8vw,6.25rem)] leading-[0.92] font-medium tracking-[-0.04em] text-white">
            Gojjodesign
          </p>
          <h1 className="home-rise home-rise-delay-1 mt-4 max-w-xl font-heading text-xl leading-snug text-white/95 sm:text-2xl md:text-[1.75rem]">
            Redesign your room in interactive 3D with pieces you can buy.
          </h1>
          <p className="home-rise home-rise-delay-2 mt-3 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">
            Upload a photo, furnish with real partner-shop products, and arrange them in a 3D layout you can move, rotate, and swap.
          </p>
          <div className="home-rise home-rise-delay-3 mt-6 flex flex-wrap items-center gap-3">
            <a
              href="#start"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-medium text-[oklch(0.22_0.03_155)] transition hover:bg-white/90"
            >
              Design your room
              <ArrowDown className="size-4" />
            </a>
            <Link
              href="/shop"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/35 bg-white/5 px-5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
            >
              Browse the catalogue
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="start" className="home-panel scroll-mt-16 border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-14 lg:py-24">
          <div className="space-y-4 lg:sticky lg:top-24">
            <p className="font-heading text-sm tracking-[0.18em] text-[oklch(0.45_0.06_155)] uppercase">
              Start here
            </p>
            <h2 className="font-heading text-3xl leading-tight tracking-tight sm:text-4xl">
              Drop in a photo of the room you want to change.
            </h2>
            <p className="max-w-md text-muted-foreground">
              Pick modern or traditional for your home, then continue into styles, real products, and your 3D layout.
            </p>
          </div>
          <div className="rounded-2xl border border-[oklch(0.88_0.02_95)] bg-[oklch(0.995_0.004_95)] p-5 shadow-[0_24px_60px_-36px_oklch(0.35_0.04_155/0.45)] sm:p-7">
            <UploadForm />
          </div>
        </div>
      </section>

      <section className="home-panel-alt">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="font-heading text-sm tracking-[0.18em] text-[oklch(0.45_0.06_155)] uppercase">
            How it works
          </p>
          <h2 className="mt-3 max-w-2xl font-heading text-3xl leading-tight tracking-tight sm:text-4xl">
            From an empty corner to a shoppable 3D room.
          </h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step) => (
              <li key={step.n} className="relative">
                <span className="font-heading text-5xl leading-none text-[oklch(0.82_0.04_155)]">
                  {step.n}
                </span>
                <h3 className="mt-4 font-heading text-xl tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12 sm:flex-row sm:items-end sm:justify-between sm:py-16">
          <div className="max-w-xl">
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">
              3D first. Real products throughout.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Gojjodesign opens in an interactive 3D layout so you can place products at their listed sizes.
              A 3D-style preview image is available when you want a rendered still.
            </p>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-sm font-medium text-[oklch(0.35_0.07_155)] transition hover:text-[oklch(0.28_0.07_155)]"
          >
            See products in the catalogue
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
