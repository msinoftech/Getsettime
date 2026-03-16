import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { env } from '@app/config';

// POST - Upload logo image to Supabase storage
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspaceId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' 
      }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File size too large. Maximum size is 5MB.' 
      }, { status: 400 });
    }

    const supabaseServer = getSupabaseServer();

    // Get storage bucket name from environment variable
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || env.supabaseStorageBucket;
    
    if (!bucketName) {
      return NextResponse.json({ 
        error: 'Storage bucket name not configured. Please set SUPABASE_STORAGE_BUCKET environment variable.' 
      }, { status: 500 });
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = workspaceId 
      ? `workspace-${workspaceId}-${Date.now()}.${fileExt}`
      : `workspace-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabaseServer.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true, // Replace if file exists
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      
      // If bucket doesn't exist, provide helpful error message
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        return NextResponse.json({ 
          error: `Storage bucket "${bucketName}" not found. Please create it in Supabase dashboard.` 
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: uploadError.message || 'Failed to upload image' 
      }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseServer.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      console.error('Failed to get public URL for uploaded file:', filePath);
      return NextResponse.json({ 
        error: 'Failed to get public URL for uploaded image' 
      }, { status: 500 });
    }

    console.log('Logo uploaded successfully. Public URL:', urlData.publicUrl);
    return NextResponse.json({ 
      url: urlData.publicUrl,
      path: filePath
    }, { status: 200 });
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred during upload' 
    }, { status: 500 });
  }
}

// DELETE - Delete logo image from Supabase storage
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    const supabaseServer = getSupabaseServer();

    // Get storage bucket name from environment variable
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || env.supabaseStorageBucket;
    
    if (!bucketName) {
      return NextResponse.json({ 
        error: 'Storage bucket name not configured. Please set SUPABASE_STORAGE_BUCKET environment variable.' 
      }, { status: 500 });
    }

    const { error } = await supabaseServer.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error('Storage delete error:', error);
      return NextResponse.json({ 
        error: error.message || 'Failed to delete image' 
      }, { status: 500 });
    }

    return NextResponse.json({ message: 'Image deleted successfully' }, { status: 200 });
  } catch (err: any) {
    console.error('Delete error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

