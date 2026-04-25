# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Smart Ambulance Route** — a FastAPI + Next.js application that computes optimal ambulance routes using OpenStreetMap data, road intersection sensors, and OSRM/ORS routing. Routes are visualized on Leaflet maps with hospital locations and sensor deployment points. Has an older Django codebase also in the repo.

Deployed on Render at `smart-ambulance.onrender.com` (Django version).

## Key Commands

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev
```

### Django (legacy)
```bash
cd (repo root)
python manage.py runserver
python manage.py migrate
```

## Architecture

### Backend Structure (`backend/`)
- `app/main.py` — FastAPI app with lifespan manager that spawns background worker thread
- `app/database.py` — Supabase client connection
- `app/routers/` — API route modules
  - `routes.py` — Route computation endpoints (`POST /api/route/compute`, `GET /api/route/{task_id}`, `GET /api/route/{task_id}/coordinates`, `GET /api/route/{task_id}/turns`)
  - `hospitals.py` — Hospital endpoints with Nominatim search (`GET /api/hospitals/`, `GET /api/hospitals/search?q=`, `GET /api/hospitals/nearby`)
  - `sensors.py` — Sensor management, road intersection loading, nearest sensor finder
  - `mqtt.py` — MQTT publish endpoints for IoT/Arduino consumers
- `app/services/` — Business logic
  - `route_computation.py` — Core route computation with distance/duration extraction and road sensor matching
  - `osm_client.py` — Routing API client (ORS primary → OSRM polyline6 fallback)
  - `turn_extractor.py` — Extracts turning points from route coordinates via heading angle changes
  - `geocoding.py` — Location geocoding via Nominatim
  - `sensor_processor.py` — Legacy sensor proximity matching
- `app/tasks/worker.py` — Background worker thread for async route computation
- `app/schemas/` — Pydantic schemas for request/response validation
- `supabase_migration.sql` — Database schema (run in Supabase SQL Editor)

### Frontend Structure (`frontend/`)
- `src/app/` — Next.js App Router pages:
  - `/` — Home page
  - `/route` — Route planner form (origin lat/lon, hospital search, compute button). Saves origin coords to localStorage (`lastOriginLat`, `lastOriginLon`)
  - `/map` — Leaflet route map (blue polyline, turn points, start/end markers)
  - `/sensor` — Road intersection sensor management (load road sensors, turning points list)
  - `/sensor-map` — Map of road intersection sensors (CircleMarker for performance, green markers with road name)
  - `/hospitals` — Government hospital list (name, beds, doctors vacant, specialist, address, contact, distance + ETA from stored origin, search filter)
  - `/patient` — Patient details form (name, age, address, contact, reason dropdown: Heart Attack/Road Accident/Other, blood type dropdown, saves to localStorage)
  - `/blood-bank` — Blood bank availability (aggregate by blood type, per-bank grid with liter amounts, distance + ETA)
- `src/components/` — Shared components:
  - `RoutePlanner.tsx` — Origin/hospital form with Nominatim autocomplete and geolocation
  - `TaskProgress.tsx` — Polls task progress, shows distance_km and duration_min on completion
- `src/hooks/` — Custom hooks:
  - `useRouteTask.ts` — Polls task status every 1s
- `src/lib/api.ts` — API client functions for all backend endpoints

### Database Tables (Supabase)
- `hospitals` — Hospital locations (id, name, lat, lon)
- `sensors` — Manually added sensor coordinates (id, lat, lon)
- `sensor_locations` — Road intersection sensors from Overpass (sensor_id UUID, lat, lon, road_name, intersection_type, source)
- `route_tasks` — Route computation tasks (id, origin/dest coords, status, progress, result_json with distance_km/duration_min/road_sensors)
- `route_task_coordinates` — Raw route coordinates (task_id FK, lat, lon, sequence_order)
- `route_turn_points` — Extracted turning points (task_id FK, lat, lon, sequence_order)

### External Services
- **ORS API** (`api.openrouteservice.org`) — Primary routing with distance/duration
- **OSRM** (`router.project-osrm.org`) — Fallback routing with polyline6 geometry
- **OpenStreetMap Nominatim** — Geocoding hospital names to coordinates (Mumbai-scoped)
- **Overpass API** (`overpass-api.de`) — Fetch road intersections and hospital data from OSM
- **MQTT** (`broker.hivemq.com`) — Publish sensor/route coordinates to topics for Arduino consumers

### Key Implementation Details
- Route computation runs in background thread (`BackgroundWorkerThread` started in `main.py` lifespan)
- Routing: ORS primary → OSRM polyline6 fallback (handles 403 gracefully)
- Road intersection sensors: fetched from Overpass via grid tiling (0.15° tiles) with retry logic
- Route computation matches each coordinate to nearest road sensor within 1km (Haversine)
- Result JSON includes `distance_km`, `duration_min`, `road_sensors_count`, `road_sensors`
- Hospital search uses Nominatim with "hospital {name}, Mumbai, Maharashtra, India" query
- Leaflet maps use `CircleMarker` for high-performance rendering (1000+ points)
- Progress updates include `processed_nodes` and `total_nodes` for UI progress bar
- Sensor page has three loader buttons: Overpass (hospitals), CSV, and Road Intersection Sensors

### Important Development Note
- Always run uvicorn from inside `backend/` directory: `cd backend && uvicorn app.main:app --reload`
- The `sensor_locations` table must be created via `supabase_migration.sql` before road sensor loading works
- Overpass API can be unreliable (504 timeouts) — the tile-based approach with retries handles this gracefully

### Deployment
- Render deployment via `render.yaml`
- `build_files.sh` installs deps, runs migrations, collects static
- Production uses PostgreSQL via `DATABASE_URL`
- Development uses SQLite + Supabase cloud
- Whitenoise serves static files
