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
  addItem: (
    product: Product,
    quantity?: number,
    size?: string,
    color?: string,
    options?: { openCart?: boolean },
  ) => void
  removeItem: (productId: string, size?: string, color?: string) => void
  updateQuantity: (productId: string, quantity: number, size?: string, color?: string) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

/**
 * Known stock ceiling for a cart line. `product.stock` is the selected
 * variant's stock for variant snapshots (PDP) or the product total otherwise.
 * Returns undefined when stock isn't known, so nothing is clamped.
 */
export function maxStockFor(product: Pick<Product, "stock">): number | undefined {
  const stock = Number(product.stock)
  return Number.isFinite(stock) && stock >= 0 ? Math.floor(stock) : undefined
}

/** True for a simple (no-options) product that has no stock left. */
export function isOutOfStock(product: Pick<Product, "stock" | "variants">): boolean {
  return product.variants.length === 0 && maxStockFor(product) === 0
}

/** True when a cart line already holds every unit we know is in stock. */
export function atStockLimit(product: Pick<Product, "stock">, quantity: number): boolean {
  const max = maxStockFor(product)
  return max !== undefined && quantity >= max
}

function clampQuantity(product: Product, quantity: number): number {
  const max = maxStockFor(product)
  return max === undefined ? quantity : Math.min(quantity, max)
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

      addItem: (product, quantity = 1, size, color, options) => {
        // Nothing can be added once a known stock level is used up.
        if (clampQuantity(product, quantity) <= 0) return
        const isOpen = options?.openCart ?? true
        set(state => {
          const existing = state.items.find(
            i => itemKey(i.product.id, i.selectedSize, i.selectedColor) === itemKey(product.id, size, color)
          )
          if (existing) {
            return {
              items: state.items.map(i =>
                itemKey(i.product.id, i.selectedSize, i.selectedColor) === itemKey(product.id, size, color)
                  ? { ...i, product, quantity: Math.max(1, clampQuantity(product, i.quantity + quantity)) }
                  : i
              ),
              isOpen,
            }
          }
          return {
            items: [
              ...state.items,
              { product, quantity: clampQuantity(product, quantity), selectedSize: size, selectedColor: color },
            ],
            isOpen,
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
              ? { ...i, quantity: Math.max(1, clampQuantity(i.product, quantity)) }
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
