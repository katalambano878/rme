"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { formatFreeShippingMinimumLabel } from "@/lib/utils"

type AnnouncementBarProps = {
  message?: string | null
}

export function AnnouncementBar({ message }: AnnouncementBarProps) {
  const [visible, setVisible] = useState(true)

  const defaultMessage = `Free delivery on orders over ${formatFreeShippingMinimumLabel()} · Authentic products`
  const text = message?.trim() || defaultMessage

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="relative z-[60] shrink-0 overflow-hidden border-b border-rose-border/20 bg-[#FFF5F5]"
        >
          <div className="relative flex items-center justify-center px-10 py-2.5">
            <p className="max-w-[min(100%,52rem)] text-center text-xs font-light tracking-wide text-slate-700 sm:text-sm">
              {text}
            </p>
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-600 transition-colors hover:bg-rose-100 hover:text-slate-900"
              aria-label="Dismiss announcement"
            >
              <X className="size-3.5" strokeWidth={2} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
