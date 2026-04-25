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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
