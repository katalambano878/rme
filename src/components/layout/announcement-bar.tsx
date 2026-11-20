import { formatFreeShippingMinimumLabel } from "@/lib/utils"

type AnnouncementBarProps = {
  message?: string | null
}

/** Thin black notice above the header. Admin can replace the text in storefront settings. */
export function AnnouncementBar({ message }: AnnouncementBarProps) {
  const fallback = `Free delivery on orders over ${formatFreeShippingMinimumLabel()} · Pickup at Spintex, Accra · Pay with Mobile Money`
  const text = message?.trim() || fallback

  return (
    <p className="bg-brand px-4 py-2.5 text-center text-[13px] font-medium leading-snug text-white sm:text-sm">
      {text}
    </p>
  )
}
