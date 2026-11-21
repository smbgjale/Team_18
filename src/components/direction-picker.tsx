"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DIRECTIONS, isDirection, stylesFor, type DesignDirection } from "@/lib/styles";
import { cn } from "@/lib/utils";

interface Props {
  value: DesignDirection | null;
  onChange: (direction: DesignDirection) => void;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
}

export function DirectionPicker({ value, onChange, disabled, compact, label = "Design direction" }: Props) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(v) => isDirection(v) && onChange(v)}
      disabled={disabled}
      className={cn(compact ? "grid-cols-2 gap-1 rounded-lg bg-muted p-1" : "gap-2 sm:grid-cols-2 sm:gap-3")}
    >
      {DIRECTIONS.map((d) =>
        compact ? (
          <label
            key={d.id}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
              "has-data-checked:bg-background has-data-checked:text-foreground has-data-checked:shadow-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <RadioGroupItem value={d.id} className="sr-only" />
            {d.name}
          </label>
        ) : (
          <label
            key={d.id}
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/60",
              "has-data-checked:border-primary has-data-checked:bg-primary/5 has-data-checked:ring-2 has-data-checked:ring-primary/25",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <RadioGroupItem value={d.id} className="mt-0.5" />
            <span className="min-w-0 space-y-1">
              <span className="flex items-center gap-2">
                <span className="font-semibold">{d.name}</span>
                <span className="flex gap-0.5" aria-hidden>
                  {d.swatches.map((c) => (
                    <span key={c} className="size-3 rounded-full border" style={{ background: c }} />
                  ))}
                </span>
              </span>
              <span className="block text-sm leading-snug text-muted-foreground sm:text-xs">{d.description}</span>
              <span className="block text-xs text-muted-foreground">{stylesFor(d.id).map((s) => s.name).join(" · ")}</span>
            </span>
          </label>
        ),
      )}
    </RadioGroup>
  );
}
