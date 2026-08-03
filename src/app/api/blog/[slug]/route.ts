import { NextResponse } from "next/server"
import {
  fetchPublishedBlogPostBySlug,
  fetchRelatedBlogPosts,
} from "@/lib/storefront-content"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  try {
    const post = await fetchPublishedBlogPostBySlug(slug)
    if (!post) {
      return NextResponse.json({ post: null, relatedPosts: [] })
    }
    const relatedPosts = await fetchRelatedBlogPosts(slug, 2)
    return NextResponse.json({ post, relatedPosts })
  } catch {
    return NextResponse.json({ post: null, relatedPosts: [] })
  }
}
