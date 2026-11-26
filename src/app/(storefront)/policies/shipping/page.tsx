import Link from "next/link"
import { Clock, MapPin, Package, Store, Truck, Globe } from "lucide-react"
import { PolicyPage, policyMetadata, type PolicySection } from "@/components/policies/policy-page"
import {
  PHONE_INTERNATIONAL_PRIMARY,
  STORE_ADDRESS,
  STORE_HOURS,
  SUPPORT_EMAIL,
  WHATSAPP_URL,
} from "@/lib/brand"
import { formatFreeShippingMinimumLabel } from "@/lib/utils"

export const metadata = policyMetadata(
  "Delivery & Pickup",
  `Delivery anywhere in Ghana, free over ${formatFreeShippingMinimumLabel()}, or free pickup at our Spintex shop.`,
  "/policies/shipping",
)

const free = formatFreeShippingMinimumLabel()

const sections: PolicySection[] = [
  {
    icon: MapPin,
    title: "Where we deliver",
    paragraphs: [
      "We deliver to **all regions of Ghana**.",
      "**Greater Accra and Tema:** by our delivery rider, usually within **1–2 business days**.",
      "**Other regions** (Kumasi, Takoradi, Cape Coast, Tamale, Ho and everywhere else): by courier or bus. We tell you when to expect it when we confirm your order.",
    ],
  },
  {
    icon: Truck,
    title: "Delivery fee",
    paragraphs: [
      `**Free delivery on orders over ${free}**, anywhere in Ghana.`,
      "Below that, the fee depends on where you are. After you order, we **call or WhatsApp you with the exact amount before we send anything**, so there are no surprises.",
      "You pay for your items with Mobile Money at checkout. We do not offer cash on delivery.",
    ],
  },
  {
    icon: Store,
    title: "Free store pickup",
    paragraphs: [
      `Pick up for free at our shop: **${STORE_ADDRESS}**.`,
      ...STORE_HOURS.map((h) => `**${h.days}:** ${h.hours}`),
      "Choose \"Store pickup\" at checkout and bring your order number when you come.",
    ],
  },
  {
    icon: Clock,
    title: "When we pack your order",
    paragraphs: [
      "We start packing as soon as your Mobile Money payment is confirmed.",
      "Orders placed on Sunday or a public holiday are packed on the next working day.",
    ],
  },
  {
    icon: Package,
    title: "Tracking your order",
    paragraphs: [
      "Use the **Track Order** page with your order number and the phone number or email you used at checkout.",
      `Not updated for more than 48 hours? WhatsApp us on ${PHONE_INTERNATIONAL_PRIMARY}.`,
    ],
  },
  {
    icon: Globe,
    title: "Outside Ghana",
    paragraphs: [
      "We only deliver within Ghana at the moment. If you need something sent abroad, message us on WhatsApp before you order and we will see what we can do.",
    ],
  },
]

export default function ShippingPolicyPage() {
  return (
    <PolicyPage
      title="Delivery & Pickup"
      subtitle="Where we deliver, what it costs and how to pick up for free."
      updated="November 2026"
      sections={sections}
      footer={
        <p>
          Questions about delivery?{" "}
          <a href={WHATSAPP_URL} className="font-medium text-rose-primary hover:underline">
            WhatsApp us
          </a>{" "}
          or email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-rose-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
          . See also our{" "}
          <Link href="/policies/returns" className="font-medium text-rose-primary hover:underline">
            returns policy
          </Link>
          .
        </p>
      }
    />
  )
}
