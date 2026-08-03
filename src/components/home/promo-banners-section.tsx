import Link from "next/link"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { HERO_IMAGES } from "@/lib/hero-images"

const banners = [
  {
    badge: "Preorders",
    title: "Reserve Your Favorites",
    subtitle: "Secure pieces before they arrive",
    ctaText: "Shop Preorders",
    ctaHref: "/shop?category=preorders",
    imageSrc: HERO_IMAGES.heels.src,
    imageAlt: HERO_IMAGES.heels.alt,
    bg: "bg-rose-light",
  },
  {
    badge: "New Arrivals",
    title: "Discover The Latest Trends",
    subtitle: undefined,
    ctaText: "Explore Now",
    ctaHref: "/shop?filter=new",
    imageSrc: HERO_IMAGES.purse.src,
    imageAlt: HERO_IMAGES.purse.alt,
    bg: "bg-teal-light",
  },
] as const

export function PromoBannersSection() {
  return (
    <Section className="bg-white py-12 sm:py-16">
      <Container>
        <div className="grid gap-4 md:grid-cols-2 md:gap-5">
          {banners.map((banner) => (
            <article
              key={banner.badge}
              className={`relative overflow-hidden rounded-2xl ${banner.bg} sm:rounded-3xl`}
            >
              <div className="grid min-h-[240px] grid-cols-1 items-center sm:min-h-[280px] sm:grid-cols-2">
                <div className="relative z-10 flex flex-col items-start px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
                  <span className="rounded-full bg-rose-border px-3 py-1 text-[11px] font-semibold tracking-wide text-navy">
                    {banner.badge}
                  </span>
                  <h3 className="mt-4 max-w-[12ch] font-heading text-2xl font-semibold leading-tight tracking-tight text-navy sm:text-3xl lg:text-[2rem]">
                    {banner.title}
                  </h3>
                  {banner.subtitle ? (
                    <p className="mt-2 text-sm text-navy/70">{banner.subtitle}</p>
                  ) : null}
                  <Link
                    href={banner.ctaHref}
                    className="mt-6 inline-flex items-center justify-center rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90"
                  >
                    {banner.ctaText}
                  </Link>
                </div>

                <div className="relative h-[200px] sm:h-full sm:min-h-[280px]">
                  <img
                    src={banner.imageSrc}
                    alt={banner.imageAlt}
                    className="absolute inset-0 h-full w-full object-cover object-center"
                    loading="lazy"
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  )
}
