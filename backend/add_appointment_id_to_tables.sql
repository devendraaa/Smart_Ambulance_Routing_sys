-- Add appointment_id to patient_medicines to link to specific appointment
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES patient_appointments(id) ON DELETE SET NULL;

-- Add appointment_id to patient_tests
ALTER TABLE patient_tests ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES patient_appointments(id) ON DELETE SET NULL;

-- Add appointment_id to patient_diets
ALTER TABLE patient_diets ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES patient_appointments(id) ON DELETE SET NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_medicines_appointment ON patient_medicines(appointment_id);
CREATE INDEX IF NOT EXISTS idx_tests_appointment ON patient_tests(appointment_id);
CREATE INDEX IF NOT EXISTS idx_diets_appointment ON patient_diets(appointment_id);