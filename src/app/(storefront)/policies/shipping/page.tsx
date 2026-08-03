"use client"

import { motion } from "framer-motion"
import { Truck, MapPin, Clock, Globe, Package } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { formatFreeShippingMinimumLabel } from "@/lib/utils"
import { BRAND_NAME, CONTACT_EMAIL, PHONE_DISPLAY_PRIMARY } from "@/lib/brand"
import { HERO_IMAGES } from "@/lib/hero-images"
import { PageHero } from "@/components/shared/page-hero"

const trackingContact = PHONE_DISPLAY_PRIMARY
  ? `If your tracking hasn't updated in over 48 hours, please contact us at ${PHONE_DISPLAY_PRIMARY}.`
  : `If your tracking hasn't updated in over 48 hours, please contact us at ${CONTACT_EMAIL}.`

const sections = [
  {
    value: "delivery-areas",
    icon: MapPin,
    title: "Delivery Areas",
    content: `${BRAND_NAME} delivers nationwide. Delivery times vary by location and are confirmed at checkout.

**Urban areas** — Standard delivery within 1–3 business days.

**Regional areas** — Delivery within 3–5 business days via trusted courier partners.

**Remote areas** — Delivery times may be longer depending on location and courier availability.

A valid phone number is required for all deliveries.`,
  },
  {
    value: "shipping-rates",
    icon: Truck,
    title: "Shipping Rates",
    content: `We offer competitive, transparent shipping rates:

**Free Shipping** — All orders over ${formatFreeShippingMinimumLabel()} qualify for free standard delivery where available.

**Standard Delivery** — Rates are calculated at checkout based on your delivery address and order weight.

**Express Delivery** — Available in select areas. Rates and availability are shown at checkout.

Shipping rates are calculated at checkout based on your delivery address and order weight.`,
  },
  {
    value: "processing-time",
    icon: Clock,
    title: "Processing Time",
    content: `All orders are processed within 24 hours of payment confirmation, excluding weekends and public holidays.

**Standard Processing** — Orders placed before 2:00 PM on weekdays are processed the same day. Orders placed after 2:00 PM or on weekends are processed the next business day.

**Pre-Order Items** — Some items may have extended processing times. This will be clearly noted on the product page.

**Peak Periods** — During holidays, processing may take an additional 1–2 business days due to high demand.`,
  },
  {
    value: "tracking",
    icon: Package,
    title: "Order Tracking",
    content: `Stay informed every step of the way:

Once your order is dispatched, you'll receive an SMS and email notification with your tracking details when available.

You can track your order anytime by visiting our **Track Your Order** page and entering your order number and the email or phone number used at checkout.

Our tracking statuses include:
— **Order Placed** – Your order has been received and payment confirmed.
— **Processing** – Your items are being carefully prepared and quality-checked.
— **Shipped** – Your order is en route with our courier partner.
— **Delivered** – Your order has been successfully delivered.

${trackingContact}`,
  },
  {
    value: "international",
    icon: Globe,
    title: "International Shipping",
    content: `International shipping may be available to select destinations. Contact us for availability and rates.

**Important Notes:**
— International orders may be subject to customs duties and import taxes, which are the responsibility of the recipient.
— All international shipments include a tracking number when available.
— For bulk or corporate international orders, please contact us directly for a custom quote.

Join our newsletter to be the first to know when we expand to new regions.`,
  },
]

export default function ShippingPolicyPage() {
  return (
    <>
      <PageHero
        imageSrc={HERO_IMAGES.heels.src}
        imageAlt={HERO_IMAGES.heels.alt}
        title="Shipping Policy"
        subtitle="Everything you need to know about how we get your orders to your doorstep."
      />

      <Section className="bg-white">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
            className="mx-auto max-w-3xl"
          >
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
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-rose-primary hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </motion.p>
        </motion.div>
      </Container>
    </Section>
    </>
  )
}
