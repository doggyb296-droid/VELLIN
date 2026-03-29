import { NextRequest, NextResponse } from 'next/server';
import { authCallbackSchema } from '../../../src/lib/auth/schemas';
import { createClient } from '../../../src/lib/supabase/server';
import { applyRateLimit, getRequestIp } from '../../../src/lib/security/serverRateLimit';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const parsed = authCallbackSchema.safeParse({
    code: searchParams.get('code') ?? undefined,
    next: searchParams.get('next') ?? undefined,
  });
  const ip = getRequestIp(request.headers);
  const limiter = await applyRateLimit({
    key: `auth-callback:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });

  if (!limiter.allowed) {
    return NextResponse.redirect(`${origin}/?auth_error=rate_limited`);
  }

  if (!parsed.success) {
    return NextResponse.redirect(`${origin}/?auth_error=invalid_callback`);
  }

  if (parsed.data.code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(parsed.data.code);
    if (error) {
      return NextResponse.redirect(`${origin}/?auth_error=callback_failed`);
    }
  }

  return NextResponse.redirect(`${origin}${parsed.data.next ?? "/"}`, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
