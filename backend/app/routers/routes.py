from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import uuid4
from app.database import supabase
from app.schemas.route_task import (
    RouteComputeRequest,
    RouteTaskStartResponse,
    RouteTaskStatusResponse,
    CoordinateResponse,
    EmergencyCaseResponse,
)
from typing import Optional, List
from app.tasks.worker import task_queue

router = APIRouter()

amb_locations: dict[str, dict] = {}


@router.post("/compute", response_model=RouteTaskStartResponse)
async def start_route_computation(data: RouteComputeRequest):
    import traceback
    task_id = str(uuid4())
    patient_uhid = f"RTE-{uuid4().hex[:8].upper()}"
    insert_data = {
        "id": task_id,
        "origin_lat": data.origin_lat,
        "origin_lon": data.origin_lon,
        "hospital_name": data.hospital_name,
        "status": "pending",
        "dispatch_status": "unassigned",
        "progress": 0.0,
        "patient_uhid": patient_uhid,
    }
    if data.hospital_lat:
        insert_data["hospital_lat"] = data.hospital_lat
    if data.hospital_lon:
        insert_data["hospital_lon"] = data.hospital_lon
    if data.patient_name:
        insert_data["patient_name"] = data.patient_name
    if data.patient_age:
        insert_data["patient_age"] = data.patient_age
    if data.patient_sex:
        insert_data["patient_sex"] = data.patient_sex
    if data.patient_mobile:
        insert_data["patient_mobile"] = data.patient_mobile
    if data.patient_case:
        insert_data["patient_case"] = data.patient_case
    if data.patient_blood_group:
        insert_data["patient_blood_group"] = data.patient_blood_group
    if data.patient_date:
        insert_data["patient_date"] = data.patient_date
    if data.ambulance_number:
        insert_data["ambulance_number"] = data.ambulance_number
    if data.driver_name:
        insert_data["driver_name"] = data.driver_name
    if data.driver_mobile:
        insert_data["driver_mobile"] = data.driver_mobile
    if data.patient_bp_systolic:
        insert_data["patient_bp_systolic"] = data.patient_bp_systolic
    if data.patient_bp_diastolic:
        insert_data["patient_bp_diastolic"] = data.patient_bp_diastolic
    if data.patient_temperature:
        insert_data["patient_temperature"] = data.patient_temperature
    if data.patient_pulse:
        insert_data["patient_pulse"] = data.patient_pulse
    if data.patient_spo2:
        insert_data["patient_spo2"] = data.patient_spo2

    try:
        supabase.table("route_tasks").insert(insert_data).execute()
    except Exception as e:
        print(f"[ROUTE] DB insert failed: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    try:
        task_queue.put({
            "task_id": task_id,
            "origin_lat": data.origin_lat,
            "origin_lon": data.origin_lon,
            "hospital_name": data.hospital_name,
            "hospital_lat": data.hospital_lat,
            "hospital_lon": data.hospital_lon,
        })
    except Exception as e:
        print(f"[ROUTE] Task queue error: {e}")
        print(traceback.format_exc())

    return RouteTaskStartResponse(task_id=task_id, status="pending", patient_uhid=patient_uhid)


# IMPORTANT: Emergency endpoints must be BEFORE /{task_id} routes
# because FastAPI matches routes in order

@router.get("/emergency/cases", response_model=List[EmergencyCaseResponse])
async def get_emergency_cases(
    hospital_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    Get emergency cases filtered by hospital and/or date range.
    Defaults to today's cases if no date range is provided.
    Returns cases with patient details for the doctor dashboard.
    """
    from datetime import datetime, timezone

    query = supabase.table("route_tasks").select("*").order("created_at", desc=True)

    if hospital_name:
        query = query.ilike("hospital_name", f"%{hospital_name}%")

    if not start_date and not end_date:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        query = query.gte("created_at", today_start)
    else:
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date + "T23:59:59")

    result = query.execute()

    cases = []
    for task in result.data:
        if task.get("patient_name") or task.get("patient_case") or task.get("patient_mobile"):
            result_json = task.get("result_json")
            distance_km = None
            duration_min = None
            if result_json and isinstance(result_json, dict):
                distance_km = result_json.get("distance_km")
                duration_min = result_json.get("duration_min")

            cases.append(EmergencyCaseResponse(
                task_id=task["id"],
                hospital_name=task.get("hospital_name", ""),
                origin_lat=task.get("origin_lat", 0),
                origin_lon=task.get("origin_lon", 0),
                patient_uhid=task.get("patient_uhid"),
                patient_name=task.get("patient_name"),
                patient_age=task.get("patient_age"),
                patient_sex=task.get("patient_sex"),
                patient_mobile=task.get("patient_mobile"),
                patient_case=task.get("patient_case"),
                patient_blood_group=task.get("patient_blood_group"),
                patient_date=task.get("patient_date"),
                status=task.get("status", ""),
                created_at=task.get("created_at", ""),
                distance_km=distance_km,
                duration_min=duration_min,
                ambulance_number=task.get("ambulance_number"),
                driver_name=task.get("driver_name"),
                driver_mobile=task.get("driver_mobile"),
                patient_bp_systolic=task.get("patient_bp_systolic"),
                patient_bp_diastolic=task.get("patient_bp_diastolic"),
                patient_temperature=task.get("patient_temperature"),
                patient_pulse=task.get("patient_pulse"),
                patient_spo2=task.get("patient_spo2"),
            ))

    return cases


@router.get("/emergency/hospitals")
async def get_emergency_hospitals():
    """Get list of hospitals that have emergency cases."""
    result = supabase.table("route_tasks").select("hospital_name").execute()

    hospitals = set()
    for task in result.data:
        if task.get("hospital_name"):
            hospitals.add(task["hospital_name"])

    return {"hospitals": sorted(list(hospitals))}


# ==================== DISPATCH DASHBOARD ENDPOINTS ====================


@router.get("/dispatch/active")
async def get_active_dispatch_cases():
    """Get today's active route tasks for the dispatcher dashboard (filters by dispatch_status, not computation status)."""
    from datetime import datetime, timezone
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    result = supabase.table("route_tasks").select("*").gte("created_at", today_start).order("created_at", desc=True).execute()
    active = []
    for task in result.data:
        dispatch_status = task.get("dispatch_status", "unassigned")
        if dispatch_status in ("completed", "cancelled"):
            continue
        result_json = task.get("result_json")
        distance_km = None
        duration_min = None
        if result_json and isinstance(result_json, dict):
            distance_km = result_json.get("distance_km")
            duration_min = result_json.get("duration_min")

        loc = amb_locations.get(task["id"], {})
        entry = {
            "task_id": task["id"],
            "status": task.get("status", ""),
            "dispatch_status": dispatch_status,
            "progress": round(task.get("progress", 0), 4),
            "patient_uhid": task.get("patient_uhid"),
            "patient_name": task.get("patient_name"),
            "patient_age": task.get("patient_age"),
            "patient_sex": task.get("patient_sex"),
            "patient_mobile": task.get("patient_mobile"),
            "patient_case": task.get("patient_case"),
            "patient_blood_group": task.get("patient_blood_group"),
            "patient_date": task.get("patient_date"),
            "hospital_name": task.get("hospital_name", ""),
            "origin_lat": task.get("origin_lat", 0),
            "origin_lon": task.get("origin_lon", 0),
            "hospital_lat": task.get("hospital_lat"),
            "hospital_lon": task.get("hospital_lon"),
            "ambulance_number": task.get("ambulance_number"),
            "driver_name": task.get("driver_name"),
            "driver_mobile": task.get("driver_mobile"),
            "patient_bp_systolic": task.get("patient_bp_systolic"),
            "patient_bp_diastolic": task.get("patient_bp_diastolic"),
            "patient_temperature": task.get("patient_temperature"),
            "patient_pulse": task.get("patient_pulse"),
            "patient_spo2": task.get("patient_spo2"),
            "distance_km": distance_km,
            "duration_min": duration_min,
            "created_at": task.get("created_at", ""),
            "current_lat": loc.get("lat"),
            "current_lon": loc.get("lon"),
            "last_location_update": loc.get("updated_at"),
        }
        active.append(entry)
    return {"cases": active, "count": len(active)}


@router.get("/dispatch/stats")
async def get_dispatch_stats():
    """Get case counts grouped by dispatch_status."""
    result = supabase.table("route_tasks").select("dispatch_status").execute()
    counts: dict[str, int] = {}
    for task in result.data:
        s = task.get("dispatch_status", "unassigned")
        counts[s] = counts.get(s, 0) + 1
    return {"stats": counts}


class AssignAmbulanceRequest(BaseModel):
    ambulance_number: str
    driver_name: str
    driver_mobile: str


@router.post("/dispatch/{task_id}/assign")
async def assign_ambulance(task_id: str, data: AssignAmbulanceRequest):
    """Assign an ambulance and driver to a route task."""
    result = supabase.table("route_tasks").select("status").eq("id", task_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")

    supabase.table("route_tasks").update({
        "ambulance_number": data.ambulance_number,
        "driver_name": data.driver_name,
        "driver_mobile": data.driver_mobile,
        "dispatch_status": "assigned",
    }).eq("id", task_id).execute()

    return {
        "message": "Ambulance assigned",
        "task_id": task_id,
        "ambulance_number": data.ambulance_number,
        "driver_name": data.driver_name,
    }


class UpdateStatusRequest(BaseModel):
    status: str


@router.post("/dispatch/{task_id}/status")
async def update_dispatch_status(task_id: str, data: UpdateStatusRequest):
    """Update the dispatch_status of a route task (arrived, delivering, completed, etc.)."""
    valid = ("unassigned", "assigned", "arrived", "delivering", "completed", "cancelled")
    if data.status not in valid:
        raise HTTPException(400, f"Invalid dispatch_status. Must be one of: {valid}")

    result = supabase.table("route_tasks").select("dispatch_status").eq("id", task_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")

    supabase.table("route_tasks").update({"dispatch_status": data.status}).eq("id", task_id).execute()
    return {"message": f"Dispatch status updated to {data.status}", "task_id": task_id, "dispatch_status": data.status}


class LocationUpdateRequest(BaseModel):
    lat: float
    lon: float


@router.post("/dispatch/{task_id}/location")
async def update_ambulance_location(task_id: str, data: LocationUpdateRequest):
    """Store the current GPS location of an ambulance (called by the driver's browser)."""
    from datetime import datetime, timezone
    amb_locations[task_id] = {
        "lat": data.lat,
        "lon": data.lon,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return {"message": "Location updated", "task_id": task_id}


@router.get("/{task_id}", response_model=RouteTaskStatusResponse)
async def get_task_status(task_id: str):
    result = supabase.table("route_tasks").select("*").eq("id", task_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")

    task = result.data[0]
    result_json = task.get("result_json")
    distance_km = None
    duration_min = None
    if result_json and isinstance(result_json, dict):
        distance_km = result_json.get("distance_km")
        duration_min = result_json.get("duration_min")

    response_data = {
        "task_id": task["id"],
        "status": task["status"],
        "progress": round(task.get("progress", 0), 4),
        "processed_nodes": task.get("processed_nodes", 0),
        "total_nodes": task.get("total_nodes", 0),
        "distance_km": distance_km,
        "duration_min": duration_min,
        "error": task.get("error_message") if task["status"] == "failed" else None,
        "result": result_json if task["status"] == "completed" else None,
        "map_url": task.get("map_url") if task["status"] == "completed" else None,
    }

    if task.get("patient_uhid"):
        response_data["patient_uhid"] = task["patient_uhid"]
    if task.get("patient_name"):
        response_data["patient_name"] = task["patient_name"]
    if task.get("patient_age"):
        response_data["patient_age"] = task["patient_age"]
    if task.get("patient_sex"):
        response_data["patient_sex"] = task["patient_sex"]
    if task.get("patient_mobile"):
        response_data["patient_mobile"] = task["patient_mobile"]
    if task.get("patient_case"):
        response_data["patient_case"] = task["patient_case"]
    if task.get("patient_blood_group"):
        response_data["patient_blood_group"] = task["patient_blood_group"]
    if task.get("patient_date"):
        response_data["patient_date"] = task["patient_date"]
    if task.get("ambulance_number"):
        response_data["ambulance_number"] = task["ambulance_number"]
    if task.get("driver_name"):
        response_data["driver_name"] = task["driver_name"]
    if task.get("driver_mobile"):
        response_data["driver_mobile"] = task["driver_mobile"]
    # Physiological conditions
    if task.get("patient_bp_systolic"):
        response_data["patient_bp_systolic"] = task["patient_bp_systolic"]
    if task.get("patient_bp_diastolic"):
        response_data["patient_bp_diastolic"] = task["patient_bp_diastolic"]
    if task.get("patient_temperature"):
        response_data["patient_temperature"] = task["patient_temperature"]
    if task.get("patient_pulse"):
        response_data["patient_pulse"] = task["patient_pulse"]
    if task.get("patient_spo2"):
        response_data["patient_spo2"] = task["patient_spo2"]

    return RouteTaskStatusResponse(**response_data)


@router.get("/{task_id}/coordinates", response_model=CoordinateResponse)
async def get_task_coordinates(task_id: str):
    result = (
        supabase.table("route_task_coordinates")
        .select("*")
        .eq("task_id", task_id)
        .order("sequence_order")
        .execute()
    )

    return CoordinateResponse(
        coordinates=[
            {"lat": c["latitude"], "lon": c["longitude"], "sequence": c["sequence_order"]}
            for c in result.data
        ]
    )


@router.get("/{task_id}/turns")
async def get_task_turn_points(task_id: str):
    result = (
        supabase.table("route_turn_points")
        .select("*")
        .eq("task_id", task_id)
        .order("sequence_order")
        .execute()
    )

    return {
        "turn_points": [
            {"lat": t["latitude"], "lon": t["longitude"], "sequence": t["sequence_order"]}
            for t in (result.data or [])
        ]
    }


@router.get("/{task_id}/full")
async def get_full_route(task_id: str):
    coord_res = (
        supabase.table("route_task_coordinates")
        .select("*")
        .eq("task_id", task_id)
        .order("sequence_order")
        .execute()
    )
    turn_res = (
        supabase.table("route_turn_points")
        .select("*")
        .eq("task_id", task_id)
        .order("sequence_order")
        .execute()
    )

    return {
        "coordinates": [
            {"lat": c["latitude"], "lon": c["longitude"], "sequence": c["sequence_order"]}
            for c in (coord_res.data or [])
        ],
        "turn_points": [
            {"lat": t["latitude"], "lon": t["longitude"], "sequence": t["sequence_order"]}
            for t in (turn_res.data or [])
        ],
    }


@router.get("/{task_id}/traffic-signals")
async def get_traffic_signals(task_id: str):
    coord_res = (
        supabase.table("route_task_coordinates")
        .select("latitude,longitude")
        .eq("task_id", task_id)
        .order("sequence_order")
        .execute()
    )
    if not coord_res.data:
        raise HTTPException(status_code=404, detail="Route coordinates not found")

    coordinates = [(c["latitude"], c["longitude"]) for c in coord_res.data]
    from app.services.osm_client import fetch_traffic_signals_along_route
    try:
        signals = await fetch_traffic_signals_along_route(coordinates)
        return {"signals": signals, "count": len(signals)}
    except Exception as e:
        print(f"[TRAFFIC] Error fetching traffic signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{task_id}/road-sensors")
async def get_route_road_sensors(task_id: str):
    result = supabase.table("route_tasks").select("status,result_json").eq("id", task_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")

    task = result.data[0]
    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"Task not completed (status: {task['status']})")

    result_json = task.get("result_json")
    if not result_json or not isinstance(result_json, dict):
        return {"road_sensors": [], "count": 0}

    road_sensors = result_json.get("road_sensors", [])
    return {"road_sensors": road_sensors, "count": len(road_sensors)}