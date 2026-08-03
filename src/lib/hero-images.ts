export const HERO_IMAGES = {
  purse: {
    src: "/images/home/hero-purse.png",
    alt: "Elegant designer purse in a luxury studio setting",
  },
  heels: {
    src: "/images/home/hero-heels.png",
    alt: "Stylish women's high heels in a premium fashion showcase",
  },
  ladiesBag: {
    src: "/images/home/hero-ladies-bag.png",
    alt: "Luxury ladies bags arranged in an elegant display",
  },
} as const

export const HOME_HERO_SLIDES = [
  HERO_IMAGES.purse,
  HERO_IMAGES.heels,
  HERO_IMAGES.ladiesBag,
] as const
