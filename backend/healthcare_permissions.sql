-- Healthcare Tables Permissions Migration
-- Run this in Supabase: SQL Editor → New Query → paste and run

-- Disable RLS on healthcare tables (for development)
-- You can enable it later with proper policies

-- Patient Appointments
ALTER TABLE patient_appointments DISABLE ROW LEVEL SECURITY;

-- Patient Medicines
ALTER TABLE patient_medicines DISABLE ROW LEVEL SECURITY;

-- Patient Tests
ALTER TABLE patient_tests DISABLE ROW LEVEL SECURITY;

-- Patient Diets
ALTER TABLE patient_diets DISABLE ROW LEVEL SECURITY;

-- Patient Prescriptions
ALTER TABLE patient_prescriptions DISABLE ROW LEVEL SECURITY;

-- AI Symptom Sessions
ALTER TABLE ai_symptom_sessions DISABLE ROW LEVEL SECURITY;

-- Doctors
ALTER TABLE doctors DISABLE ROW LEVEL SECURITY;

-- Video Consultations
ALTER TABLE video_consultations DISABLE ROW LEVEL SECURITY;

-- Enable back with proper policies if needed:
/*
-- Enable RLS and create policies:
ALTER TABLE patient_medicines ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to insert
CREATE POLICY "Allow insert for authenticated users" ON patient_medicines
    FOR INSERT TO authenticated USING (true);

-- Policy to allow authenticated users to select
CREATE POLICY "Allow select for authenticated users" ON patient_medicines
    FOR SELECT TO authenticated USING (true);

-- Policy to allow authenticated users to update
CREATE POLICY "Allow update for authenticated users" ON patient_medicines
    FOR UPDATE TO authenticated USING (true);

-- Policy to allow authenticated users to delete
CREATE POLICY "Allow delete for authenticated users" ON patient_medicines
    FOR DELETE TO authenticated USING (true);
*/