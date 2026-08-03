"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  User,
  Package,
  Heart,
  MapPin,
  Edit,
  Trash2,
  Plus,
  ChevronRight,
  ShoppingBag,
} from "lucide-react"
import { Container } from "@/components/shared/container"
import { Section } from "@/components/shared/section"
import { ProductCard } from "@/components/shared/product-card"
import { useWishlistStore } from "@/lib/store/wishlist-store"
import { formatPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { CONTACT_EMAIL } from "@/lib/brand"
import { HERO_IMAGES } from "@/lib/hero-images"
import { PageHero } from "@/components/shared/page-hero"

const tabs = [
  { value: "profile", label: "Profile", icon: User },
  { value: "orders", label: "Orders", icon: Package },
  { value: "wishlist", label: "Wishlist", icon: Heart },
  { value: "addresses", label: "Addresses", icon: MapPin },
] as const

const mockOrders = [
  {
    id: "ORD-7K3F-A2XN",
    date: "March 18, 2026",
    status: "Delivered" as const,
    items: 2,
    total: 730,
  },
  {
    id: "ORD-9M1P-D4YZ",
    date: "March 12, 2026",
    status: "Shipped" as const,
    items: 1,
    total: 280,
  },
  {
    id: "ORD-5R8W-G7HQ",
    date: "March 8, 2026",
    status: "Processing" as const,
    items: 3,
    total: 1150,
  },
]

const statusColors = {
  Delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Shipped: "bg-blue-50 text-blue-700 border-blue-200",
  Processing: "bg-amber-50 text-amber-700 border-amber-200",
}

const mockAddresses = [
  {
    id: "addr-1",
    label: "Home",
    name: "Sample Customer",
    line1: "123 Example Street",
    line2: "Suite 4",
    city: "Example City",
    region: "Example Region",
    phone: "000 000 0000",
    isDefault: true,
  },
  {
    id: "addr-2",
    label: "Office",
    name: "Sample Customer",
    line1: "400 Commerce Blvd",
    line2: "Floor 3",
    city: "Example City",
    region: "Example Region",
    phone: "000 000 0001",
    isDefault: false,
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

function ProfileTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div>
        <h3 className="font-heading text-xl font-semibold text-navy">
          Personal Information
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your personal details and preferences.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            defaultValue="Sample"
            className="h-10 rounded-xl border-rose-border focus-visible:border-rose-primary focus-visible:ring-rose-primary/20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            defaultValue="Customer"
            className="h-10 rounded-xl border-rose-border focus-visible:border-rose-primary focus-visible:ring-rose-primary/20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            defaultValue=""
            placeholder={CONTACT_EMAIL}
            className="h-10 rounded-xl border-rose-border focus-visible:border-rose-primary focus-visible:ring-rose-primary/20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            defaultValue=""
            placeholder="Phone number"
            className="h-10 rounded-xl border-rose-border focus-visible:border-rose-primary focus-visible:ring-rose-primary/20"
          />
        </div>
      </div>

      <Button className="rounded-xl bg-rose-light px-8 py-2.5 text-navy hover:bg-rose-border">
        Save Changes
      </Button>
    </motion.div>
  )
}

function OrdersTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h3 className="font-heading text-xl font-semibold text-navy">
          Order History
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Track and manage your recent orders.
        </p>
      </div>

      <div className="space-y-4">
        {mockOrders.map((order, i) => (
          <motion.div
            key={order.id}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <Card className="overflow-hidden rounded-2xl border-rose-border/50 ring-0 shadow-none border">
              <CardContent className="p-0">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <p className="font-heading font-semibold text-navy">
                        {order.id}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColors[order.status]}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.date} · {order.items}{" "}
                      {order.items === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-heading text-lg font-semibold text-navy">
                      {formatPrice(order.total)}
                    </p>
                    <Button
                      variant="outline"
                      className="gap-1.5 rounded-xl border-rose-border text-navy hover:border-rose-primary hover:text-rose-primary"
                    >
                      View Details
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function WishlistTab() {
  const items = useWishlistStore((s) => s.items)

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <div className="flex size-20 items-center justify-center rounded-full bg-rose-light">
          <Heart className="size-8 text-rose-soft" />
        </div>
        <h3 className="mt-6 font-heading text-xl font-semibold text-navy">
          Your wishlist is empty
        </h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Save pieces you love by tapping the heart icon on any product. Your
          curated collection will appear here.
        </p>
        <Button
          className="mt-6 gap-2 rounded-xl border border-rose-border bg-rose-light px-6 text-rose-primary hover:bg-rose-light"
          render={<a href="/shop" />}
        >
          <ShoppingBag className="size-4" />
          Start Shopping
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h3 className="font-heading text-xl font-semibold text-navy">
          My Wishlist
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "piece" : "pieces"} you&apos;ve
          saved.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </motion.div>
  )
}

function AddressesTab() {
  const [showForm, setShowForm] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-heading text-xl font-semibold text-navy">
            Saved Addresses
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your delivery addresses.
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-1.5 rounded-xl bg-rose-light text-navy hover:bg-rose-border"
        >
          <Plus className="size-4" />
          Add New
        </Button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3 }}
        >
          <Card className="rounded-2xl border-rose-border/50 ring-0 shadow-none border">
            <CardContent className="space-y-4 p-5">
              <h4 className="font-heading font-semibold text-navy">
                New Address
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="addrLabel">Label</Label>
                  <Input
                    id="addrLabel"
                    placeholder="e.g. Home, Office"
                    className="h-10 rounded-xl border-rose-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addrName">Full Name</Label>
                  <Input
                    id="addrName"
                    placeholder="Full name"
                    className="h-10 rounded-xl border-rose-border"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="addrLine1">Address Line 1</Label>
                  <Input
                    id="addrLine1"
                    placeholder="Street address"
                    className="h-10 rounded-xl border-rose-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addrCity">City</Label>
                  <Input
                    id="addrCity"
                    placeholder="City"
                    className="h-10 rounded-xl border-rose-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addrPhone">Phone</Label>
                  <Input
                    id="addrPhone"
                    placeholder="Phone number"
                    className="h-10 rounded-xl border-rose-border"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button className="rounded-xl bg-rose-light text-navy hover:bg-rose-border">
                  Save Address
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border-rose-border"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {mockAddresses.map((addr, i) => (
          <motion.div
            key={addr.id}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <Card className="relative rounded-2xl border-rose-border/50 ring-0 shadow-none border">
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center gap-2">
                  <h4 className="font-heading font-semibold text-navy">
                    {addr.label}
                  </h4>
                  {addr.isDefault && (
                    <Badge className="bg-rose-light text-rose-primary border-rose-border text-[10px]">
                      Default
                    </Badge>
                  )}
                </div>
                <div className="space-y-0.5 text-sm text-muted-foreground">
                  <p>{addr.name}</p>
                  <p>{addr.line1}</p>
                  {addr.line2 && <p>{addr.line2}</p>}
                  <p>
                    {addr.city}, {addr.region}
                  </p>
                  <p>{addr.phone}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-lg border-rose-border text-navy hover:border-rose-primary hover:text-rose-primary"
                  >
                    <Edit className="size-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-lg border-rose-border text-muted-foreground hover:border-red-300 hover:text-red-600"
                  >
                    <Trash2 className="size-3" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<string>("profile")

  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab")
    if (tabParam && tabs.some((tab) => tab.value === tabParam)) {
      setActiveTab(tabParam)
    }
  }, [])

  return (
    <>
      <PageHero
        imageSrc={HERO_IMAGES.purse.src}
        imageAlt={HERO_IMAGES.purse.alt}
        title="My Account"
        subtitle="Manage your profile, orders, wishlist, and delivery addresses."
      />

      <Section className="min-h-screen bg-white">
        <Container>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList
              className="mb-8 flex h-auto w-full flex-wrap gap-1 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-rose-border/50 sm:w-fit"
            >
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all data-active:border data-active:border-rose-border data-active:bg-rose-light data-active:text-rose-primary data-active:shadow-none hover:text-navy"
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="profile">
              <ProfileTab />
            </TabsContent>
            <TabsContent value="orders">
              <OrdersTab />
            </TabsContent>
            <TabsContent value="wishlist">
              <WishlistTab />
            </TabsContent>
            <TabsContent value="addresses">
              <AddressesTab />
            </TabsContent>
          </Tabs>
      </Container>
    </Section>
    </>
  )
}
