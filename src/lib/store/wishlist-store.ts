import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Product } from "@/types/product"

type WishlistState = {
  items: Product[]
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  toggleItem: (product: Product) => void
  isInWishlist: (productId: string) => boolean
  clearWishlist: () => void
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        set(state => {
          if (state.items.find(i => i.id === product.id)) return state
          return { items: [...state.items, product] }
        })
      },

      removeItem: (productId) => {
        set(state => ({
          items: state.items.filter(i => i.id !== productId),
        }))
      },

      toggleItem: (product) => {
        const { items } = get()
        if (items.find(i => i.id === product.id)) {
          get().removeItem(product.id)
        } else {
          get().addItem(product)
        }
      },

      isInWishlist: (productId) => {
        return get().items.some(i => i.id === productId)
      },

      clearWishlist: () => set({ items: [] }),
    }),
    { name: "storefront-wishlist" }
  )
)
