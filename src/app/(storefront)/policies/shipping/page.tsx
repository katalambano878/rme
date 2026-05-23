"use client"

import { motion } from "framer-motion"
import { Truck, MapPin, Clock, Globe, Package } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { formatFreeShippingMinimumLabel } from "@/lib/utils"

const sections = [
  {
    value: "delivery-areas",
    icon: MapPin,
    title: "Delivery Areas",
    content: `RonnyandMe currently delivers across all regions of Ghana. Our primary delivery zones include:

**Greater Accra** — Standard delivery within 1–2 business days. Same-day delivery available for orders placed before 12:00 PM within Accra Metropolitan Area.

**Kumasi, Takoradi & Cape Coast** — Delivery within 2–3 business days via our trusted courier partners.

**All Other Regions** — Delivery within 3–5 business days, including Tamale, Ho, Sunyani, Koforidua, and surrounding areas.

We also deliver to university campuses, office complexes, and gated communities. A valid phone number is required for all deliveries.`,
  },
  {
    value: "shipping-rates",
    icon: Truck,
    title: "Shipping Rates",
    content: `We offer competitive, transparent shipping rates:

**Free Shipping** — All orders over ${formatFreeShippingMinimumLabel()} qualify for free standard delivery nationwide.

**Standard Delivery (Accra)** — GH₵ 25

**Standard Delivery (Other Regions)** — GH₵ 40 – GH₵ 60, depending on location.

**Express Delivery (Accra Only)** — GH₵ 50 for same-day or next-day delivery.

Shipping rates are calculated at checkout based on your delivery address and order weight. Gift-wrapped orders may incur a small additional fee for premium packaging.`,
  },
  {
    value: "processing-time",
    icon: Clock,
    title: "Processing Time",
    content: `All orders are processed within 24 hours of payment confirmation, excluding weekends and public holidays.

**Standard Processing** — Orders placed before 2:00 PM on weekdays are processed the same day. Orders placed after 2:00 PM or on weekends are processed the next business day.

**Pre-Order & Limited Items** — Some limited-edition or pre-order items may have extended processing times of 3–7 business days. This will be clearly noted on the product page.

**Peak Periods** — During holidays (Christmas, Valentine's Day, Mother's Day), processing may take an additional 1–2 business days due to high demand. We recommend ordering early during these periods.`,
  },
  {
    value: "tracking",
    icon: Package,
    title: "Order Tracking",
    content: `Stay informed every step of the way:

Once your order is dispatched, you'll receive an SMS and email notification with your tracking details.

You can track your order anytime by visiting our **Track Your Order** page and entering your order number and the email or phone number used at checkout.

Our tracking statuses include:
— **Order Placed** – Your order has been received and payment confirmed.
— **Processing** – Your items are being carefully prepared and quality-checked.
— **Shipped** – Your order is en route with our courier partner.
— **Delivered** – Your order has been successfully delivered.

If your tracking hasn't updated in over 48 hours, please contact us via WhatsApp at +233 59 270 7791.`,
  },
  {
    value: "international",
    icon: Globe,
    title: "International Shipping",
    content: `We're expanding our reach beyond Ghana. International shipping is currently available to select countries in West Africa and the United Kingdom.

**West Africa (Nigeria, Côte d'Ivoire, Togo)** — Delivery within 5–7 business days. Rates start from GH₵ 120.

**United Kingdom** — Delivery within 7–14 business days. Rates start from GH₵ 250.

**Important Notes:**
— International orders may be subject to customs duties and import taxes, which are the responsibility of the recipient.
— All international shipments include a tracking number.
— For bulk or corporate international orders, please contact us directly for a custom quote.

We're working to expand to more countries soon. Join our newsletter to be the first to know when we ship to your region.`,
  },
]

export default function ShippingPolicyPage() {
  return (
    <Section className="bg-gradient-to-b from-rose-light/50 to-white">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
          className="mx-auto max-w-3xl"
        >
          <Heading
            as="h1"
            align="center"
            subtitle="Everything you need to know about how we get your orders to your doorstep."
          >
            Shipping Policy
          </Heading>

          <div className="mt-12">
            <Accordion>
              {sections.map((section) => (
                <AccordionItem
                  key={section.value}
                  value={section.value}
                  className="border-rose-border/50"
                >
                  <AccordionTrigger className="py-5 text-base hover:no-underline">
                    <span className="flex items-center gap-3">
                      <section.icon className="size-5 text-rose-primary" />
                      <span className="font-heading font-semibold text-navy">
                        {section.title}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pb-4 pl-8 text-sm leading-relaxed text-muted-foreground">
                      {section.content.split("\n\n").map((para, i) => (
                        <p key={i} className="mb-3 last:mb-0">
                          {para.split("**").map((segment, j) =>
                            j % 2 === 1 ? (
                              <strong key={j} className="font-semibold text-navy">
                                {segment}
                              </strong>
                            ) : (
                              <span key={j}>{segment}</span>
                            )
                          )}
                        </p>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-10 text-center text-sm text-muted-foreground"
          >
            Last updated: March 2026. For any shipping inquiries, contact us at{" "}
            <a
              href="mailto:hello@ronnyandme.com"
              className="font-medium text-rose-primary hover:underline"
            >
              hello@ronnyandme.com
            </a>
          </motion.p>
        </motion.div>
      </Container>
    </Section>
  )
}
