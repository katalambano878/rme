"use client"

import { Truck, Shield, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const trustItems = [
  { icon: Truck, label: "Free Delivery" },
  { icon: Shield, label: "Secure Checkout" },
  { icon: MessageCircle, label: "WhatsApp Support" },
]

interface TrustBarProps {
  className?: string
}

export function TrustBar({ className }: TrustBarProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 items-center gap-x-2 gap-y-3 rounded-2xl border border-rose-border bg-white px-3 py-5 sm:gap-x-0 sm:divide-x sm:divide-rose-border sm:rounded-3xl sm:px-4 sm:py-6",
        className
      )}
    >
      {trustItems.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex min-w-0 items-center justify-center gap-1.5 px-1 sm:gap-2.5 sm:px-6"
        >
          <Icon
            className="size-4 shrink-0 text-rose-primary sm:size-5"
            strokeWidth={1.5}
          />
          <span className="text-[11px] font-medium leading-tight text-navy/80 sm:text-sm">
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
