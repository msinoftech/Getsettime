import { NextRequest, NextResponse } from 'next/server';
import { resolveGeoFromRequest } from '@/lib/ipapi-geo';

export const dynamic = 'force-dynamic';

/** GET /api/ip-country — backward-compatible alias; returns country only. */
export async function GET(req: NextRequest) {
  const geo = await resolveGeoFromRequest(req.headers);
  return NextResponse.json({ country: geo.country });
}
