"use client"

import { motion } from "framer-motion"
import {
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  ShieldCheck,
} from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { Separator } from "@/components/ui/separator"

const sections = [
  {
    icon: AlertCircle,
    title: "1. No Refunds on Used or Opened Products",
    content: [
      "For hygiene and safety reasons, beauty and skincare items cannot be returned if opened or used.",
    ],
  },
  {
    icon: CheckCircle2,
    title: "2. Eligible Returns",
    content: [
      "You may request a return or exchange if you received a damaged item, received the wrong product, or the item is unused, unopened, and in its original packaging.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "3. Non-Returnable Items",
    content: [
      "Lip glosses, skincare, or beauty products that have been opened; sale or discounted items; and items damaged due to customer misuse are not returnable.",
    ],
  },
  {
    icon: RotateCcw,
    title: "4. Return Process",
    content: [
      "Contact us via email at ronnyandme25@gmail.com with your order number and clear photos.",
      "Requests are reviewed within 24–48 hours. If approved, return instructions will be provided.",
    ],
  },
  {
    icon: Clock,
    title: "5. Refunds",
    content: [
      "Approved refunds are issued as store credit or replacement. Cash refunds are only available in special cases.",
    ],
  },
  {
    icon: ArrowRightLeft,
    title: "6. Exchanges",
    content: [
      "Unused items can be exchanged depending on stock availability.",
    ],
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

export default function ReturnsPolicyPage() {
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
            subtitle="At RONNY&ME, we want you to love your purchase. Please read our refund and return guidelines below."
          >
            Refund Policy
          </Heading>

          <div className="mt-12 space-y-0">
            {sections.map((section, i) => (
              <motion.div
                key={section.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
              >
                <div className="py-8 first:pt-0">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-light">
                      <section.icon className="size-5 text-rose-primary" />
                    </div>
                    <h2 className="font-heading text-lg font-semibold text-navy">
                      {section.title}
                    </h2>
                  </div>
                  <div className="mt-4 space-y-3 pl-[52px]">
                    {section.content.map((para, j) => (
                      <p
                        key={j}
                        className="text-sm leading-relaxed text-muted-foreground"
                      >
                        {para}
                      </p>
                    ))}
                  </div>
                </div>
                {i < sections.length - 1 && (
                  <Separator className="bg-rose-border/40" />
                )}
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-10 text-center text-sm text-muted-foreground"
          >
            Last updated: March 2026. For return inquiries, contact us at{" "}
            <a
              href="mailto:ronnyandme25@gmail.com"
              className="font-medium text-rose-primary hover:underline"
            >
              ronnyandme25@gmail.com
            </a>{" "}
            or WhatsApp +233 59 270 7791.
          </motion.p>
        </motion.div>
      </Container>
    </Section>
  )
}
