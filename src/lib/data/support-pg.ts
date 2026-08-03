import { queryOne } from "@/lib/db"

export async function tableExists(tableName: string): Promise<boolean> {
  try {
    const row = await queryOne<{ exists: boolean }>(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      [`public.${tableName}`],
    )
    return Boolean(row?.exists)
  } catch {
    return false
  }
}

export function supportUnavailable(message = "Support module tables are not configured on this database") {
  return Response.json({ error: message, data: [], total: 0 }, { status: 501 })
}
