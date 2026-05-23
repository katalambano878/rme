/**
 * Human-readable SKU for UI: initials from product name + last segment of raw SKU
 * (e.g. long variant SKU "ADVANCEDKOREANBODYLOTION-STD" → "AKBL-STD").
 * Use everywhere we show SKU to stay consistent with the admin product list.
 */
export function buildDisplaySku(name: string, rawSku: string): string {
  if (!rawSku || rawSku === 'N/A') return 'N/A';

  const parts = rawSku.split('-').filter(Boolean);
  const suffix = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
  const initials = name
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);

  if (!initials) {
    const base = rawSku.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
    return suffix ? `${base}-${suffix}` : base;
  }

  return suffix ? `${initials}-${suffix}` : initials;
}
