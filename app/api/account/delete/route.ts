import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient, createClient as createUserClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "../../../../src/lib/supabase/server";
import { PUBLIC_SUPABASE_ANON_KEY, getServerSupabaseSecret, PUBLIC_SUPABASE_URL } from "../../../../src/lib/env/server";
import { applyRateLimit, getRequestIp } from "../../../../src/lib/security/serverRateLimit";

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

export async function DELETE(request: NextRequest) {
  const ip = getRequestIp(request.headers);
  const limiter = await applyRateLimit({
    key: `delete-account:${ip}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!limiter.allowed) {
    return json({ error: "Too many delete-account attempts. Please wait a few minutes and try again." }, 429);
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (!bearerToken && originUrl.host !== host) {
        return json({ error: "Cross-site account deletion requests are not allowed." }, 403);
      }
    } catch {
      if (!bearerToken) {
        return json({ error: "Invalid request origin." }, 400);
      }
    }
  }

  const supabase = await createServerSupabaseClient();
  let {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    if (bearerToken) {
      const userClient = createUserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      const fallbackResult = await userClient.auth.getUser(bearerToken);
      user = fallbackResult.data.user ?? null;
      userError = fallbackResult.error ?? null;
    }
  }

  if (userError || !user) {
    return json({ error: "You need to be logged in to delete your account." }, 401);
  }

  let serviceRoleKey: string;
  try {
    serviceRoleKey = getServerSupabaseSecret();
  } catch {
    return json(
      { error: "Account deletion is temporarily unavailable. Please try again later." },
      500,
    );
  }

  const admin = createAdminClient(PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return json({ error: "We could not delete this account right now. Please try again." }, 500);
  }

  return json({ ok: true });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "DELETE, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}
