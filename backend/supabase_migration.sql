-- Run this in Supabase: SQL Editor → New Query → paste and run

-- Hospitals
CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sensors
CREATE TABLE IF NOT EXISTS sensors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    degree DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add degree column if table already exists
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS degree DOUBLE PRECISION;

-- Route computation tasks
CREATE TABLE IF NOT EXISTS route_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_lat DOUBLE PRECISION NOT NULL,
    origin_lon DOUBLE PRECISION NOT NULL,
    hospital_name VARCHAR(255) NOT NULL,
    destination_lat DOUBLE PRECISION,
    destination_lon DOUBLE PRECISION,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    progress DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    total_nodes INTEGER DEFAULT 0,
    processed_nodes INTEGER DEFAULT 0,
    error_message TEXT,
    result_json JSONB,
    map_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add patient details columns to route_tasks
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS patient_name VARCHAR(100);
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS patient_age VARCHAR(10);
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS patient_sex VARCHAR(20);
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS patient_mobile VARCHAR(20);
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS patient_case VARCHAR(50);
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS patient_blood_group VARCHAR(10);
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS patient_date DATE;
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS ambulance_number VARCHAR(50);
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS driver_name VARCHAR(100);
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS driver_mobile VARCHAR(20);
-- Physiological vitals columns
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS patient_bp_systolic INTEGER;
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS patient_bp_diastolic INTEGER;
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS patient_temperature DOUBLE PRECISION;
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS patient_pulse INTEGER;
ALTER TABLE route_tasks ADD COLUMN IF NOT EXISTS patient_spo2 INTEGER;

-- Route task coordinates
CREATE TABLE IF NOT EXISTS route_task_coordinates (
    id BIGSERIAL PRIMARY KEY,
    task_id UUID REFERENCES route_tasks(id) ON DELETE CASCADE NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    sequence_order INTEGER NOT NULL,
    proximity_filtered INTEGER DEFAULT 0
);

-- Create an index on task_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_route_task_coordinates_task_id
    ON route_task_coordinates(task_id);

-- Route turning points (extracted from computed routes)
CREATE TABLE IF NOT EXISTS route_turn_points (
    id BIGSERIAL PRIMARY KEY,
    task_id UUID REFERENCES route_tasks(id) ON DELETE CASCADE NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    sequence_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_route_turn_points_task_id
    ON route_turn_points(task_id);

-- Sensor locations (road intersections across Mumbai)
CREATE TABLE IF NOT EXISTS sensor_locations (
    sensor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    road_name VARCHAR(255),
    intersection_type VARCHAR(50),
    source VARCHAR(50) DEFAULT 'osm',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast spatial queries (without PostGIS)
CREATE INDEX IF NOT EXISTS idx_sensor_locations_lat ON sensor_locations(latitude);
CREATE INDEX IF NOT EXISTS idx_sensor_locations_lon ON sensor_locations(longitude);
CREATE INDEX IF NOT EXISTS idx_sensor_locations_sensor_id ON sensor_locations(sensor_id);

-- Traffic signals (pre-loaded from Overpass)
CREATE TABLE IF NOT EXISTS traffic_signals (
    signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    road_name VARCHAR(255),
    junction_type VARCHAR(50),
    source VARCHAR(50) DEFAULT 'osm_overpass',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traffic_signals_lat ON traffic_signals(latitude);
CREATE INDEX IF NOT EXISTS idx_traffic_signals_lon ON traffic_signals(longitude);

-- Route traffic signals (matched per route task)
CREATE TABLE IF NOT EXISTS route_traffic_signals (
    id BIGSERIAL PRIMARY KEY,
    task_id UUID REFERENCES route_tasks(id) ON DELETE CASCADE NOT NULL,
    signal_id UUID REFERENCES traffic_signals(signal_id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    distance_km DOUBLE PRECISION,
    sequence_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_traffic_signals_task_id
    ON route_traffic_signals(task_id);

-- Patient appointments and data
CREATE TABLE IF NOT EXISTS patient_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_name VARCHAR(255) NOT NULL,
    age INTEGER,
    address TEXT,
    religion VARCHAR(100),
    appointment_date TIMESTAMPTZ, -- Changed to TIMESTAMPTZ to include time slot
    case_type VARCHAR(100), -- General OPD, Child OPD, Heart & Emergency, etc.
    hospital_id INTEGER,
    hospital_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled
    patient_email VARCHAR(255), -- Email of the patient (linked to Supabase auth user)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_patient_appointments_date ON patient_appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_patient_appointments_status ON patient_appointments(status);
CREATE INDEX IF NOT EXISTS idx_patient_appointments_email ON patient_appointments(patient_email);

-- Add patient_phone column for appointment booking
ALTER TABLE patient_appointments ADD COLUMN IF NOT EXISTS patient_phone VARCHAR(20);

-- Patient Medicines (add patient_name column)
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255);

-- Patient Tests (add patient_name column)
ALTER TABLE patient_tests ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255);

-- Test appointment scheduling
ALTER TABLE patient_tests ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMPTZ;
ALTER TABLE patient_tests ADD COLUMN IF NOT EXISTS timing VARCHAR(50);
ALTER TABLE patient_tests ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);
ALTER TABLE patient_tests ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';

-- Patient Diets (add patient_name column)
ALTER TABLE patient_diets ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255);

-- Medicine collection tracking
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS medicine_collected BOOLEAN DEFAULT FALSE;
ALTER TABLE patient_medicines ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
