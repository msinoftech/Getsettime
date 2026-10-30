import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { env } from '@app/config';
import { createClient } from '@supabase/supabase-js';
import {
  MANAGE_ROLES,
  ROLE_SERVICE_PROVIDER,
  ROLE_STAFF,
} from '@/src/constants/roles';

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || null;

  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: { user }, error } = await verifyClient.auth.getUser(token);
  if (error || !user) {
    return null;
  }

  return user;
}

function assertCanManageWorkspaceSettings(userRole: string | undefined) {
  if (userRole === ROLE_STAFF) {
    return 'Staff cannot modify workspace settings';
  }
  if (userRole === ROLE_SERVICE_PROVIDER) {
    return 'Service providers cannot modify workspace settings';
  }
  if (!MANAGE_ROLES.includes(userRole ?? '')) {
    return 'You do not have permission to modify workspace settings';
  }
  return null;
}

async function setClinicImageUrl(
  workspaceId: string,
  clinicImageUrl: string | null
): Promise<{ error?: string }> {
  const supabaseServer = createSupabaseServerClient();

  const { data: existingConfig, error: fetchError } = await supabaseServer
    .from('configurations')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return { error: fetchError.message || 'Failed to load workspace settings' };
  }

  const existingSettings =
    typeof existingConfig?.settings === 'object' && existingConfig.settings !== null
      ? (existingConfig.settings as Record<string, unknown>)
      : {};
  const existingGeneral =
    typeof existingSettings.general === 'object' && existingSettings.general !== null
      ? (existingSettings.general as Record<string, unknown>)
      : {};

  const mergedSettings = {
    ...existingSettings,
    general: {
      ...existingGeneral,
      clinic_image_url: clinicImageUrl,
    },
  };

  if (existingConfig) {
    const { error: updateError } = await supabaseServer
      .from('configurations')
      .update({ settings: mergedSettings })
      .eq('workspace_id', workspaceId);

    if (updateError) {
      return { error: updateError.message || 'Failed to save clinic image' };
    }
    return {};
  }

  const { error: insertError } = await supabaseServer.from('configurations').insert({
    workspace_id: workspaceId,
    settings: mergedSettings,
  });

  if (insertError) {
    return { error: insertError.message || 'Failed to save clinic image' };
  }
  return {};
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id as string | null;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const userRole = user.user_metadata?.role as string | undefined;
    const permissionError = assertCanManageWorkspaceSettings(userRole);
    if (permissionError) {
      return NextResponse.json({ error: permissionError }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
      }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({
        error: 'File size too large. Maximum size is 5MB.',
      }, { status: 400 });
    }

    const supabaseServer = createSupabaseServerClient();
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || env.supabaseStorageBucket;

    if (!bucketName) {
      return NextResponse.json({
        error: 'Storage bucket name not configured. Please set SUPABASE_STORAGE_BUCKET environment variable.',
      }, { status: 500 });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `clinic-${workspaceId}-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseServer.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        return NextResponse.json({
          error: `Storage bucket "${bucketName}" not found. Please create it in Supabase dashboard.`,
        }, { status: 500 });
      }

      return NextResponse.json({
        error: uploadError.message || 'Failed to upload image',
      }, { status: 500 });
    }

    const { data: urlData } = supabaseServer.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return NextResponse.json({
        error: 'Failed to get public URL for uploaded image',
      }, { status: 500 });
    }

    const saveResult = await setClinicImageUrl(workspaceId, urlData.publicUrl);
    if (saveResult.error) {
      return NextResponse.json({ error: saveResult.error }, { status: 500 });
    }

    return NextResponse.json({
      url: urlData.publicUrl,
      path: filePath,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({
      error: error?.message || 'An unexpected error occurred during upload',
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id as string | null;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const userRole = user.user_metadata?.role as string | undefined;
    const permissionError = assertCanManageWorkspaceSettings(userRole);
    if (permissionError) {
      return NextResponse.json({ error: permissionError }, { status: 403 });
    }

    const saveResult = await setClinicImageUrl(workspaceId, null);
    if (saveResult.error) {
      return NextResponse.json({ error: saveResult.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({
      error: error?.message || 'An unexpected error occurred while removing the clinic image',
    }, { status: 500 });
  }
}
