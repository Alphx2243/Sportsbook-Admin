import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { slidingWindowRateLimiter } from '@/lib/rate-limiter'
import { verifySessionToken } from '@/lib/auth-config'
import { canAccessAdminPath, getDefaultRouteForRole, isPortalRole } from '@/lib/roles'

const X_LIMIT = Number(process.env.PER_IP_PER_MINUTE) || 60;
const READ_GLOBAL_LIMIT = Number(process.env.READ_TOTAL_PER_MINUTE) || Number(process.env.TOTAL_PER_MINUTE) || 3000;
const WRITE_GLOBAL_LIMIT = Number(process.env.WRITE_TOTAL_PER_MINUTE) || 1000;
const WINDOW_MS = 60 * 1000;

const allowedOrigins = [
  'https://sportsbook-admin.onrender.com',
];


export async function middleware(request: NextRequest) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const isServerAction = request.headers.has('next-action');
    if (!isServerAction && origin && !allowedOrigins.includes(origin)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const skipRateLimit = shouldSkipRateLimit(request);
  let ipResult: Awaited<ReturnType<typeof slidingWindowRateLimiter>> | null = null;
  let globalResult: Awaited<ReturnType<typeof slidingWindowRateLimiter>> | null = null;
  let globalLimit = 0;

  if (!skipRateLimit) {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = request.headers.get('x-real-ip')
      ?? forwarded?.split(',')[0]?.trim()
      ?? '127.0.0.1';

    ipResult = await slidingWindowRateLimiter({
      identifier: `ip:${ip}`,
      limit: X_LIMIT,
      windowsMs: WINDOW_MS
    });

    if (!ipResult.success) {
      return new NextResponse('Too Many Requests (IP Limit Exceeded)', { status: 429 });
    }

    const routeClass = getRouteClass(request);
    globalLimit = request.method === 'GET' || request.method === 'HEAD' ? READ_GLOBAL_LIMIT : WRITE_GLOBAL_LIMIT;
    globalResult = await slidingWindowRateLimiter({
      identifier: `global:${routeClass}:${request.method}`,
      limit: globalLimit,
      windowsMs: WINDOW_MS
    });

    if (!globalResult.success) {
      return new NextResponse('Too Many Requests (Global Limit Exceeded)', { status: 429 });
    }
  }

  if (request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/booking-scanner')) {
    const session = request.cookies.get('session')?.value;
    if (!session) {
      return redirectOrReject(request);
    }

    try {
      const payload = await verifySessionToken(session);
      if (!payload.userId || !isPortalRole(payload.role)) {
        return redirectOrReject(request);
      }

      if (!canAccessAdminPath(payload.role, request.nextUrl.pathname)) {
        return redirectOrReject(request, getDefaultRouteForRole(payload.role));
      }
    } catch {
      return redirectOrReject(request);
    }
  }

  const response = NextResponse.next();
  if (ipResult && globalResult) {
    response.headers.set('X-RateLimit-Limit', X_LIMIT.toString());
    response.headers.set('X-RateLimit-Remaining', ipResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', ipResult.reset.toString());
    response.headers.set('X-Global-RateLimit-Limit', globalLimit.toString());
    response.headers.set('X-Global-RateLimit-Remaining', globalResult.remaining.toString());
  }

  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)',],
}

function redirectOrReject(request: NextRequest, redirectPath = '/login') {
  if (request.method !== 'GET') {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const loginUrl = new URL(redirectPath, request.url);
  return NextResponse.redirect(loginUrl);
}

function shouldSkipRateLimit(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (request.method === 'OPTIONS') return true
  if (request.headers.get('purpose') === 'prefetch') return true
  if (request.headers.get('next-router-prefetch')) return true
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?)$/i.test(pathname)
  )
}

function getRouteClass(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/api') || request.headers.has('next-action')) return 'action'
  const firstSegment = pathname.split('/').filter(Boolean)[0] || 'home'
  return firstSegment
}
