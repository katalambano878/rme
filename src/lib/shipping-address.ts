/**
 * Normalize shipping/billing address objects from the database.
 *
 * The orders table stores shipping_address as a free-form JSONB. Different
 * writers historically used different key names:
 *
 *   - Storefront checkout (/api/paystack/initialize, chat-tools.ts) writes:
 *       { firstName, lastName, address1, address2, city, region, country, postalCode }
 *
 *   - Admin POS (admin/pos/page.tsx) writes:
 *       { firstName, lastName, address, city, region }
 *
 *   - Older / external sources may use:
 *       { full_name, address_line1, address_line2, state, postal_code, zip }
 *
 * Without normalization the admin order detail page reads `address` (POS only)
 * and misses the customer's street address for every storefront and chat
 * checkout — exactly the bug the team reported when packaging orders.
 *
 * This helper accepts any shape and returns a single canonical object so the
 * UI can render packing slips, shipping labels, and the order detail card
 * regardless of which checkout flow created the order.
 */

export interface NormalizedShippingAddress {
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string
  /** Primary street address (line 1) */
  address1: string
  /** Optional secondary line (apartment, unit, etc.) */
  address2: string
  city: string
  /** Ghanaian region or US/EU state */
  region: string
  country: string
  postalCode: string
}

const pickString = (...candidates: unknown[]): string => {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim()
  }
  return ""
}

export function normalizeShippingAddress(
  raw: Record<string, unknown> | null | undefined,
): NormalizedShippingAddress {
  const a = (raw || {}) as Record<string, unknown>

  const firstName = pickString(a.firstName, a.first_name)
  const lastName = pickString(a.lastName, a.last_name)
  const fullName = pickString(a.full_name, a.fullName, [firstName, lastName].filter(Boolean).join(" "))

  return {
    firstName,
    lastName,
    fullName,
    email: pickString(a.email),
    phone: pickString(a.phone, a.phone_number, a.phoneNumber),
    address1: pickString(a.address1, a.address, a.address_line1, a.addressLine1, a.street),
    address2: pickString(a.address2, a.address_line2, a.addressLine2, a.apartment, a.unit),
    city: pickString(a.city, a.town),
    region: pickString(a.region, a.state, a.province),
    country: pickString(a.country),
    postalCode: pickString(a.postalCode, a.postal_code, a.zip, a.zipCode, a.zip_code),
  }
}

/**
 * True when the address has enough info to actually deliver — at minimum a
 * street line and a city. Used to flag "Incomplete shipping address" warnings.
 */
export function isAddressComplete(addr: NormalizedShippingAddress): boolean {
  return Boolean(addr.address1 && addr.city)
}
