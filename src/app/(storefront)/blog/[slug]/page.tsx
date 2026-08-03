"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Calendar,
  Clock,
  BookOpen,
  Share2,
  Globe,
  Link2,
  User,
} from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { HERO_IMAGES } from "@/lib/hero-images"
import { PageHero } from "@/components/shared/page-hero"

type BlogPost = {
  id: string
  title: string
  slug: string
  excerpt: string
  category: string
  cover_image_url: string | null
  content: string | null
  published_at: string | null
  created_at: string
}

export default function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const [post, setPost] = useState<BlogPost | null | undefined>(undefined)
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([])

  useEffect(() => {
    fetch(`/api/blog/${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data: { post?: BlogPost | null; relatedPosts?: BlogPost[] }) => {
        setPost(data.post ?? null)
        setRelatedPosts(Array.isArray(data.relatedPosts) ? data.relatedPosts : [])
      })
      .catch(() => {
        setPost(null)
        setRelatedPosts([])
      })
  }, [slug])

  if (post === undefined) {
    return (
      <Section>
        <Container className="py-20 text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-4 border-rose-border border-t-rose-primary" />
        </Container>
      </Section>
    )
  }

  if (!post) {
    return (
      <Section>
        <Container className="py-20 text-center">
          <h1 className="font-heading text-3xl font-semibold text-navy">
            Post Not Found
          </h1>
          <p className="mt-3 text-muted-foreground">
            The article you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button
            className="mt-6 rounded-xl bg-rose-light text-navy hover:bg-rose-border"
            render={<Link href="/blog" />}
          >
            Back to Journal
          </Button>
        </Container>
      </Section>
    )
  }

  const dateStr = post.published_at || post.created_at

  return (
    <>
      <PageHero
        imageSrc={HERO_IMAGES.ladiesBag.src}
        imageAlt={HERO_IMAGES.ladiesBag.alt}
        align="left"
        title={post.title}
        subtitle={post.excerpt}
        topContent={
          <>
            <Link
              href="/blog"
              className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
            >
              <ArrowLeft className="size-4" />
              Back to Journal
            </Link>

            <Badge className="mb-4 rounded-full border-white/20 bg-white/15 text-white backdrop-blur-sm">
              {post.category}
            </Badge>
          </>
        }
      >
        <div className="mt-6 flex items-center gap-4 text-sm text-white/80">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-4" />
            {new Date(dateStr).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" />
            {post.content
              ? `${Math.max(1, Math.ceil(post.content.split(/\s+/).length / 200))} min read`
              : "4 min read"}
          </span>
        </div>
      </PageHero>

      {/* Featured Image */}
      <Section className="pt-8 pb-0 sm:pt-10 sm:pb-0">
        <Container>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="aspect-[21/9] overflow-hidden rounded-3xl bg-gradient-to-br from-[#244b39]/20 via-rose-light to-amber-50"
          >
            {post.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <BookOpen className="size-16 text-navy/10" />
              </div>
            )}
          </motion.div>
        </Container>
      </Section>

      {/* Article Body */}
      <Section>
        <Container>
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mx-auto max-w-3xl"
          >
            <div className="prose prose-lg max-w-none text-muted-foreground leading-[1.8]">
              {post.content ? (
                post.content.trim().split("\n\n").map((para, i) => (
                  <p key={i} className="mb-4">{para}</p>
                ))
              ) : (
                <p className="text-muted-foreground">{post.excerpt}</p>
              )}
            </div>

            <Separator className="my-10" />

            {/* Share */}
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Share2 className="size-4" />
                Share this article
              </div>
              <div className="flex gap-2">
                {[
                  { icon: Globe, label: "Share" },
                  { icon: Share2, label: "Repost" },
                  { icon: Link2, label: "Copy Link" },
                ].map((s) => (
                  <button
                    key={s.label}
                    aria-label={`Share on ${s.label}`}
                    className="flex size-10 items-center justify-center rounded-xl border border-rose-border/50 text-muted-foreground transition-all hover:border-rose-primary hover:bg-rose-light hover:text-rose-primary"
                  >
                    <s.icon className="size-4" />
                  </button>
                ))}
              </div>
            </div>

            <Separator className="my-10" />

            {/* Author Card */}
            <div className="flex items-center gap-4 rounded-2xl border border-rose-border/50 bg-rose-light/40 p-5">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#244b39]/15 to-rose-light">
                <User className="size-6 text-rose-primary" />
              </div>
              <div>
                <p className="font-heading font-semibold text-navy">
                  Editorial
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Tips and updates from the Trust Ecom team to help you shop
                  with confidence.
                </p>
              </div>
            </div>
          </motion.article>
        </Container>
      </Section>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <Section className="bg-gradient-to-b from-rose-light/30 to-white">
          <Container>
            <h2 className="text-center font-heading text-2xl font-semibold text-navy sm:text-3xl">
              You Might Also Enjoy
            </h2>

            <div className="mt-10 grid gap-8 md:grid-cols-2">
              {relatedPosts.map((rp, i) => (
                <motion.div
                  key={rp.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <Link href={`/blog/${rp.slug}`} className="group block">
                    <article className="overflow-hidden rounded-2xl border border-rose-border/30 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                      <div className="aspect-[16/9] overflow-hidden bg-gradient-to-br from-[#e4eee8] via-[#f7f3ed] to-teal-light">
                        {rp.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={rp.cover_image_url}
                            alt={rp.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <BookOpen className="size-10 text-navy/10" />
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <Badge className="rounded-full bg-rose-light text-rose-primary border-rose-border text-[10px]">
                          {rp.category}
                        </Badge>
                        <h3 className="mt-2 font-heading text-lg font-semibold text-navy group-hover:text-rose-primary">
                          {rp.title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {rp.excerpt}
                        </p>
                      </div>
                    </article>
                  </Link>
                </motion.div>
              ))}
            </div>
          </Container>
        </Section>
      )}
    </>
  )
}
