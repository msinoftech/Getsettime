-- Link services to an optional workspace department
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS department_id bigint NULL REFERENCES public.departments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_services_department_id ON public.services (department_id);

COMMENT ON COLUMN public.services.department_id IS 'Optional department this service belongs to (same workspace).';
