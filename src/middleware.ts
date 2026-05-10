import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { slidingWindowRateLimiter } from '@/lib/rate-limiter'

const X_LIMIT = Number(process.env.PER_IP_PER_MINUTE) || 60;
const Y_LIMIT = Number(process.env.TOTAL_PER_MINUTE) || 700;
const WINDOW_MS = 60 * 1000; // 1 minute

export async function middleware(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',').at(-1)?.trim()
    ?? request.headers.get('x-real-ip')
    ?? '127.0.0.1';

  const ipResult = await slidingWindowRateLimiter({
    identifier: `ip:${ip}`,
    limit: X_LIMIT,
    windowsMs: WINDOW_MS
  });

  if (!ipResult.success) {
    return new NextResponse('Too Many Requests (IP Limit Exceeded)', { status: 429 });
  }

  const globalResult = await slidingWindowRateLimiter({
    identifier: 'global',
    limit: Y_LIMIT,
    windowsMs: WINDOW_MS
  });

  if (!globalResult.success) {
    return new NextResponse('Too Many Requests (Global Limit Exceeded)', { status: 429 });
  }

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', X_LIMIT.toString());
  response.headers.set('X-RateLimit-Remaining', ipResult.remaining.toString());
  response.headers.set('X-RateLimit-Reset', ipResult.reset.toString());

  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)',],
}
