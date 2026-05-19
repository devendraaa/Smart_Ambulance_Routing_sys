-- Add hospital_name column to patient_medicines for hospital-wise grouping
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS hospital_name VARCHAR(255);

-- Create index for faster hospital-based queries
CREATE INDEX IF NOT EXISTS idx_medicines_hospital ON patient_medicines(hospital_name);