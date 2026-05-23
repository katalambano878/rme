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

const values = [
  {
    icon: Gem,
    title: "Quality",
    description:
      "Every product in our store is selected for quality, safety, and visible results for skin, lips, body, and hair.",
  },
  {
    icon: ShieldCheck,
    title: "Authenticity",
    description:
      "We provide authentic beauty and personal care products sourced from trusted brands and suppliers.",
  },
  {
    icon: Sparkles,
    title: "Glow First",
    description:
      "We believe confidence starts with healthy skin and simple routines that fit your real lifestyle.",
  },
  {
    icon: Users,
    title: "Community",
    description:
      "RonnyandMe is more than a store - it is a growing community sharing skincare and beauty wins every day.",
  },
]

const trustPoints = [
  {
    icon: Award,
    title: "Curated Selection",
    description: "We stock skincare, lip care, body care, makeup, hair essentials, and baby care products.",
  },
  {
    icon: Truck,
    title: "Nationwide Delivery",
    description: "Fast, reliable delivery in your region and beyond.",
  },
  {
    icon: RefreshCw,
    title: "Secure Payments",
    description: "Safe and trusted payment options including mobile money and card.",
  },
  {
    icon: Heart,
    title: "Personal Care Support",
    description: "Friendly product guidance and routine support via WhatsApp.",
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
      {/* Hero */}
      <Section className="relative overflow-hidden bg-gradient-to-b from-rose-light to-white">
        <Container className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
          >
            <p className="text-sm font-medium uppercase tracking-widest text-rose-primary">
              Our Story
            </p>
            <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-navy sm:text-5xl lg:text-6xl">
              Where Beauty Meets
              <br />
              <span className="text-rose-primary">Everyday Care</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Born from a passion for beauty and skincare, we make trusted personal
              care products accessible to everyone in your region and beyond.
            </p>
          </motion.div>
        </Container>
      </Section>

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
                  src="/images/store-front.png"
                  alt="RonnyandMe store — Ronny & Mimi's Essentials"
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
                  RonnyandMe was born from a simple observation: quality beauty
                  care should be easy to find - trusted products, honest quality, and a
                  shopping experience that respects your time.
                </p>
                <p>
                  What began as a small curation grew into a full storefront for
                  skincare, lip care, body lotions, body wash, makeup, hair products,
                  and baby essentials. Every item is chosen with care so your routine
                  feels intentional and effective.
                </p>
                <p>
                  Today we serve customers across cities and regions. From first
                  orders to restocks, we are glad to be part of the moments
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
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-rose-light transition-colors group-hover:bg-rose-100/80">
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
            Why Choose RonnyandMe
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
              Ready to Elevate Your Routine?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Discover our curated categories of skincare, lip care, body care,
              makeup, hair essentials, and more - all chosen with you in mind.
            </p>
            <Button
              className="mt-8 rounded-xl bg-rose-100 px-8 py-3 text-navy hover:bg-rose-200"
              size="lg"
              render={<Link href="/shop" />}
            >
              Explore Categories
            </Button>
          </motion.div>
        </Container>
      </Section>
    </>
  )
}
