import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { is_public_embed_booking_path } from '@/lib/public_embed_route';

export default function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const role = request.cookies.get('x_role')?.value;
  const pathname = url.pathname;

  // Public routes that don't require authentication (embed booking under /[workspaceSlug]/…)
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
  const isEmbedRoute = is_public_embed_booking_path(pathname);
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || isEmbedRoute;

  // If accessing public routes, allow
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For API routes, allow (they handle their own authentication)
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const allowedRoles = ['workspace_admin', 'manager', 'service_provider', 'customer'];
  if (role) {
    if (role === 'superadmin') {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('x_role');
      response.cookies.delete('x_workspace_id');
      return response;
    }
    if (!allowedRoles.includes(role)) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('x_role');
      response.cookies.delete('x_workspace_id');
      return response;
    }

    if (role === 'customer' && !pathname.startsWith('/my-bookings')) {
      return NextResponse.redirect(new URL('/my-bookings', request.url));
    }
  }

  // For protected routes without a role cookie, let AuthProvider handle redirect
  // The AuthProvider will verify the session and redirect to /login if not authenticated
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/webpack-hmr (dev WebSocket HMR — must not hit proxy/middleware)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)',
  ],
};

