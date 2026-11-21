import { Box, Palette, ShoppingBag } from "lucide-react";
import { UploadForm } from "@/components/upload-form";

const FEATURES = [
  { icon: Palette, title: "Modern or traditional", text: "Choose the look for your home, then a style within it: from Scandinavian and Industrial to Rustic Farmhouse and African Heritage." },
  { icon: ShoppingBag, title: "Real products", text: "Every design is furnished with real products from partner shops that fit your room and budget, so you can buy what you see." },
  { icon: Box, title: "3D view", text: "Get a 3D-style render of your room, then move the same products in 3D. Create models from their catalogue photos and reuse the saved GLB files." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="space-y-5">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">See your room redesigned, then furnish it for real.</h1>
          <p className="max-w-prose text-lg text-muted-foreground">
            Upload a photo, choose a modern or traditional look, and HOMELY AI furnishes your room with real products from partner shops and
            shows it as a 3D-style visualisation.
          </p>
          <p className="max-w-prose text-sm text-muted-foreground">
            The redesign is an AI-generated image that keeps your walls, windows and doors. Products in it may look slightly different from the
            real ones. The 3D view places those same products at their listed sizes. Create 3D models when you want a saved GLB instead of a
            simplified shape.
          </p>
        </div>
        <UploadForm />
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border bg-card p-5">
            <Icon className="mb-3 size-6 text-primary" />
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
