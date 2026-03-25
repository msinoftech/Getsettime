import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { env } from '@app/config';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/heic',
  'image/heif',
];

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const workspaceId = formData.get('workspace_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, PNG, JPG, and HEIC/HEIF images are allowed.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 2MB.' },
        { status: 400 },
      );
    }

    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || env.supabaseStorageBucket;
    if (!bucketName) {
      return NextResponse.json(
        { error: 'Storage bucket name not configured.' },
        { status: 500 },
      );
    }

    const supabaseServer = createSupabaseServerClient();

    const safeWorkspaceId = String(workspaceId).replace(/[^a-zA-Z0-9_-]/g, '');
    const fileExt = file.name.split('.').pop() || 'bin';
    const filePath = `booking-files/${safeWorkspaceId}-${Date.now()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseServer.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload file' },
        { status: 500 },
      );
    }

    const { data: publicUrlData } = supabaseServer.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      return NextResponse.json(
        { error: 'Failed to get public URL for uploaded file' },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: publicUrlData.publicUrl, path: filePath });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred during upload' },
      { status: 500 },
    );
  }
}
