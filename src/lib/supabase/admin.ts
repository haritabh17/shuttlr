import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Service role client — bypasses RLS. Use only in server-side API routes.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
