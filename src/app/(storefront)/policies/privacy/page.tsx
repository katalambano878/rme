"use client"

import { motion } from "framer-motion"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { Separator } from "@/components/ui/separator"
import {
  BRAND_LEGAL_NAME,
  BRAND_NAME,
  CONTACT_EMAIL,
  PHONE_DISPLAY_PRIMARY,
} from "@/lib/brand"

const contactLine = PHONE_DISPLAY_PRIMARY
  ? `For privacy-related questions or requests, contact us at ${CONTACT_EMAIL} or ${PHONE_DISPLAY_PRIMARY}.`
  : `For privacy-related questions or requests, contact us at ${CONTACT_EMAIL}.`

const sections = [
  {
    title: "1. Information We Collect",
    paragraphs: [
      `At ${BRAND_LEGAL_NAME}, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you visit our website or make a purchase.`,
      "We may collect details such as your name, email, phone number, delivery address, billing details, order history, and records of your communication with us.",
      "We also collect technical information like IP address, browser type, device type, and on-site activity to help secure and improve the website.",
    ],
  },
  {
    title: "2. How We Use Your Information",
    paragraphs: [
      "We use your information to process and deliver orders, provide customer support, verify transactions, and keep you informed about your purchases.",
      "Your information may also be used to improve our products and services, personalise your shopping experience, and send promotional updates (you can opt out at any time).",
      "We process data to prevent fraud, enforce our policies, and comply with legal or regulatory obligations.",
    ],
  },
  {
    title: "3. Cookies & Tracking Technologies",
    paragraphs: [
      "We use cookies and similar technologies to keep the site working, remember your preferences, understand usage patterns, and improve performance.",
      "Some cookies are necessary for checkout, account sessions, and security. Others help with analytics and marketing.",
      "You can manage cookie preferences in your browser settings, but disabling certain cookies may affect site functionality.",
    ],
  },
  {
    title: "4. Third-Party Services & Sharing",
    paragraphs: [
      "We do not sell your personal information. We may share limited data with trusted providers that help us run the store, including payment processors, delivery partners, analytics providers, and communication tools.",
      "These providers only receive data needed to perform their services and are expected to handle your information securely.",
      `We may also disclose information where required by law, court order, or to protect the rights, safety, and operations of ${BRAND_LEGAL_NAME}.`,
    ],
  },
  {
    title: "5. Data Protection & Retention",
    paragraphs: [
      "We implement reasonable technical and organisational safeguards to protect your personal data from unauthorized access, misuse, or disclosure.",
      "Payment details are processed through secure payment partners and are not fully stored on our servers.",
      "We keep personal data only for as long as necessary for order fulfillment, support, legal compliance, and legitimate business purposes.",
    ],
  },
  {
    title: "6. Your Rights & Contact",
    paragraphs: [
      "You may contact us to request access, correction, or deletion of your personal data, subject to applicable legal requirements.",
      contactLine,
      "We may update this Privacy Policy from time to time, and changes will be posted on this page with an updated date.",
    ],
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

export default function PrivacyPolicyPage() {
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
            subtitle={`At ${BRAND_NAME}, we value your privacy and are committed to protecting your personal information.`}
          >
            Privacy Policy
          </Heading>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Effective Date: 1 January 2026 · Last Updated: March 2026
          </p>

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
                  <h2 className="font-heading text-lg font-semibold text-navy">
                    {section.title}
                  </h2>
                  <div className="mt-4 space-y-3">
                    {section.paragraphs.map((para, j) => (
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

          <Separator className="mt-8 bg-rose-border/40" />

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-8 text-center"
          >
            <p className="text-sm text-muted-foreground">
              If you have questions about this Privacy Policy, contact us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-rose-primary hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </motion.div>
        </motion.div>
      </Container>
    </Section>
  )
}
