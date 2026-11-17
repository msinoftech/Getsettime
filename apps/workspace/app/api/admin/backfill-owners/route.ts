import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import { workspaceCreatorFlagsMissing } from '@/lib/workspace-owner-signup';

/**
 * POST /api/admin/backfill-owners
 *
 * One-time (idempotent) backfill: for every workspace, resolve the creator
 * (`workspaces.user_id`) and set `is_workspace_owner: true` in their
 * user_metadata.  Only callable with the service-role secret passed as
 * `x-service-key` header.
 */
export async function POST(req: NextRequest) {
  const serviceKey = req.headers.get('x-service-key');
  const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey || !expectedKey || serviceKey !== expectedKey) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || !expectedKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, expectedKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: workspaces, error: wsError } = await admin
    .from('workspaces')
    .select('id, user_id');

  if (wsError || !workspaces) {
    return NextResponse.json({ error: wsError?.message || 'Failed to load workspaces' }, { status: 500 });
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const ws of workspaces) {
    if (!ws.user_id) {
      skipped++;
      continue;
    }

    try {
      const { data: userData } = await admin.auth.admin.getUserById(ws.user_id);
      const meta = userData?.user?.user_metadata ?? {};

      if (!workspaceCreatorFlagsMissing(meta)) {
        skipped++;
        continue;
      }

      const existingAdditional = Array.isArray(meta.additional_roles)
        ? meta.additional_roles.filter((r): r is string => typeof r === 'string')
        : [];
      const additional_roles = existingAdditional.includes(ROLE_SERVICE_PROVIDER)
        ? existingAdditional
        : [...existingAdditional, ROLE_SERVICE_PROVIDER];

      const { error: updateErr } = await admin.auth.admin.updateUserById(ws.user_id, {
        user_metadata: {
          ...meta,
          role:
            typeof meta.role === 'string' && meta.role.trim() !== ''
              ? meta.role
              : 'workspace_admin',
          is_workspace_owner: true,
          additional_roles,
        },
      });

      if (updateErr) {
        errors.push(`workspace ${ws.id}: ${updateErr.message}`);
      } else {
        updated++;
      }
    } catch (err) {
      errors.push(`workspace ${ws.id}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return NextResponse.json({
    total_workspaces: workspaces.length,
    updated,
    skipped,
    errors,
  });
}
