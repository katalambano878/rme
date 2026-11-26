import { PolicyPage, policyMetadata, type PolicySection } from "@/components/policies/policy-page"
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand"

export const metadata = policyMetadata(
  "Terms of Service",
  `The terms for shopping on ${BRAND_NAME}: orders, payment, delivery and your account.`,
  "/policies/terms",
)

const sections: PolicySection[] = [
  {
    title: "1. Acceptance of Terms",
    paragraphs: [
      "Welcome to RonnyandMe. By accessing or purchasing from our website, you agree to the following terms: RonnyandMe sells beauty, skincare, accessories, and other related products. All purchases are subject to availability.",
      "If you do not agree with these Terms of Service, please do not use this website.",
      "We may update these terms from time to time. Continued use of the website after updates means you accept the revised terms.",
    ],
  },
  {
    title: "2. Account Responsibilities",
    paragraphs: [
      "When creating an account, you agree to provide accurate and complete information and to keep it up to date.",
      "You are responsible for keeping your login details secure and for all activities carried out through your account.",
      "RonnyandMe may suspend or terminate accounts involved in fraud, misuse, or violations of these terms.",
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
      "All website content, including logos, graphics, product images, text, and design elements, is the property of RonnyandMe or its licensors.",
      "You may not copy, reproduce, republish, or distribute any content from this website without prior written permission.",
      "Unauthorized use of intellectual property may result in legal action.",
    ],
  },
  {
    title: "5. Order Fulfillment & Delivery",
    paragraphs: [
      "Delivery timelines are estimates and may vary due to courier schedules, location, weather, or other factors beyond our control.",
      "You are responsible for providing accurate shipping details. RonnyandMe is not liable for failed deliveries caused by incorrect customer information.",
      "Please inspect your order upon delivery and contact us promptly if anything is missing, incorrect, or damaged.",
    ],
  },
  {
    title: "6. Returns & Refunds",
    paragraphs: [
      "Returns, exchanges, and refunds are handled according to our Refund Policy.",
      "Not all items are eligible for return, especially used or opened beauty/skincare products for hygiene reasons.",
      "Please review the full Refund Policy before making a purchase.",
    ],
  },
  {
    title: "7. Limitation of Liability",
    paragraphs: [
      "RonnyandMe provides this website and its services on an \"as available\" basis without warranties of uninterrupted or error-free operation.",
      "To the fullest extent permitted by law, RonnyandMe is not liable for indirect, incidental, or consequential damages resulting from website use, order delays, or third-party service disruptions.",
      "Our total liability for any product-related claim is limited to the amount paid for that product.",
    ],
  },
  {
    title: "8. Governing Law",
    paragraphs: [
      "These Terms of Service are governed by and interpreted under the laws of Ghana.",
      "Any disputes arising from use of this website or purchases made through it will be subject to the jurisdiction of the courts in Accra, Ghana.",
    ],
  },
  {
    title: "9. Contact Information",
    paragraphs: [
      "If you have questions about these Terms of Service, contact us:",
      "Email: ronnyandme25@gmail.com",
      "Phone/WhatsApp: +233 59 270 7791",
      "Address: Manet Ville Estates, East Airport Spintex, Accra",
    ],
  },
]

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms of Service"
      subtitle="Please read these terms carefully before using our website and services."
      updated="March 2026 (effective 1 January 2026)"
      sections={sections}
      footer={
        <p>
          Questions about these terms? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-rose-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      }
    />
  )
}
