-- Patient Family Members table
-- Each email login can add up to 5 family members
-- Address and religion are shared across all members from the primary member

-- Add UHID column to existing table (safe to run even if column already exists)
ALTER TABLE patient_family_members ADD COLUMN IF NOT EXISTS patient_uhid VARCHAR(50) UNIQUE;

-- Create table if not exists (for fresh setups)
CREATE TABLE IF NOT EXISTS patient_family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_email VARCHAR(255) NOT NULL,
    patient_uhid VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    age INTEGER,
    blood_group VARCHAR(10),
    phone VARCHAR(20),
    address TEXT,
    religion VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill UHID for existing rows that have null patient_uhid
UPDATE patient_family_members
SET patient_uhid = 'UHID-LEGACY-' || SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 8)
WHERE patient_uhid IS NULL;

CREATE INDEX IF NOT EXISTS idx_family_members_email ON patient_family_members(patient_email);
CREATE INDEX IF NOT EXISTS idx_family_members_uhid ON patient_family_members(patient_uhid);

-- Auto-generate UHID in format: UHID-YYYY-XXXXX (sequential per year)
CREATE OR REPLACE FUNCTION generate_patient_uhid()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    next_seq INTEGER;
BEGIN
    year_prefix := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(CAST(SPLIT_PART(patient_uhid, '-', 3) AS INTEGER)), 0) + 1
    INTO next_seq
    FROM patient_family_members
    WHERE patient_uhid LIKE 'UHID-' || year_prefix || '-%';
    
    NEW.patient_uhid := 'UHID-' || year_prefix || '-' || LPAD(next_seq::TEXT, 5, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_patient_uhid ON patient_family_members;
CREATE TRIGGER trg_generate_patient_uhid
    BEFORE INSERT ON patient_family_members
    FOR EACH ROW
    WHEN (NEW.patient_uhid IS NULL)
    EXECUTE FUNCTION generate_patient_uhid();
