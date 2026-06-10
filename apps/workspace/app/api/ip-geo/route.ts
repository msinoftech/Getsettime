import { NextRequest, NextResponse } from 'next/server';
import { resolveGeoFromRequest } from '@/lib/ipapi-geo';

export const dynamic = 'force-dynamic';

/** GET /api/ip-geo — edge country + ip-api.com for visitor timezone (not ipapi.co). */
export async function GET(req: NextRequest) {
  const geo = await resolveGeoFromRequest(req.headers);
  return NextResponse.json({
    country: geo.country,
    timezone: geo.timezone,
    currency: geo.currency,
    phoneCode: geo.phoneCode,
    source: geo.source,
  });
}
