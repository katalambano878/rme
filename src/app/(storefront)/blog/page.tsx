"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Calendar, Clock, BookOpen, Mail } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { blogPosts } from "@/lib/mock-data"

const gradients = [
  "from-rose-200 via-pink-100 to-amber-50",
  "from-violet-200 via-purple-100 to-pink-50",
  "from-amber-100 via-orange-50 to-rose-100",
]

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

export default function BlogPage() {
  return (
    <>
      <Section className="bg-gradient-to-b from-rose-light/50 to-white">
        <Container>
          <Heading
            as="h1"
            align="center"
            subtitle="Beauty tips, skincare guides, and self-care inspiration from our editorial team."
          >
            Beauty Journal
          </Heading>

          <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {blogPosts.map((post, i) => (
              <motion.div
                key={post.id}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
              >
                <Link href={`/blog/${post.slug}`} className="group block">
                  <article className="overflow-hidden rounded-2xl border border-rose-border/30 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div
                      className={`relative aspect-[16/10] bg-gradient-to-br ${gradients[i % gradients.length]}`}
                    >
                      <div className="flex h-full items-center justify-center">
                        <BookOpen className="size-12 text-navy/8" />
                      </div>
                      <div className="absolute top-3 left-3">
                        <Badge className="rounded-full bg-white/90 text-navy backdrop-blur-sm border-0 shadow-sm">
                          {post.category}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-5 sm:p-6">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(post.date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {post.readTime} read
                        </span>
                      </div>

                      <h2 className="mt-3 font-heading text-lg font-semibold text-navy transition-colors group-hover:text-rose-primary">
                        {post.title}
                      </h2>

                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                        {post.excerpt}
                      </p>

                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-rose-primary">
                        Read More
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </article>
                </Link>
              </motion.div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Newsletter CTA */}
      <Section className="bg-gradient-to-b from-white to-rose-light/30">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
            className="mx-auto max-w-xl text-center"
          >
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-light">
              <Mail className="size-6 text-rose-primary" />
            </div>
            <h2 className="mt-5 font-heading text-2xl font-semibold text-navy sm:text-3xl">
              Stay in the Loop
            </h2>
            <p className="mt-3 text-muted-foreground">
              Subscribe to our newsletter for exclusive beauty tips, early access
              to new arrivals, and members-only offers.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
              <Input
                type="email"
                placeholder="Enter your email"
                className="h-11 rounded-xl border-rose-border px-4 sm:w-72 focus-visible:border-rose-primary focus-visible:ring-rose-primary/20"
              />
              <Button className="h-11 rounded-xl bg-rose-100 px-6 text-navy hover:bg-rose-200">
                Subscribe
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              No spam, ever. Unsubscribe anytime.
            </p>
          </motion.div>
        </Container>
      </Section>
    </>
  )
}
