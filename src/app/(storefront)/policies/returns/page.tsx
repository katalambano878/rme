import Link from "next/link"
import { AlertCircle, ArrowRightLeft, CheckCircle2, Clock, RotateCcw, Truck } from "lucide-react"
import { PolicyPage, policyMetadata, type PolicySection } from "@/components/policies/policy-page"
import { BRAND_NAME, PHONE_INTERNATIONAL_PRIMARY, SUPPORT_EMAIL, WHATSAPP_URL } from "@/lib/brand"

export const metadata = policyMetadata(
  "Returns & Refunds",
  `${BRAND_NAME} returns and refunds: report a damaged or wrong item within 48 hours and we will put it right.`,
  "/policies/returns",
)

const sections: PolicySection[] = [
  {
    icon: Clock,
    title: "1. Tell us within 48 hours",
    paragraphs: [
      "Contact us **within 48 hours of receiving your order** if something is wrong. After 48 hours we can no longer accept a return or exchange.",
    ],
  },
  {
    icon: CheckCircle2,
    title: "2. What you can return or exchange",
    paragraphs: [
      "**Damaged or wrong items:** always covered, including items bought on sale or during Black Friday.",
      "**Unopened items you changed your mind about:** can be exchanged if they are unused, sealed and in their original packaging, depending on stock.",
    ],
  },
  {
    icon: AlertCircle,
    title: "3. What we cannot take back",
    paragraphs: [
      "For hygiene and safety reasons, beauty, skincare and lip products **cannot be returned once opened or used**, unless they arrived damaged or were the wrong item.",
      "We also cannot take back sale items you changed your mind about, or items damaged after delivery.",
    ],
  },
  {
    icon: RotateCcw,
    title: "4. How to return something",
    paragraphs: [
      `WhatsApp us on ${PHONE_INTERNATIONAL_PRIMARY} or email ${SUPPORT_EMAIL} with your **order number** and **clear photos** of the item and packaging.`,
      "We reply within 24–48 hours. If approved, we tell you how to send it back.",
    ],
  },
  {
    icon: Truck,
    title: "5. Who pays for return delivery",
    paragraphs: [
      "**If it was our mistake** (damaged or wrong item), we pay for the return and for sending the replacement.",
      "**For any other exchange**, the customer pays the delivery costs.",
    ],
  },
  {
    icon: ArrowRightLeft,
    title: "6. Refunds",
    paragraphs: [
      "Approved returns are settled with a **replacement** or **store credit**.",
      "**Cash refunds** go back to your Mobile Money number when we cannot replace a damaged or wrong item, for example because it is out of stock.",
    ],
  },
]

export default function ReturnsPolicyPage() {
  return (
    <PolicyPage
      title="Returns & Refunds"
      subtitle={`At ${BRAND_NAME} we want you to love your order. If something is wrong, here is how we put it right.`}
      updated="November 2026"
      sections={sections}
      footer={
        <p>
          Questions about a return?{" "}
          <a href={WHATSAPP_URL} className="font-medium text-rose-primary hover:underline">
            WhatsApp us
          </a>{" "}
          or email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-rose-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
          . See also{" "}
          <Link href="/policies/shipping" className="font-medium text-rose-primary hover:underline">
            delivery &amp; pickup
          </Link>
          .
        </p>
      }
    />
  )
}
