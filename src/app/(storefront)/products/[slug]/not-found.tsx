import Link from "next/link"
import { Package } from "lucide-react"
import { Container } from "@/components/shared/container"
import { Button } from "@/components/ui/button"

export default function ProductNotFound() {
  return (
    <div className="min-h-screen bg-white">
      <Container className="flex flex-col items-center justify-center py-32 text-center">
        <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-rose-light">
          <Package className="size-10 text-rose-primary/50" />
        </div>
        <h1 className="mt-8 font-heading text-3xl font-semibold text-navy">
          Product Not Found
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          The product you&apos;re looking for doesn&apos;t exist or may have been
          removed. Explore the shop to find something you&apos;ll love.
        </p>
        <Link href="/shop" className="mt-8 inline-block">
          <Button className="rounded-full bg-rose-100 px-8 py-2.5 text-navy hover:bg-rose-200">
            Continue Shopping
          </Button>
        </Link>
      </Container>
    </div>
  )
}
