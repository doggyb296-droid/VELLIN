import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { MOBILE_AUTH_REDIRECT_URL } from "../../../../src/lib/auth/constants";
import { signupSchema } from "../../../../src/lib/auth/schemas";
import { createClient } from "../../../../src/lib/supabase/server";
import { applyRateLimit, getRequestIp } from "../../../../src/lib/security/serverRateLimit";

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request.headers);
  const limiter = await applyRateLimit({
    key: `auth-signup:${ip}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!limiter.allowed) {
    return json({ error: "Too many signup attempts. Please wait a few minutes and try again." }, 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid signup request body." }, 400);
  }

  try {
    const parsed = signupSchema.parse(payload);
    const supabase = await createClient();
    const emailRedirectTo = parsed.isNative
      ? MOBILE_AUTH_REDIRECT_URL
      : `${new URL("/auth/callback?next=/", request.url).toString()}`;

    const { data, error } = await supabase.auth.signUp({
      email: parsed.email,
      password: parsed.password,
      options: {
        emailRedirectTo,
        data: {
          name: parsed.name,
        },
      },
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    const nextUser = data.user ?? data.session?.user ?? null;
    if (!nextUser?.email) {
      return json({ error: "Account creation did not complete. Please try again." }, 400);
    }

    return json({
      user: {
        id: nextUser.id,
        email: nextUser.email,
      },
      needsEmailConfirmation: !data.session && !nextUser.email_confirmed_at,
      name: parsed.name,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ error: error.issues[0]?.message ?? "Invalid signup request." }, 400);
    }
    return json({ error: "We could not create this account right now. Please try again." }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}
