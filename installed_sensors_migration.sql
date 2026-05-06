-- Run this in Supabase SQL Editor
-- Create installed_sensors table with location_name column

CREATE TABLE IF NOT EXISTS public.installed_sensors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location_name text,
  degree double precision,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.installed_sensors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access" ON public.installed_sensors;

CREATE POLICY "Allow public access"
  ON public.installed_sensors
  FOR ALL
  USING (true)
  WITH CHECK (true);
