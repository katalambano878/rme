"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  Gem,
  ShieldCheck,
  Sparkles,
  Users,
  Heart,
  Truck,
  RefreshCw,
  Award,
} from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand"
import { HERO_IMAGES } from "@/lib/hero-images"
import { PageHero } from "@/components/shared/page-hero"

const values = [
  {
    icon: Gem,
    title: "Quality",
    description:
      "Every product in our store is selected for quality, reliability, and value.",
  },
  {
    icon: ShieldCheck,
    title: "Trust",
    description:
      "We provide authentic products from trusted suppliers with transparent policies.",
  },
  {
    icon: Sparkles,
    title: "Simplicity",
    description:
      "We believe shopping should be straightforward — browse, checkout, and receive with confidence.",
  },
  {
    icon: Users,
    title: "Community",
    description:
      `${BRAND_NAME} is more than a store — it is a community of customers who shop with confidence.`,
  },
]

const trustPoints = [
  {
    icon: Award,
    title: "Curated Selection",
    description: "A wide range of products organized by category for easy browsing.",
  },
  {
    icon: Truck,
    title: "Reliable Delivery",
    description: "Fast, dependable delivery to your doorstep.",
  },
  {
    icon: RefreshCw,
    title: "Secure Payments",
    description: "Safe and trusted payment options including mobile money and card.",
  },
  {
    icon: Heart,
    title: "Customer Support",
    description: "Friendly help when you need it — before, during, and after your order.",
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

export default function AboutPage() {
  return (
    <>
      <PageHero
        imageSrc={HERO_IMAGES.ladiesBag.src}
        imageAlt={HERO_IMAGES.ladiesBag.alt}
        eyebrow="Our Story"
        title={
          <>
            Welcome to
            <br />
            <span className="text-rose-soft">{BRAND_NAME}</span>
          </>
        }
        subtitle={`${BRAND_TAGLINE}. We make online shopping simple, secure, and accessible for everyone.`}
      />

      {/* Brand Story */}
      <Section>
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
            >
              <div className="aspect-[4/5] overflow-hidden rounded-3xl">
                <img
                  src="/images/home/hero-purse.png"
                  alt={`${BRAND_NAME} collection`}
                  className="h-full w-full object-cover object-center"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
              className="space-y-6"
            >
              <Heading as="h2">The Beginning</Heading>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  {BRAND_NAME} was built on a simple idea: quality products should be
                  easy to find — trusted items, honest pricing, and a shopping
                  experience that respects your time.
                </p>
                <p>
                  What started as a small catalog has grown into a full online
                  storefront with a wide selection of products across multiple
                  categories. Every item is chosen with care so you can shop with
                  confidence.
                </p>
                <p>
                  Today we serve customers across regions and cities. From first
                  orders to repeat purchases, we are glad to be part of the moments
                  that matter to you.
                </p>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      <Separator className="mx-auto max-w-5xl" />

      {/* Values */}
      <Section>
        <Container>
          <Heading
            as="h2"
            align="center"
            subtitle="The principles that guide every decision we make — from sourcing to delivery."
          >
            What We Stand For
          </Heading>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value, i) => (
              <motion.div
                key={value.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                className="group text-center"
              >
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-rose-light transition-colors group-hover:bg-rose-light/80">
                  <value.icon className="size-7 text-rose-primary" />
                </div>
                <h3 className="mt-5 font-heading text-lg font-semibold text-navy">
                  {value.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Why Choose Us */}
      <Section className="bg-gradient-to-b from-rose-light/40 to-white">
        <Container>
          <Heading
            as="h2"
            align="center"
            subtitle="More than just a store — a commitment to excellence."
          >
            Why Choose {BRAND_NAME}
          </Heading>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trustPoints.map((point, i) => (
              <motion.div
                key={point.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                className="rounded-2xl border border-rose-border/50 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <point.icon className="size-6 text-rose-primary" />
                <h3 className="mt-4 font-heading text-base font-semibold text-navy">
                  {point.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {point.description}
                </p>
              </motion.div>
            ))}
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section>
        <Container className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
            className="mx-auto max-w-xl"
          >
            <h2 className="font-heading text-3xl font-semibold text-navy sm:text-4xl">
              Ready to Start Shopping?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Explore our product categories — all chosen with you in mind.
            </p>
            <Button
              className="mt-8 rounded-xl bg-rose-light px-8 py-3 text-navy hover:bg-rose-border"
              size="lg"
              render={<Link href="/shop" />}
            >
              Shop Now
            </Button>
          </motion.div>
        </Container>
      </Section>
    </>
  )
}
