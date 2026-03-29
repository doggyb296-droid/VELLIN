import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { forgotPasswordSchema } from "../../../../src/lib/auth/schemas";
import { createClient } from "../../../../src/lib/supabase/server";
import { applyRateLimit, getRequestIp } from "../../../../src/lib/security/serverRateLimit";

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

const buildRecoveryRedirect = (request: NextRequest, isNative: boolean) => {
  if (isNative) {
    return "vellin://auth/callback?next=/?reset_password=1";
  }

  return new URL("/auth/callback?next=/?reset_password=1", request.url).toString();
};

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request.headers);
  const limiter = await applyRateLimit({
    key: `auth-forgot-password:${ip}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!limiter.allowed) {
    return json({ error: "Too many reset requests. Please wait a few minutes and try again." }, 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid password reset request body." }, 400);
  }

  try {
    const parsed = forgotPasswordSchema.parse(payload);
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.email, {
      redirectTo: buildRecoveryRedirect(request, parsed.isNative),
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({
      ok: true,
      message: "If that email exists, we sent a password reset link.",
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ error: error.issues[0]?.message ?? "Invalid password reset request." }, 400);
    }
    return json({ error: "We could not send a reset link right now. Please try again." }, 500);
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
