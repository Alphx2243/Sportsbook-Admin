import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { slidingWindowRateLimiter } from '@/lib/rate-limiter'
import { verifySessionToken } from '@/lib/auth-config'

const X_LIMIT = Number(process.env.PER_IP_PER_MINUTE) || 60;
const Y_LIMIT = Number(process.env.TOTAL_PER_MINUTE) || 700;
const WINDOW_MS = 60 * 1000; // 1 minute

const allowedOrigins = [
  'https://sportsbook-admin.onrender.com',
];


export async function middleware(request: NextRequest) {


  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin');
    console.log('METHOD:', request.method);
    console.log('ORIGIN:', origin);
    console.log('HOST:', request.nextUrl.host);
    const isServerAction = request.headers.has('next-action');
    if (!isServerAction && origin && !allowedOrigins.includes(origin)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }


  const forwarded = request.headers.get('x-forwarded-for');
  const ip = request.headers.get('x-real-ip')
    ?? forwarded?.split(',')[0]?.trim()
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

  if (request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/booking-scanner')) {
    const session = request.cookies.get('session')?.value;
    if (!session) {
      return redirectOrReject(request);
    }

    try {
      const payload = await verifySessionToken(session);
      if (payload.role !== 'Admin' || !payload.userId) {
        return redirectOrReject(request);
      }
    } catch {
      return redirectOrReject(request);
    }
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

function redirectOrReject(request: NextRequest) {
  if (request.method !== 'GET') {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}
