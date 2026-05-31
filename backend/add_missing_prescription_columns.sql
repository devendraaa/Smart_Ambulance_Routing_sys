-- Run this in Supabase SQL Editor to add missing columns to doctor_prescriptions
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS respiratory_rate INTEGER;
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS blood_sugar INTEGER;
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS weight DECIMAL(5,2);
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS height DECIMAL(5,2);
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS bmi DECIMAL(4,2);
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS pain_score INTEGER;
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS smoking_history VARCHAR(50);
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS alcohol_history VARCHAR(50);
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS past_medications TEXT;
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES patient_appointments(id) ON DELETE SET NULL;
