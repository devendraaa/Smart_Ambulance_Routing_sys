-- Migration: Enhanced patient_medicines with new fields
-- These columns already exist in some installs, so we use IF NOT EXISTS
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255);
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS hospital_name VARCHAR(255);
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS route VARCHAR(50) DEFAULT 'Oral';
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS is_prn BOOLEAN DEFAULT FALSE;
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS quantity VARCHAR(50);
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS refills VARCHAR(50) DEFAULT '0';
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS medicine_collected BOOLEAN DEFAULT FALSE;
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_medicines_appointment ON patient_medicines(appointment_id);
