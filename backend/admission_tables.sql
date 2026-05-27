-- Admission Management Tables for Doctor Dashboard
-- Run this in Supabase SQL Editor

-- Add admission columns to route_tasks (already has patient data + vitals)
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS triage_level VARCHAR(10);
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS ward_name VARCHAR(100);
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS triage_notes TEXT;
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS admitted_at TIMESTAMPTZ;
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS discharge_status VARCHAR(20) DEFAULT 'active';

-- Doctor clinical notes for admitted patients
CREATE TABLE IF NOT EXISTS patient_doctor_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES route_tasks(id) ON DELETE CASCADE,
  doctor_name VARCHAR(255),
  note_type VARCHAR(50) DEFAULT 'clinical',
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_doctor_notes_task ON patient_doctor_notes(task_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_notes_created ON patient_doctor_notes(created_at);

-- Ward/bed transfer history
CREATE TABLE IF NOT EXISTS patient_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES route_tasks(id) ON DELETE CASCADE,
  from_ward VARCHAR(100),
  from_bed VARCHAR(50),
  to_ward VARCHAR(100) NOT NULL,
  to_bed VARCHAR(50),
  reason TEXT,
  transferred_by VARCHAR(255),
  transferred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_transfers_task ON patient_transfers(task_id);
CREATE INDEX IF NOT EXISTS idx_patient_transfers_date ON patient_transfers(transferred_at);

-- Disable RLS for development
ALTER TABLE patient_doctor_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE patient_transfers DISABLE ROW LEVEL SECURITY;
