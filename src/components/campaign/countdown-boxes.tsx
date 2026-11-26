"use client"

import { cn } from "@/lib/utils"

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return [
    { value: Math.floor(total / 86_400), label: "Days" },
    { value: Math.floor((total % 86_400) / 3600), label: "Hours" },
    { value: Math.floor((total % 3600) / 60), label: "Mins" },
    { value: total % 60, label: "Secs" },
  ]
}

/**
 * Segmented Days / Hours / Mins / Secs countdown, the way big sale pages show
 * it. `tone="dark"` sits on the black campaign surfaces, `light` on white.
 */
export function CountdownBoxes({
  ms,
  tone = "dark",
  size = "lg",
  className,
}: {
  ms: number
  tone?: "dark" | "light"
  size?: "lg" | "sm"
  className?: string
}) {
  return (
    <div className={cn("flex items-stretch gap-2", size === "lg" && "sm:gap-3", className)} role="timer">
      {parts(ms).map((p) => (
        <div
          key={p.label}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl",
            size === "lg" ? "min-w-[64px] px-2 py-2.5 sm:min-w-[78px] sm:py-3" : "min-w-[46px] px-1.5 py-1.5",
            tone === "dark" ? "bg-white/[0.08] text-white ring-1 ring-white/15" : "bg-white text-ink ring-1 ring-line",
          )}
        >
          <span
            className={cn(
              "font-extrabold tabular-nums leading-none",
              size === "lg" ? "text-[30px] sm:text-[40px]" : "text-[18px]",
            )}
            suppressHydrationWarning
          >
            {String(p.value).padStart(2, "0")}
          </span>
          <span
            className={cn(
              "mt-1 font-semibold uppercase tracking-[0.12em]",
              size === "lg" ? "text-[11px] sm:text-[12px]" : "text-[9px]",
              tone === "dark" ? "text-white/60" : "text-mute",
            )}
          >
            {p.label}
          </span>
        </div>
      ))}
    </div>
  )
}
