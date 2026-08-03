"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Star, Quote } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { testimonials as staticTestimonials } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type Testimonial = {
  id: string
  name: string
  location: string
  content: string
  rating: number
  avatar: string
  product: string
}

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
}

const fadeUp = {
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
}

export function TestimonialsSection() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(staticTestimonials as Testimonial[])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("testimonials")
      .select("id, name, location, content, rating, avatar, product")
      .eq("is_active", true)
      .order("sort_order")
      .limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) setTestimonials(data as Testimonial[])
      })
  }, [])

  return (
    <Section className="bg-rose-light/50">
      <Container>
        <Heading
          as="h2"
          subtitle="What our customers are saying"
          align="center"
        >
          What They&rsquo;re Saying
        </Heading>

        <motion.div
          variants={stagger}
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {testimonials.slice(0, 3).map((t) => (
            <motion.div
              key={t.id}
              variants={fadeUp}
              className="rounded-2xl bg-white p-6 luxury-shadow transition-shadow duration-300 hover:luxury-shadow-lg sm:p-8"
            >
              <div className="mb-4 flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "size-4",
                      i < t.rating
                        ? "fill-amber-400 text-amber-400"
                        : "fill-gray-200 text-gray-200",
                    )}
                  />
                ))}
              </div>

              <div className="relative mb-6">
                <Quote className="absolute -left-1 -top-1 size-8 text-rose-primary/10" />
                <p className="pl-6 text-sm leading-relaxed text-navy/80">{t.content}</p>
              </div>

              <div className="flex items-center gap-3 border-t border-rose-border/30 pt-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-primary to-rose-soft">
                  <span className="text-sm font-bold text-white">{t.name[0]}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.location} ·{" "}
                    <span className="text-rose-primary">{t.product}</span>
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </Section>
  )
}
