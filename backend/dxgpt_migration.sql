-- AI Diagnosis columns for doctor_prescriptions
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS ai_diagnosis TEXT;
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS ai_disease_predictions JSONB;
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS ai_suggested_tests JSONB;
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS ai_notes TEXT;
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;
ALTER TABLE doctor_prescriptions ADD COLUMN IF NOT EXISTS ai_suggested_diet JSONB;
