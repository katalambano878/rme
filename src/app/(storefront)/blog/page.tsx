import Link from "next/link"
import { ArrowRight, Calendar, Clock, BookOpen } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { Heading } from "@/components/shared/heading"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { BlogNewsletter } from "./blog-newsletter"

type BlogListPost = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string | null
  cover_image_url: string | null
  published_at: string | null
  created_at: string
  read_time_minutes: number | null
}

const gradients = [
  "from-rose-200 via-pink-100 to-amber-50",
  "from-violet-200 via-purple-100 to-pink-50",
  "from-amber-100 via-orange-50 to-rose-100",
]

async function fetchPublishedPosts(): Promise<BlogListPost[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        "id, title, slug, excerpt, category, cover_image_url, published_at, created_at, read_time_minutes",
      )
      .eq("published", true)
      .order("published_at", { ascending: false })
    if (error) {
      console.error("[blog] failed to load posts:", error.message)
      return []
    }
    return (data ?? []) as BlogListPost[]
  } catch (err) {
    console.error("[blog] failed to load posts:", err)
    return []
  }
}

export default async function BlogPage() {
  const posts = await fetchPublishedPosts()

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

          {posts.length === 0 ? (
            <div className="mx-auto mt-14 max-w-md text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rose-light">
                <BookOpen className="size-7 text-rose-primary/60" />
              </div>
              <p className="mt-5 text-muted-foreground">
                New articles are on the way. Check back soon.
              </p>
              <Link
                href="/shop"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-rose-primary hover:underline"
              >
                Browse the shop
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ) : (
            <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, i) => {
                const date = post.published_at || post.created_at
                return (
                  <Link key={post.id} href={`/blog/${post.slug}`} className="group block">
                    <article className="overflow-hidden rounded-2xl border border-rose-border/30 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                      <div
                        className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${gradients[i % gradients.length]}`}
                      >
                        {post.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={post.cover_image_url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <BookOpen className="size-12 text-navy/8" />
                          </div>
                        )}
                        {post.category && (
                          <div className="absolute top-3 left-3">
                            <Badge className="rounded-full bg-white/90 text-navy backdrop-blur-sm border-0 shadow-sm">
                              {post.category}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="p-5 sm:p-6">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          {post.read_time_minutes ? (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {post.read_time_minutes} min read
                            </span>
                          ) : null}
                        </div>

                        <h2 className="mt-3 font-heading text-lg font-semibold text-navy transition-colors group-hover:text-rose-primary">
                          {post.title}
                        </h2>

                        {post.excerpt && (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                            {post.excerpt}
                          </p>
                        )}

                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-rose-primary">
                          Read More
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>
          )}
        </Container>
      </Section>

      <BlogNewsletter />
    </>
  )
}
