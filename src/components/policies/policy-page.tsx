import type { Metadata } from "next"
import type { ReactNode } from "react"
import { BRAND_NAME, SITE_DOMAIN } from "@/lib/brand"
import type { LucideIcon } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { Separator } from "@/components/ui/separator"

export type PolicySection = {
  icon?: LucideIcon
  title: string
  /** Paragraphs; `**text**` is shown in bold. */
  paragraphs: string[]
}

/** Render `**bold**` segments inside a paragraph. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((segment, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-navy">
            {segment}
          </strong>
        ) : (
          <span key={i}>{segment}</span>
        ),
      )}
    </>
  )
}

/**
 * Shared layout for the policy pages. Everything is server-rendered and
 * visible without tapping, so customers and Google can read it all.
 */
export function PolicyPage({
  title,
  subtitle,
  updated,
  sections,
  footer,
}: {
  title: string
  subtitle: string
  updated: string
  sections: PolicySection[]
  footer?: ReactNode
}) {
  return (
    <Section className="bg-gradient-to-b from-rose-light/50 to-white">
      <Container>
        <div className="mx-auto max-w-3xl">
          <Heading as="h1" align="center" subtitle={subtitle}>
            {title}
          </Heading>
          <p className="mt-6 text-center text-sm text-muted-foreground">Last updated: {updated}</p>

          <div className="mt-12">
            {sections.map((section, i) => {
              const Icon = section.icon
              return (
                <div key={section.title}>
                  <div className="py-8 first:pt-0">
                    <div className="flex items-center gap-3">
                      {Icon && (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-light">
                          <Icon className="size-5 text-rose-primary" aria-hidden />
                        </div>
                      )}
                      <h2 className="font-heading text-lg font-semibold text-navy">{section.title}</h2>
                    </div>
                    <div className={Icon ? "mt-4 space-y-3 sm:pl-[52px]" : "mt-4 space-y-3"}>
                      {section.paragraphs.map((para, j) => (
                        <p key={j} className="text-[15px] leading-relaxed text-muted-foreground">
                          <Rich text={para} />
                        </p>
                      ))}
                    </div>
                  </div>
                  {i < sections.length - 1 && <Separator className="bg-rose-border/40" />}
                </div>
              )
            })}
          </div>

          {footer && (
            <>
              <Separator className="mt-8 bg-rose-border/40" />
              <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>
            </>
          )}
        </div>
      </Container>
    </Section>
  )
}

/** Title, description and canonical address for one policy page. */
export function policyMetadata(title: string, description: string, path: string): Metadata {
  return {
    title: { absolute: `${title} | ${BRAND_NAME}` },
    description,
    alternates: { canonical: `https://${SITE_DOMAIN}${path}` },
  }
}
