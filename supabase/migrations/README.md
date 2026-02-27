# Supabase Migrations

This folder contains SQL migration files for the database schema.

## Running Migrations

### Option 1: Using Supabase CLI (Recommended)

If you have the Supabase CLI installed:

```bash
# Link your project
supabase link --project-ref your-project-ref

# Run all pending migrations
supabase db push
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file you want to run (e.g., `create_invites_table.sql`)
4. Copy the entire SQL content
5. Paste it into the SQL Editor
6. Click **Run** to execute the migration

### Option 3: Using psql Command Line

If you have direct database access:

```bash
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/create_invites_table.sql
```

## Migrations in this folder

1. `create_departments_table.sql` - Creates the departments table
2. `create_services_table.sql` - Creates the services table
3. `create_otp_verifications_table.sql` - Creates the OTP verifications table
4. `add_verified_fields_to_otp.sql` - Adds verified fields to OTP table
5. `create_invites_table.sql` - **NEW** - Creates the invites table for team member invitations

## After Running the Invites Migration

The `invites` table will be created with the following structure:
- `id` - Primary key
- `token` - Unique invite token
- `email` - Email of the invited user
- `role` - Role assigned to the invited user
- `departments` - Array of department IDs (for service providers)
- `workspace_id` - ID of the workspace
- `invited_by` - UUID of the user who sent the invite
- `invited_at` - Timestamp when invite was created
- `expires_at` - Timestamp when invite expires
- `used` - Boolean flag indicating if invite was used
- `used_at` - Timestamp when invite was used
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp

RLS (Row Level Security) policies are automatically enabled to ensure workspace isolation.

