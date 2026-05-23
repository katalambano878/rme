import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Product } from "@/types/product"

export type CartItem = {
  product: Product
  quantity: number
  selectedSize?: string
  selectedColor?: string
}

type CartState = {
  items: CartItem[]
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
  addItem: (product: Product, quantity?: number, size?: string, color?: string) => void
  removeItem: (productId: string, size?: string, color?: string) => void
  updateQuantity: (productId: string, quantity: number, size?: string, color?: string) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

function itemKey(productId: string, size?: string, color?: string) {
  return `${productId}-${size || ""}-${color || ""}`
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set(state => ({ isOpen: !state.isOpen })),

      addItem: (product, quantity = 1, size, color) => {
        set(state => {
          const existing = state.items.find(
            i => itemKey(i.product.id, i.selectedSize, i.selectedColor) === itemKey(product.id, size, color)
          )
          if (existing) {
            return {
              items: state.items.map(i =>
                itemKey(i.product.id, i.selectedSize, i.selectedColor) === itemKey(product.id, size, color)
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
              isOpen: true,
            }
          }
          return {
            items: [...state.items, { product, quantity, selectedSize: size, selectedColor: color }],
            isOpen: true,
          }
        })
      },

      removeItem: (productId, size, color) => {
        set(state => ({
          items: state.items.filter(
            i => itemKey(i.product.id, i.selectedSize, i.selectedColor) !== itemKey(productId, size, color)
          ),
        }))
      },

      updateQuantity: (productId, quantity, size, color) => {
        if (quantity <= 0) {
          get().removeItem(productId, size, color)
          return
        }
        set(state => ({
          items: state.items.map(i =>
            itemKey(i.product.id, i.selectedSize, i.selectedColor) === itemKey(productId, size, color)
              ? { ...i, quantity }
              : i
          ),
        }))
      },

      clearCart: () => set({ items: [] }),

      getTotal: () => {
        const { items } = get()
        return items.reduce((sum, item) => {
          const price = item.product.salePrice ?? item.product.price
          return sum + price * item.quantity
        }, 0)
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
      },
    }),
    {
      name: "storefront-cart",
      partialize: (state) => ({ items: state.items }),
    }
  )
)
