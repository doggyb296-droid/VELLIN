import { createBrowserClient } from "@supabase/ssr";
import { createClient as createNativeClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from "../env/public";

export function createClient() {
  if (Capacitor.isNativePlatform()) {
    return createNativeClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        storageKey: "sb-vellin-auth",
      },
    });
  }

  return createBrowserClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: {
        name: "sb-vellin-auth",
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
  );
}
