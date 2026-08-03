import bcrypt from "bcryptjs"

/** Compatible with Supabase/GoTrue bcrypt hashes. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  encryptedPassword: string | null | undefined,
): Promise<boolean> {
  if (!encryptedPassword) return false
  try {
    return await bcrypt.compare(password, encryptedPassword)
  } catch {
    return false
  }
}
