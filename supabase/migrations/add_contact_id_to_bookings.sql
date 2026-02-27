-- Add contact_id to bookings table for contact linking
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS contact_id bigint NULL REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Index for contact lookups
CREATE INDEX IF NOT EXISTS idx_bookings_contact_id ON public.bookings(contact_id);

COMMENT ON COLUMN public.bookings.contact_id IS 'Links booking to a contact for repeated bookings and contact management';
