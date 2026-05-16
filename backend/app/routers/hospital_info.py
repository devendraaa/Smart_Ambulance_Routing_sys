from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.database import supabase

router = APIRouter()


class HospitalInfoCreate(BaseModel):
    hospital_name: str
    case_type: str
    doctor_name: str
    ward_no: str
    floor_no: str
    bed_no: Optional[str] = None


class HospitalInfoUpdate(BaseModel):
    doctor_name: Optional[str] = None
    ward_no: Optional[str] = None
    floor_no: Optional[str] = None
    bed_no: Optional[str] = None


@router.get("/")
async def get_hospital_info(
    hospital_name: Optional[str] = None,
    case_type: Optional[str] = None
):
    """Get hospital info, optionally filtered by hospital and/or case type."""
    query = supabase.table("hospital_info").select("*")

    if hospital_name:
        query = query.eq("hospital_name", hospital_name)
    if case_type:
        query = query.eq("case_type", case_type)

    result = query.execute()
    return result.data


@router.post("/", status_code=201)
async def create_hospital_info(data: HospitalInfoCreate):
    """Add hospital info entry."""
    result = supabase.table("hospital_info").insert({
        "hospital_name": data.hospital_name,
        "case_type": data.case_type,
        "doctor_name": data.doctor_name,
        "ward_no": data.ward_no,
        "floor_no": data.floor_no,
        "bed_no": data.bed_no
    }).execute()
    return result.data[0]


@router.put("/{info_id}")
async def update_hospital_info(info_id: str, data: HospitalInfoUpdate):
    """Update hospital info entry."""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = "now()"

    result = supabase.table("hospital_info").update(update_data).eq("id", info_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Hospital info not found")

    return result.data[0]


@router.delete("/{info_id}")
async def delete_hospital_info(info_id: str):
    """Delete hospital info entry."""
    result = supabase.table("hospital_info").delete().eq("id", info_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Hospital info not found")

    return {"message": "Hospital info deleted"}