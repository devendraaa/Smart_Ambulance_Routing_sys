-- Healthcare Prescription & Test Management Tables
-- Run this in Supabase SQL Editor

-- Add more columns to hospitals table for enhanced hospital data
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_type VARCHAR(50); -- Government, Private, Trust
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS bed_capacity INTEGER;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(20);

-- Doctor prescriptions (prescribed by doctors to patients)
CREATE TABLE IF NOT EXISTS doctor_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_email VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255),
    patient_phone VARCHAR(20),
    doctor_id UUID,
    doctor_name VARCHAR(255) NOT NULL,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    hospital_name VARCHAR(255),
    symptoms TEXT,
    diagnosis TEXT,
    prescription_notes TEXT,
    medicines JSONB, -- [{name, dosage, frequency, duration, instructions}]
    follow_up_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_prescriptions_patient ON doctor_prescriptions(patient_email);
CREATE INDEX IF NOT EXISTS idx_doc_prescriptions_doctor ON doctor_prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doc_prescriptions_hospital ON doctor_prescriptions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_doc_prescriptions_date ON doctor_prescriptions(created_at);

-- Doctor assigned tests (MRI, CT Scan, Sonography, etc.)
CREATE TABLE IF NOT EXISTS doctor_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_email VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255),
    patient_phone VARCHAR(20),
    doctor_id UUID,
    doctor_name VARCHAR(255) NOT NULL,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    hospital_name VARCHAR(255),
    test_type VARCHAR(100) NOT NULL, -- MRI, CT Scan, Sonography, X-Ray, ECG, Blood Test, etc.
    test_reason TEXT,
    urgency VARCHAR(20) DEFAULT 'normal', -- urgent, normal, routine
    status VARCHAR(50) DEFAULT 'assigned', -- assigned, scheduled, in_progress, completed, cancelled
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_tests_patient ON doctor_tests(patient_email);
CREATE INDEX IF NOT EXISTS idx_doc_tests_doctor ON doctor_tests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doc_tests_hospital ON doctor_tests(hospital_id);
CREATE INDEX IF NOT EXISTS idx_doc_tests_status ON doctor_tests(status);
CREATE INDEX IF NOT EXISTS idx_doc_tests_type ON doctor_tests(test_type);

-- Test appointments (scheduled by test operator)
CREATE TABLE IF NOT EXISTS test_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES doctor_tests(id) ON DELETE CASCADE,
    patient_email VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255),
    test_type VARCHAR(100),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    hospital_name VARCHAR(255),
    appointment_date DATE NOT NULL,
    appointment_time VARCHAR(20) NOT NULL, -- 09:00 AM, 10:30 AM, etc.
    technician_name VARCHAR(255),
    room_number VARCHAR(50),
    preparation_notes TEXT,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_appointments_test ON test_appointments(test_id);
CREATE INDEX IF NOT EXISTS idx_test_appointments_patient ON test_appointments(patient_email);
CREATE INDEX IF NOT EXISTS idx_test_appointments_hospital ON test_appointments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_test_appointments_date ON test_appointments(appointment_date);

-- Sample hospitals data
INSERT INTO hospitals (name, address, city, state, contact_phone, hospital_type, bed_capacity) VALUES
('KEM Hospital', 'Acharya Donde Marg, Parel, Mumbai', 'Mumbai', 'Maharashtra', '022-24107000', 'Government', 1800),
(' Sion Hospital', 'Dr. Babasaheb Ambedkar Road, Sion West, Mumbai', 'Mumbai', 'Maharashtra', '022-24076121', 'Government', 1400),
('Nair Hospital', 'Dr. A. L. Nair Road, Mumbai Central, Mumbai', 'Mumbai', 'Maharashtra', '022-23084291', 'Government', 1200),
('Cooper Hospital', 'Juhu Versova Road, Mumbai', 'Mumbai', 'Maharashtra', '022-26206546', 'Government', 600),
('Hinduhridaysamrat Balasaheb Thackeray Trauma Care Hospital', 'Jupiter Hospital Campus, Kurla West, Mumbai', 'Mumbai', 'Maharashtra', '022-67738888', 'Government', 500),
('Breach Candy Hospital', 'Nehru Road, Breach Candy, Mumbai', 'Mumbai', 'Maharashtra', '022-23667800', 'Trust', 700),
('Saibaba Nursing Home', 'Sion West, Mumbai', 'Mumbai', 'Maharashtra', '022-24094000', 'Private', 200)
ON CONFLICT DO NOTHING;

-- Sample patients (for testing)
-- These would normally come from patient registrations