export interface Contact {
  id: number;
  workspace_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  last_seen: string | null;
  created_at: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

export type FormContact = Omit<Contact, 'id'> & { id: string };
