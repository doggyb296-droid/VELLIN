import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { loginSchema } from "../../../../src/lib/auth/schemas";
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
    key: `auth-login:${ip}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!limiter.allowed) {
    return json({ error: "Too many login attempts. Please wait a few minutes and try again." }, 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid login request body." }, 400);
  }

  try {
    const parsed = loginSchema.parse(payload);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    if (!data.user?.email) {
      return json({ error: "Login did not complete. Please try again." }, 400);
    }

    return json({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ error: error.issues[0]?.message ?? "Invalid login request." }, 400);
    }
    return json({ error: "We could not sign you in right now. Please try again." }, 500);
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
