"use client"

import { motion } from "framer-motion"
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  MessageCircle,
  ExternalLink,
} from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  BRAND_NAME,
  CONTACT_EMAIL,
  GOOGLE_MAPS_URL,
  INSTAGRAM_URL,
  PHONE_DISPLAY_PRIMARY,
  PHONE_INTERNATIONAL_PRIMARY,
  SNAPCHAT_URL,
  TIKTOK_URL,
  WHATSAPP_URL,
} from "@/lib/brand"

type ContactItem = {
  icon: typeof Mail
  label: string
  value: string
  href: string
}

const contactInfo: ContactItem[] = [
  ...(WHATSAPP_URL && PHONE_DISPLAY_PRIMARY
    ? [
        {
          icon: MessageCircle,
          label: "WhatsApp",
          value: PHONE_DISPLAY_PRIMARY,
          href: WHATSAPP_URL,
        },
      ]
    : []),
  ...(PHONE_INTERNATIONAL_PRIMARY
    ? [
        {
          icon: Phone,
          label: "Phone",
          value: PHONE_DISPLAY_PRIMARY || PHONE_INTERNATIONAL_PRIMARY,
          href: `tel:${PHONE_INTERNATIONAL_PRIMARY}`,
        },
      ]
    : []),
  {
    icon: Mail,
    label: "Email",
    value: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
  },
]

const socials = [
  {
    label: "Instagram",
    href: INSTAGRAM_URL,
    icon: (
      <svg viewBox="0 0 24 24" fill="#E4405F" className="size-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: TIKTOK_URL,
    icon: (
      <svg viewBox="0 0 24 24" fill="#000000" className="size-5">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
  {
    label: "Snapchat",
    href: SNAPCHAT_URL,
    icon: (
      <svg viewBox="0 0 24 24" fill="#FFFC00" className="size-5" style={{ filter: "drop-shadow(0 0 1px #999)" }}>
        <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.49-.104.268 0 .543.074.721.214.263.196.375.496.262.769-.113.272-.557.689-1.228.817-.08.015-.158.028-.238.04-.301.053-.665.117-.999.285-.83.405-1.268 1.325-1.268 2.71 0 .304-.233.54-.541.54s-.541-.236-.541-.54c0-1.797.6-3.041 1.79-3.715.409-.218.87-.321 1.259-.408.123-.028.24-.054.345-.083-.075-.13-.17-.24-.29-.323-.227.013-.464.025-.695.025-.425 0-.82-.033-1.165-.1-.142-.028-.282-.063-.42-.1-.003.3-.008.6-.014.9l-.019.9c-.003.3-.005.6-.006.9 0 .3 0 .6.004.9.006.49.063.918.166 1.279.07.247.16.467.271.657.36.621.942 1.017 1.732 1.17.239.048.486.072.733.072.233 0 .475-.02.717-.061.187-.03.374-.073.553-.131.267-.085.536-.086.746.035.21.12.33.34.322.576-.016.434-.317.786-.758.906-.44.12-.893.18-1.35.18-.352 0-.706-.035-1.06-.105-.428-.084-.856-.21-1.274-.375-.352-.136-.72-.203-1.097-.203-.376 0-.74.065-1.093.196-.4.145-.812.26-1.226.341-.351.068-.7.103-1.05.103-.414 0-.83-.056-1.243-.167-.47-.125-.777-.493-.793-.963-.016-.47.27-.87.72-.992.2-.056.398-.085.593-.085.23 0 .458.04.68.12.147.052.295.1.444.14.28.076.57.114.86.114.2 0 .4-.019.595-.057.782-.152 1.356-.547 1.71-1.172.11-.19.197-.407.265-.648.1-.356.155-.779.16-1.265.005-.3.004-.6.002-.9-.002-.3-.006-.6-.012-.9l-.017-.9c-.005-.298-.009-.596-.012-.894-.133.035-.268.067-.406.094-.327.065-.69.097-1.099.097-.213 0-.42-.009-.62-.027l-.1-.01c.075.097.14.205.185.325.104.135.168.302.168.49 0 .463-.374.844-.832.844-.288 0-.545-.147-.698-.37-.34-.48-.94-.779-1.61-.779-.668 0-1.27.3-1.61.78-.152.222-.41.369-.698.369-.458 0-.832-.38-.832-.843 0-.188.064-.355.168-.49.045-.12.11-.228.185-.325l-.1.01c-.2.018-.407.027-.62.027-.41 0-.772-.032-1.099-.097-.138-.027-.273-.059-.406-.094-.003.298-.007.596-.012.894l-.017.9-.012.9c-.002.3-.003.6.002.9.005.486.06.909.16 1.265.068.241.155.458.265.648.354.625.928 1.02 1.71 1.172.195.038.395.057.595.057.29 0 .58-.038.86-.114.149-.04.297-.088.444-.14.222-.08.45-.12.68-.12.195 0 .393.029.593.085.45.122.736.522.72.992-.016.47-.323.838-.793.963-.413.111-.829.167-1.243.167-.35 0-.699-.035-1.05-.103-.414-.081-.826-.196-1.226-.341-.353-.131-.717-.196-1.093-.196-.377 0-.745.067-1.097.203-.418.165-.846.291-1.274.375-.354.07-.708.105-1.06.105-.457 0-.91-.06-1.35-.18-.441-.12-.742-.472-.758-.906-.008-.236.112-.456.322-.576.21-.121.479-.12.746-.035.179.058.366.101.553.131.242.041.484.061.717.061.247 0 .494-.024.733-.072.79-.153 1.372-.549 1.732-1.17.111-.19.201-.41.271-.657.103-.361.16-.789.166-1.279.004-.3.004-.6.004-.9-.001-.3-.003-.6-.006-.9l-.019-.9c-.006-.3-.011-.6-.014-.9-.138.037-.278.072-.42.1-.345.067-.74.1-1.165.1-.231 0-.468-.012-.695-.025-.12.083-.215.193-.29.323.105.029.222.055.345.083.389.087.85.19 1.259.408 1.19.674 1.79 1.918 1.79 3.715 0 .304-.233.54-.541.54s-.541-.236-.541-.54c0-1.385-.438-2.305-1.268-2.71-.334-.168-.698-.232-.999-.285-.08-.012-.158-.025-.238-.04-.671-.128-1.115-.545-1.228-.817-.113-.273.001-.573.262-.769.178-.14.453-.214.721-.214.146 0 .325.016.49.104.374.181.733.285 1.033.301.198 0 .326-.045.401-.09-.008-.165-.018-.33-.03-.51l-.003-.06c-.104-1.628-.23-3.654.299-4.847C7.859 1.069 11.216.793 12.206.793z" />
      </svg>
    ),
  },
].filter((s) => s.href)

const hours = [
  { day: "Monday — Friday", time: "9:00 AM — 6:00 PM" },
  { day: "Saturday", time: "10:00 AM — 4:00 PM" },
  { day: "Sunday", time: "Closed" },
]

export default function ContactPage() {
  return (
    <>
      <Section className="bg-gradient-to-b from-rose-light/50 to-white">
        <Container>
          <Heading
            as="h1"
            align="center"
            subtitle={`We'd love to hear from you. Reach out to ${BRAND_NAME} for orders, support, or general inquiries.`}
          >
            Get in Touch
          </Heading>

          <div className="mt-14 grid gap-12 lg:grid-cols-5 lg:gap-16">
            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
              className="lg:col-span-3"
            >
              <div className="rounded-3xl border border-rose-border/50 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="font-heading text-xl font-semibold text-navy">
                  Send Us a Message
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fill in the form below and we&apos;ll get back to you within
                  24 hours.
                </p>

                <div className="mt-6 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Your Name</Label>
                      <Input
                        id="contactName"
                        placeholder="Full name"
                        className="h-10 rounded-xl border-rose-border focus-visible:border-rose-primary focus-visible:ring-rose-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Email Address</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        placeholder="you@example.com"
                        className="h-10 rounded-xl border-rose-border focus-visible:border-rose-primary focus-visible:ring-rose-primary/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select defaultValue="General">
                      <SelectTrigger className="h-10 w-full rounded-xl border-rose-border">
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General">
                          General Inquiry
                        </SelectItem>
                        <SelectItem value="Order Issue">
                          Order Issue
                        </SelectItem>
                        <SelectItem value="Returns">
                          Returns & Exchanges
                        </SelectItem>
                        <SelectItem value="Partnership">
                          Partnership Opportunity
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactMessage">Message</Label>
                    <Textarea
                      id="contactMessage"
                      placeholder="Tell us how we can help…"
                      className="min-h-32 rounded-xl border-rose-border focus-visible:border-rose-primary focus-visible:ring-rose-primary/20"
                    />
                  </div>

                  <Button className="w-full gap-2 rounded-xl bg-rose-100 py-3 text-navy hover:bg-rose-200 sm:w-auto sm:px-8">
                    <Send className="size-4" />
                    Send Message
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.15,
                ease: [0.22, 1, 0.36, 1] as const,
              }}
              className="space-y-8 lg:col-span-2"
            >
              <div className="space-y-5">
                {contactInfo.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-start gap-4 rounded-2xl border border-rose-border/50 bg-white p-4 shadow-sm transition-all hover:border-rose-primary/30 hover:shadow-md"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-light">
                      <item.icon className="size-5 text-rose-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-0.5 font-medium text-navy">
                        {item.value}
                      </p>
                    </div>
                  </a>
                ))}
              </div>

              {GOOGLE_MAPS_URL ? (
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 rounded-2xl border border-rose-border/50 bg-white p-4 shadow-sm transition-all hover:border-rose-primary/30 hover:shadow-md"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-light">
                    <MapPin className="size-5 text-rose-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Location
                    </p>
                    <p className="mt-0.5 font-medium text-navy">View on Google Maps</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-sm text-rose-primary">
                      Open in Maps
                      <ExternalLink className="size-3.5" />
                    </p>
                  </div>
                </a>
              ) : null}

              {/* Operating Hours */}
              <div className="rounded-2xl border border-rose-border/50 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-navy">
                  <Clock className="size-5 text-rose-primary" />
                  <h3 className="font-heading font-semibold">
                    Operating Hours
                  </h3>
                </div>
                <div className="mt-3 space-y-2">
                  {hours.map((h) => (
                    <div
                      key={h.day}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{h.day}</span>
                      <span className="font-medium text-navy">{h.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Socials */}
              {socials.length > 0 ? (
                <div className="rounded-2xl border border-rose-border/50 bg-white p-5 shadow-sm">
                  <h3 className="font-heading font-semibold text-navy">
                    Follow Us
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {socials.map((s) => (
                      <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.label}
                        className="flex size-10 items-center justify-center rounded-xl border border-rose-border/50 transition-all hover:border-rose-primary hover:bg-rose-light"
                      >
                        {s.icon}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* WhatsApp CTA */}
              {WHATSAPP_URL ? (
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3.5 font-medium text-white shadow-sm transition-all hover:bg-[#20BD5A] hover:shadow-md"
                >
                  <MessageCircle className="size-5" />
                  Chat on WhatsApp
                </a>
              ) : null}

              {/* Map visual */}
              {GOOGLE_MAPS_URL ? (
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-2xl transition-opacity hover:opacity-95"
                >
                  <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-rose-100 via-pink-50 to-amber-50">
                    <div className="text-center">
                      <MapPin className="mx-auto size-8 text-rose-primary/40" />
                      <p className="mt-2 text-sm font-medium text-navy/70">
                        Tap to open location on Google Maps
                      </p>
                    </div>
                  </div>
                </a>
              ) : null}
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  )
}
