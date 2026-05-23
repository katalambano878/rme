import { createAdminClient } from "@/lib/supabase/admin"

// Compatibility admin client used by imported auth utilities.
export const supabaseAdmin = createAdminClient()
