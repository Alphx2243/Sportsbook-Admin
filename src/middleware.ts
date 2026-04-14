import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type RateLimitContext = {
  count: number;
  startTime: number;
};

const X_LIMIT = Number(process.env.PER_IP_PER_MINUTE) || 30;
const Y_LIMIT = Number(process.env.TOTAL_PER_MINUTE) || 500;
const MINUTE_MS = 60 * 1000;
const ipMap = new Map<string, RateLimitContext>();
let totalContext: RateLimitContext = { count: 0, startTime: Date.now() };

export function middleware(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const now = Date.now();
  if (now - totalContext.startTime > MINUTE_MS) totalContext = { count: 1, startTime: now };
  else totalContext = { count: totalContext.count + 1, startTime: totalContext.startTime };

  if (totalContext.count > Y_LIMIT) return new NextResponse('Too Many Requests (Global Limit Exceeded)', { status: 429 });

  let ipCtx = ipMap.get(ip);

  if (!ipCtx || now - ipCtx.startTime > MINUTE_MS) ipCtx = { count: 1, startTime: now };
  else ipCtx = { count: ipCtx.count + 1, startTime: ipCtx.startTime };

  ipMap.set(ip, ipCtx);
  if (ipMap.size > 10000) ipMap.clear();
  if (ipCtx.count > X_LIMIT) return new NextResponse('Too Many Requests (IP Limit Exceeded)', { status: 429 });
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', X_LIMIT.toString());
  response.headers.set('X-RateLimit-Remaining', Math.max(0, X_LIMIT - ipCtx.count).toString());
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)',],
}
