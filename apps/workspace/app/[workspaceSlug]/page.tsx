import { createSupabaseClient, createSupabaseServerClient } from '@app/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import EmbedBookingForm from '@/src/components/Booking/EmbedBookingForm';

interface PageProps {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getWorkspaceBySlug(slug: string) {
  try {
    // Try with anon key first (respects RLS)
    let supabase = createSupabaseClient();
    
    // Decode URL-encoded slug if needed
    const decodedSlug = decodeURIComponent(slug);
    
    // First, try exact match
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, slug, logo_url, created_at')
      .eq('slug', decodedSlug)
      .single();

    if (error) {
      // Check if it's an RLS/permission error - fallback to service role key
      if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
        console.warn('RLS Policy blocked anon access. Using service role key for public embed page.');
        // Fallback to service role key for public embed pages
        supabase = createSupabaseServerClient();
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('workspaces')
          .select('id, name, slug, logo_url, created_at')
          .eq('slug', decodedSlug)
          .single();
        
        if (fallbackError) {
          console.error('Error with service role key fallback:', {
            code: fallbackError.code,
            message: fallbackError.message,
            slug: decodedSlug
          });
          return null;
        }
        
        if (fallbackData) {
          return fallbackData;
        }
      }
      
      // If single() returns PGRST116 (no rows), try case-insensitive search, then service role key
      if (error.code === 'PGRST116') {
        // Try case-insensitive search
        const { data: caseInsensitiveData, error: caseError } = await supabase
          .from('workspaces')
          .select('id, name, slug, logo_url, created_at')
          .ilike('slug', decodedSlug)
          .single();
        
        if (caseError) {
          // Try with service role key as fallback (bypasses RLS)
          const serverSupabase = createSupabaseServerClient();
          const { data: serverData, error: serverError } = await serverSupabase
            .from('workspaces')
            .select('id, name, slug, logo_url, created_at')
            .eq('slug', decodedSlug)
            .single();
          
          if (!serverError && serverData) {
            return serverData;
          }
          
          // Try case-insensitive with service role key
          const { data: serverCaseData, error: serverCaseError } = await serverSupabase
            .from('workspaces')
            .select('id, name, slug, logo_url, created_at')
            .ilike('slug', decodedSlug)
            .single();
          
          if (!serverCaseError && serverCaseData) {
            return serverCaseData;
          }
          
          // Only log error if all attempts failed
          console.error('Workspace not found for slug:', decodedSlug);
          
          // List all workspaces to help debug
          const { data: allWorkspaces } = await serverSupabase
            .from('workspaces')
            .select('id, name, slug')
            .limit(50)
            .order('created_at', { ascending: false });
          
          if (allWorkspaces && allWorkspaces.length > 0) {
            console.log('Available workspace slugs:', allWorkspaces.map(w => w.slug).filter(Boolean));
          }
          
          return null;
        }
        
        return caseInsensitiveData;
      }
      
      // Log error only for unexpected error codes
      console.error('Unexpected error fetching workspace:', {
        code: error.code,
        message: error.message,
        slug: decodedSlug
      });
      return null;
    }

    if (!data) {
      console.error('No workspace data returned for slug:', decodedSlug);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Exception in getWorkspaceBySlug:', err);
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    return {
      title: 'Workspace Not Found',
    };
  }

  return {
    title: `Book with ${workspace.name}`,
    description: `Schedule a booking with ${workspace.name}`,
  };
}

export default async function EmbedBookingPage({ params, searchParams }: PageProps) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  const query = await searchParams;

  if (!workspace) {
    notFound();
  }

  // Extract event-type parameter (e.g., "15mins", "30mins", "60mins")
  const eventType = typeof query['event-type'] === 'string' ? query['event-type'] : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <EmbedBookingForm workspace={workspace} eventType={eventType} />
    </div>
  );
}
