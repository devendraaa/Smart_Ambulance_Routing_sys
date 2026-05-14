-- Healthcare Dashboard Tables

-- Patient prescriptions (doctor prescriptions)
CREATE TABLE IF NOT EXISTS patient_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_email VARCHAR(255) NOT NULL,
    appointment_id UUID REFERENCES patient_appointments(id) ON DELETE SET NULL,
    doctor_name VARCHAR(255),
    symptoms TEXT,
    diagnosis TEXT,
    medicines TEXT, -- JSON array: [{name, dosage, timing, duration}]
    treatment TEXT,
    notes TEXT,
    suggested_tests TEXT, -- JSON array of test names
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON patient_prescriptions(patient_email);

-- Test bookings
CREATE TABLE IF NOT EXISTS patient_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_email VARCHAR(255) NOT NULL,
    test_type VARCHAR(100) NOT NULL, -- MRI, CT Scan, Sonography, Blood Test, X-Ray, ECG
    appointment_id UUID REFERENCES patient_appointments(id) ON DELETE SET NULL,
    appointment_slot TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- pending, payment_pending, confirmed, completed, cancelled
    payment_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, paid
    payment_amount DECIMAL(10,2),
    payment_reference VARCHAR(255),
    report_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tests_patient ON patient_tests(patient_email);
CREATE INDEX IF NOT EXISTS idx_tests_type ON patient_tests(test_type);
CREATE INDEX IF NOT EXISTS idx_tests_status ON patient_tests(status);

-- AI symptom checker history
CREATE TABLE IF NOT EXISTS ai_symptom_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_email VARCHAR(255),
    session_data JSONB, -- Array of {role, content} messages
    symptoms TEXT,
    department_hint VARCHAR(255),
    recommended_tests TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_patient ON ai_symptom_sessions(patient_email);

-- Doctor list (for virtual doctor consultations)
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(255),
    qualification VARCHAR(255),
    experience_years INTEGER,
    department VARCHAR(100),
    consultation_fee DECIMAL(10,2),
    available_slots JSONB, -- Array of available time slots
    rating DECIMAL(2,1),
    total_reviews INTEGER DEFAULT 0,
    languages VARCHAR(255), -- Hindi, English, Marathi
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty);
CREATE INDEX IF NOT EXISTS idx_doctors_available ON doctors(is_available);

-- Video consultation bookings
CREATE TABLE IF NOT EXISTS video_consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_email VARCHAR(255) NOT NULL,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    appointment_date TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    meeting_link TEXT,
    notes TEXT,
    consultation_fee DECIMAL(10,2),
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_patient ON video_consultations(patient_email);
CREATE INDEX IF NOT EXISTS idx_video_doctor ON video_consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_video_status ON video_consultations(status);

-- Medicine tracking (prescribed medicines for patient)
CREATE TABLE IF NOT EXISTS patient_medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_email VARCHAR(255) NOT NULL,
    prescription_id UUID REFERENCES patient_prescriptions(id) ON DELETE SET NULL,
    medicine_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100), -- Once daily, Twice daily, etc.
    timing VARCHAR(100), -- Morning, Afternoon, Evening, Night
    duration VARCHAR(100), -- 7 days, 14 days, 30 days
    instructions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicines_patient ON patient_medicines(patient_email);
CREATE INDEX IF NOT EXISTS idx_medicines_active ON patient_medicines(is_active);

-- Insert some sample doctors
INSERT INTO doctors (name, specialty, qualification, experience_years, department, consultation_fee, languages, rating, total_reviews) VALUES
('Dr. Priya Sharma', 'General Physician', 'MBBS, MD', 12, 'General OPD', 500, 'Hindi, English, Marathi', 4.8, 156),
('Dr. Rajesh Patel', 'Cardiologist', 'MBBS, DM Cardiology', 18, 'Heart & Emergency', 800, 'Hindi, English', 4.9, 243),
('Dr. Anjali Desai', 'Pediatrician', 'MBBS, MD Pediatrics', 10, 'Child OPD', 600, 'Hindi, English, Marathi', 4.7, 189),
('Dr. Vikram Singh', 'Orthopedic', 'MBBS, MS Ortho', 15, 'Orthopedic', 700, 'Hindi, English', 4.6, 132),
('Dr. Sunita Joshi', 'Neurologist', 'MBBS, DM Neurology', 20, 'Neurology', 1000, 'Hindi, English', 4.9, 278),
('Dr. Amit Kumar', 'Diabetologist', 'MBBS, MD Medicine', 14, 'Diabetes & Kidney', 650, 'Hindi, English, Marathi', 4.5, 98),
('Dr. Meera Gupta', 'Gynecologist', 'MBBS, MS OBG', 16, 'Women & Pregnancy', 750, 'Hindi, English', 4.8, 215),
('Dr. Suresh Nair', 'Emergency Medicine', 'MBBS, MD Emergency', 8, 'Accident & Trauma', 550, 'Hindi, English, Malayalam', 4.4, 67),
('Dr. Kavita Reddy', 'ENT Specialist', 'MBBS, MS ENT', 11, 'ENT / Eye', 600, 'Hindi, English, Telugu', 4.7, 145),
('Dr. Ramesh Joshi', 'Psychiatrist', 'MBBS, MD Psychiatry', 17, 'Mental Health', 850, 'Hindi, English, Marathi', 4.8, 189)
ON CONFLICT DO NOTHING;

-- Patient diet plans
CREATE TABLE IF NOT EXISTS patient_diets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_email VARCHAR(255) NOT NULL,
    diet_name VARCHAR(255) NOT NULL,
    diet_type VARCHAR(100), -- Weight Loss, Weight Gain, Diabetic, Heart, etc.
    calories VARCHAR(50),
    timing VARCHAR(100), -- Morning, Lunch, Dinner, etc.
    foods TEXT, -- List of foods
    instructions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diets_patient ON patient_diets(patient_email);
CREATE INDEX IF NOT EXISTS idx_diets_active ON patient_diets(is_active);
