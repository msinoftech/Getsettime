import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@app/db";
import { env } from "@app/config";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = (formData.get("userId") as string | null) || "user";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const validImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!validImageTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed." },
        { status: 400 }
      );
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || env.supabaseStorageBucket;
    if (!bucketName) {
      return NextResponse.json(
        { error: "Storage bucket name not configured. Please set SUPABASE_STORAGE_BUCKET." },
        { status: 500 }
      );
    }

    const supabaseServer = createSupabaseServerClient();
    const fileExt = file.name.split(".").pop() || "jpg";
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
    const filePath = `profiles/${safeUserId}-${Date.now()}.${fileExt}`;

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
        { error: uploadError.message || "Failed to upload profile image" },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabaseServer.storage.from(bucketName).getPublicUrl(filePath);
    if (!publicUrlData?.publicUrl) {
      return NextResponse.json(
        { error: "Failed to get public URL for uploaded profile image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: publicUrlData.publicUrl, path: filePath }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "An unexpected error occurred during upload" },
      { status: 500 }
    );
  }
}
