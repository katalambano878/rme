import { PolicyPage, policyMetadata, type PolicySection } from "@/components/policies/policy-page"
import { BRAND_NAME, PHONE_INTERNATIONAL_PRIMARY, SUPPORT_EMAIL } from "@/lib/brand"

export const metadata = policyMetadata(
  "Privacy Policy",
  `How ${BRAND_NAME} collects, uses and protects your personal data under Ghana's Data Protection Act (Act 843).`,
  "/policies/privacy",
)

const sections: PolicySection[] = [
  {
    title: "1. Information We Collect",
    paragraphs: [
      "At RonnyandMe, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you visit our website or make a purchase.",
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
      "We may also disclose information where required by law, court order, or to protect the rights, safety, and operations of RonnyandMe.",
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
    title: "6. Ghana's Data Protection Act",
    paragraphs: [
      "We collect and use personal data in line with Ghana's **Data Protection Act, 2012 (Act 843)**: only for clear purposes, kept accurate, kept secure and not kept longer than needed.",
      "Under Act 843 you have the right to ask what personal data we hold about you, to have it corrected or deleted, and to object to its use for marketing.",
      "If you are not happy with how we handle your data, you can complain to the **Data Protection Commission of Ghana** (dataprotection.org.gh).",
    ],
  },
  {
    title: "7. Your Rights & Contact",
    paragraphs: [
      "You may contact us to request access, correction, or deletion of your personal data, subject to applicable legal requirements.",
      `For privacy-related questions or requests, contact us at ${SUPPORT_EMAIL} or ${PHONE_INTERNATIONAL_PRIMARY}.`,
      "We may update this Privacy Policy from time to time, and changes will be posted on this page with an updated date.",
    ],
  },
]

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      subtitle={`At ${BRAND_NAME}, we value your privacy and are committed to protecting your personal information.`}
      updated="November 2026 (effective 1 January 2026)"
      sections={sections}
      footer={
        <p>
          If you have questions about this Privacy Policy, contact us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-rose-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      }
    />
  )
}
