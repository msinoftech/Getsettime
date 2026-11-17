import type { SupabaseClient } from '@supabase/supabase-js';

export type public_profession_list_item = {
  name: string;
};

/** Enabled rows from `professions_list` for marketing / public pickers. */
export async function listPublicProfessionsList(
  supabase: SupabaseClient
): Promise<public_profession_list_item[]> {
  const { data, error } = await supabase
    .from('professions_list')
    .select('name')
    .eq('enabled', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    name: String(row.name),
  }));
}