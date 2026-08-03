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

const contactParagraphs = [
  "If you have questions about these Terms of Service, contact us:",
  `Email: ${CONTACT_EMAIL}`,
  ...(PHONE_DISPLAY_PRIMARY
    ? [`Phone/WhatsApp: ${PHONE_DISPLAY_PRIMARY}`]
    : []),
  "Address: Store pickup address TBD",
]

const sections = [
  {
    title: "1. Acceptance of Terms",
    paragraphs: [
      `Welcome to ${BRAND_LEGAL_NAME}. By accessing or purchasing from our website, you agree to the following terms: ${BRAND_LEGAL_NAME} sells products through its online store. All purchases are subject to availability.`,
      "If you do not agree with these Terms of Service, please do not use this website.",
      "We may update these terms from time to time. Continued use of the website after updates means you accept the revised terms.",
    ],
  },
  {
    title: "2. Account Responsibilities",
    paragraphs: [
      "When creating an account, you agree to provide accurate and complete information and to keep it up to date.",
      "You are responsible for keeping your login details secure and for all activities carried out through your account.",
      `${BRAND_LEGAL_NAME} may suspend or terminate accounts involved in fraud, misuse, or violations of these terms.`,
    ],
  },
  {
    title: "3. Orders, Pricing & Payments",
    paragraphs: [
      "All orders are subject to acceptance, availability, and successful payment verification.",
      "We reserve the right to cancel or refuse orders due to suspected fraud, pricing errors, stock limitations, or other operational issues.",
      "Prices and promotions may change without notice. Any taxes, shipping fees, or additional charges are shown at checkout where applicable.",
    ],
  },
  {
    title: "4. Intellectual Property",
    paragraphs: [
      `All website content, including logos, graphics, product images, text, and design elements, is the property of ${BRAND_LEGAL_NAME} or its licensors.`,
      "You may not copy, reproduce, republish, or distribute any content from this website without prior written permission.",
      "Unauthorized use of intellectual property may result in legal action.",
    ],
  },
  {
    title: "5. Order Fulfillment & Delivery",
    paragraphs: [
      "Delivery timelines are estimates and may vary due to courier schedules, location, weather, or other factors beyond our control.",
      `${BRAND_LEGAL_NAME} is not liable for failed deliveries caused by incorrect customer information.`,
      "Please inspect your order upon delivery and contact us promptly if anything is missing, incorrect, or damaged.",
    ],
  },
  {
    title: "6. Returns & Refunds",
    paragraphs: [
      "Returns, exchanges, and refunds are handled according to our Refund Policy.",
      "Not all items are eligible for return, especially used or opened products for hygiene or safety reasons.",
      "Please review the full Refund Policy before making a purchase.",
    ],
  },
  {
    title: "7. Limitation of Liability",
    paragraphs: [
      `${BRAND_LEGAL_NAME} provides this website and its services on an "as available" basis without warranties of uninterrupted or error-free operation.`,
      `To the fullest extent permitted by law, ${BRAND_LEGAL_NAME} is not liable for indirect, incidental, or consequential damages resulting from website use, order delays, or third-party service disruptions.`,
      "Our total liability for any product-related claim is limited to the amount paid for that product.",
    ],
  },
  {
    title: "8. Governing Law",
    paragraphs: [
      "These Terms of Service are governed by and interpreted under the laws of Ghana.",
      "Any disputes arising from use of this website or purchases made through it will be subject to the jurisdiction of the courts in Ghana.",
    ],
  },
  {
    title: "9. Contact Information",
    paragraphs: contactParagraphs,
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

export default function TermsPage() {
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
            subtitle={`Please read these terms carefully before using ${BRAND_NAME} and our services.`}
          >
            Terms of Service
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

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-8 text-center text-sm text-muted-foreground"
          >
            By using this website, you acknowledge that you have read,
            understood, and agree to these Terms of Service.
          </motion.p>
        </motion.div>
      </Container>
    </Section>
  )
}
