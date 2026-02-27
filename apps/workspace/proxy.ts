import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const role = request.cookies.get('x_role')?.value;
  const pathname = url.pathname;

  // Public routes that don't require authentication (embed booking: /[workspaceSlug] or /[workspaceSlug]/[eventTypeSlug])
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
  const segments = pathname.split('/').filter(Boolean);
  const isEmbedRoute = (segments.length === 1 || segments.length === 2) && !['login', 'register', 'forgot-password', 'reset-password', 'auth', 'invite-accept', 'event-type', 'routingform', 'workflows', 'availability', 'team-members', 'departments', 'services', 'profile', 'integrations', 'contacts', 'billings', 'bookings', 'settings', 'api', '_next'].includes(segments[0]);
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || isEmbedRoute;

  // If accessing public routes, allow
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For API routes, allow (they handle their own authentication)
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Enforce role-based access: only workspace_admin and customer can access
  // Block superadmin users
  const allowedRoles = ['workspace_admin', 'customer'];
  if (role) {
    if (role === 'superadmin') {
      // Clear superadmin cookie and redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('x_role');
      response.cookies.delete('x_workspace_id');
      return response;
    }
    if (!allowedRoles.includes(role)) {
      // Clear invalid role cookie and redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('x_role');
      response.cookies.delete('x_workspace_id');
      return response;
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
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

