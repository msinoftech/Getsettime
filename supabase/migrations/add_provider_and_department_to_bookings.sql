-- Add service_provider_id and department_id columns to bookings table
-- This allows filtering bookings by specific service providers and departments

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS service_provider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bookings_service_provider_id ON bookings(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_department_id ON bookings(department_id);

-- Add index for common query pattern (filtering by provider and date)
CREATE INDEX IF NOT EXISTS idx_bookings_provider_date ON bookings(service_provider_id, start_at);

-- Comment on columns
COMMENT ON COLUMN bookings.service_provider_id IS 'The service provider (doctor/staff) assigned to this booking';
COMMENT ON COLUMN bookings.department_id IS 'The department this booking belongs to';

