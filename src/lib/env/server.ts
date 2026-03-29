import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from "./public";
import { requireEnv } from "./shared";

export { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL };

export const getServerSupabaseSecret = () =>
  requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY,
  );
