-- FK to auth.users(id) forces PostgreSQL to SELECT auth.users for every inserted user_id.
-- The `authenticated` role cannot read other members' auth.users rows, so assigning
-- doctors to departments/services fails with: permission denied for table users.
-- Integrity is enforced in API/admin code; keep uuid columns without FK to auth.users.
--
-- For databases that already ran create_user_* with REFERENCES auth.users(id): this
-- migration only drops that FK; table data and other constraints stay as-is.

DO $$
DECLARE
  con_name text;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.user_departments'::regclass
      AND c.contype = 'f'
      AND a.attname = 'user_id'
      AND pg_get_constraintdef(c.oid) LIKE '%REFERENCES auth.users%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_departments DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;

DO $$
DECLARE
  con_name text;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.user_services'::regclass
      AND c.contype = 'f'
      AND a.attname = 'user_id'
      AND pg_get_constraintdef(c.oid) LIKE '%REFERENCES auth.users%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_services DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;
