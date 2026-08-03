import { api } from "@/lib/api"

export async function deleteProductAndDependencies(
  productId: string,
): Promise<{ error: unknown }> {
  try {
    await api(`/api/catalog/products/${productId}`, { method: "DELETE" })
    return { error: null }
  } catch (err) {
    return { error: err }
  }
}
