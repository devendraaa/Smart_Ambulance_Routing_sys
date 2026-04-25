from fastapi import APIRouter, HTTPException
from uuid import uuid4
from app.database import supabase
from app.schemas.route_task import (
    RouteComputeRequest,
    RouteTaskStartResponse,
    RouteTaskStatusResponse,
    CoordinateResponse,
)
from app.tasks.worker import task_queue

router = APIRouter()


@router.post("/compute", response_model=RouteTaskStartResponse)
async def start_route_computation(data: RouteComputeRequest):
    task_id = str(uuid4())
    supabase.table("route_tasks").insert({
        "id": task_id,
        "origin_lat": data.origin_lat,
        "origin_lon": data.origin_lon,
        "hospital_name": data.hospital_name,
        "status": "pending",
        "progress": 0.0,
    }).execute()

    task_queue.put({
        "task_id": task_id,
        "origin_lat": data.origin_lat,
        "origin_lon": data.origin_lon,
        "hospital_name": data.hospital_name,
        "hospital_lat": data.hospital_lat,
        "hospital_lon": data.hospital_lon,
    })

    return RouteTaskStartResponse(task_id=task_id, status="pending")


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
    return RouteTaskStatusResponse(
        task_id=task["id"],
        status=task["status"],
        progress=round(task.get("progress", 0), 4),
        processed_nodes=task.get("processed_nodes", 0),
        total_nodes=task.get("total_nodes", 0),
        distance_km=distance_km,
        duration_min=duration_min,
        error=task.get("error_message") if task["status"] == "failed" else None,
        result=result_json if task["status"] == "completed" else None,
        map_url=task.get("map_url") if task["status"] == "completed" else None,
    )


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
    """Fetch extracted turning points for a route task."""
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
    """Return both raw coordinates and turning points for a route task."""
    # Raw route coordinates
    coord_res = (
        supabase.table("route_task_coordinates")
        .select("*")
        .eq("task_id", task_id)
        .order("sequence_order")
        .execute()
    )
    # Turning points
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

