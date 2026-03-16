import { getSupabaseServer } from '@/lib/supabaseServer';
import BookingList from '@/src/components/Booking/BookingList';
import type { Workspace } from '@app/db';

async function getWorkspaces(): Promise<Workspace[]> {
  const supabaseServer = getSupabaseServer();
  
  const { data, error } = await supabaseServer
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching workspaces:', error);
    return [];
  }

  return (data as Workspace[]) || [];
}

const bookings = async () => {
  const workspacesData = await getWorkspaces();

  return (
    <div className="space-y-6">
      <BookingList workspaces={workspacesData} />
    </div>
  );
};

export default bookings;