import { Palette, ShoppingBag, SplitSquareHorizontal } from "lucide-react";
import { UploadForm } from "@/components/upload-form";

const FEATURES = [
  { icon: Palette, title: "3D-style redesigns", text: "Pick a style and get a professional-looking 3D render of your room that keeps its layout." },
  { icon: SplitSquareHorizontal, title: "Compare and explore", text: "Slide between your photo and the redesign, try more styles, and download your favourites." },
  { icon: ShoppingBag, title: "Shop this look", text: "See similar real products from partner shops, filtered by category and budget." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="space-y-5">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">See your room redesigned, then furnish it for real.</h1>
          <p className="max-w-prose text-lg text-muted-foreground">
            Upload a photo, choose a style, and HOMELY AI creates a 3D-style visualisation of your room. Then it finds furniture and decor from
            integrated shops that match the look.
          </p>
          <p className="max-w-prose text-sm text-muted-foreground">
            Results are AI-generated images in a 3D-render style. They are not editable 3D models, and sizes are approximate.
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
