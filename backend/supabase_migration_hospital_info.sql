-- Hospital Info table for doctors, wards, floors, beds per case type
CREATE TABLE IF NOT EXISTS hospital_info (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_name TEXT NOT NULL,
  case_type TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  ward_no TEXT NOT NULL,
  floor_no TEXT NOT NULL,
  bed_no TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE hospital_info ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON hospital_info
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated write" ON hospital_info
  FOR ALL USING (auth.role() = 'authenticated');

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_hospital_info_hospital_case
  ON hospital_info(hospital_name, case_type);