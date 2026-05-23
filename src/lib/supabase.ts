import { createClient } from "@/lib/supabase/client"

// Compatibility client used by imported admin pages.
export const supabase = createClient()
