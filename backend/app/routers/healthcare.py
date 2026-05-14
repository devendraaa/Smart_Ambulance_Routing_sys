from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from supabase import create_client, AsyncClient
import os
import sys

# Add parent directory to path for config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app.config import settings
    SUPABASE_URL = settings.SUPABASE_URL
    SUPABASE_KEY = settings.SUPABASE_KEY
except ImportError:
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

router = APIRouter(tags=["healthcare"])

supabase: AsyncClient = None

def get_supabase():
    global supabase
    if supabase is None and SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase


# --- Pydantic Models ---
class PrescriptionCreate(BaseModel):
    patient_email: str
    appointment_id: Optional[str] = None
    doctor_name: Optional[str] = None
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    medicines: Optional[str] = None
    treatment: Optional[str] = None
    notes: Optional[str] = None
    suggested_tests: Optional[str] = None


class TestBookingCreate(BaseModel):
    patient_email: str
    test_type: str
    appointment_id: Optional[str] = None
    appointment_slot: Optional[datetime] = None
    payment_amount: Optional[float] = None


class AIMessage(BaseModel):
    role: str
    content: str


class AISessionCreate(BaseModel):
    patient_email: Optional[str] = None
    messages: List[AIMessage]
    symptoms: Optional[str] = None


class DoctorCreate(BaseModel):
    name: str
    specialty: str
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    department: str
    consultation_fee: Optional[float] = None
    languages: Optional[str] = None
    image_url: Optional[str] = None


class VideoConsultationCreate(BaseModel):
    patient_email: str
    doctor_id: str
    appointment_date: datetime
    notes: Optional[str] = None
    consultation_fee: Optional[float] = None


class MedicineCreate(BaseModel):
    patient_email: str
    prescription_id: Optional[str] = None
    medicine_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    timing: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class DietCreate(BaseModel):
    patient_email: str
    diet_name: str
    diet_type: Optional[str] = None
    calories: Optional[str] = None
    timing: Optional[str] = None
    foods: Optional[str] = None
    instructions: Optional[str] = None


# --- Prescription Endpoints ---
@router.post("/prescriptions")
async def create_prescription(data: PrescriptionCreate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured - run healthcare_tables.sql")

    try:
        result = sb.table("patient_prescriptions").insert({
            "patient_email": data.patient_email,
            "appointment_id": data.appointment_id,
            "doctor_name": data.doctor_name,
            "symptoms": data.symptoms,
            "diagnosis": data.diagnosis,
            "medicines": data.medicines,
            "treatment": data.treatment,
            "notes": data.notes,
            "suggested_tests": data.suggested_tests,
        }).execute()
        return {"id": result.data[0]["id"], "message": "Prescription created"}
    except Exception as e:
        raise HTTPException(500, f"Failed to create prescription: {str(e)}")


@router.get("/prescriptions/{patient_email}")
async def get_prescriptions(patient_email: str):
    sb = get_supabase()
    if not sb:
        return {"prescriptions": []}

    try:
        result = sb.table("patient_prescriptions").select("*").eq("patient_email", patient_email).order("created_at", desc=True).execute()
        return {"prescriptions": result.data}
    except Exception as e:
        return {"prescriptions": [], "error": str(e)}


@router.put("/prescriptions/{prescription_id}")
async def update_prescription(prescription_id: str, data: PrescriptionCreate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        result = sb.table("patient_prescriptions").update(update_data).eq("id", prescription_id).execute()
        return {"message": "Prescription updated", "id": prescription_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to update prescription: {str(e)}")


# --- Test Booking Endpoints ---
@router.post("/tests")
async def book_test(data: TestBookingCreate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured - run healthcare_tables.sql")

    try:
        result = sb.table("patient_tests").insert({
            "patient_email": data.patient_email,
            "test_type": data.test_type,
            "appointment_id": data.appointment_id,
            "appointment_slot": data.appointment_slot.isoformat() if data.appointment_slot else None,
            "payment_amount": data.payment_amount,
            "status": "payment_pending",
        }).execute()
        return {"id": result.data[0]["id"], "message": "Test booked, pending payment"}
    except Exception as e:
        raise HTTPException(500, f"Failed to book test: {str(e)}")


@router.get("/tests/{patient_email}")
async def get_patient_tests(patient_email: str):
    sb = get_supabase()
    if not sb:
        return {"tests": []}

    try:
        result = sb.table("patient_tests").select("*").eq("patient_email", patient_email).order("created_at", desc=True).execute()
        return {"tests": result.data}
    except Exception as e:
        return {"tests": [], "error": str(e)}


@router.post("/tests/{test_id}/pay")
async def confirm_test_payment(test_id: str, payment_reference: str = ""):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        result = sb.table("patient_tests").update({
            "payment_status": "paid",
            "status": "confirmed",
            "payment_reference": payment_reference,
        }).eq("id", test_id).execute()
        return {"message": "Payment confirmed", "id": test_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to confirm payment: {str(e)}")


@router.put("/tests/{test_id}/report")
async def upload_test_report(test_id: str, report_url: str):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        result = sb.table("patient_tests").update({
            "report_url": report_url,
            "status": "completed",
        }).eq("id", test_id).execute()
        return {"message": "Report uploaded", "id": test_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to upload report: {str(e)}")


# --- AI Symptom Checker Endpoints ---
@router.post("/ai/session")
async def create_ai_session(data: AISessionCreate):
    sb = get_supabase()

    session_data = [{"role": m.role, "content": m.content} for m in data.messages]
    symptoms_text = data.symptoms or ""

    # Keyword-based department hint
    department_hint = "General OPD"
    test_hints = []

    symptom_keywords = {
        "chest": ("Heart & Emergency", ["ECG", "Blood Test", "X-Ray"]),
        "heart": ("Heart & Emergency", ["ECG", "Blood Test", "Echocardiography"]),
        "head": ("Neurology", ["CT Scan", "MRI"]),
        "brain": ("Neurology", ["MRI", "CT Scan"]),
        "bone": ("Orthopedic", ["X-Ray", "CT Scan"]),
        "fracture": ("Orthopedic", ["X-Ray", "MRI"]),
        "child": ("Child OPD", ["Blood Test", "General Checkup"]),
        "pregnancy": ("Women & Pregnancy", ["Sonography", "Blood Test"]),
        "diabetes": ("Diabetes & Kidney", ["Blood Test", "HbA1c"]),
        "kidney": ("Diabetes & Kidney", ["Blood Test", "Urine Test"]),
        "mental": ("Mental Health", ["General Consultation"]),
        "depression": ("Mental Health", ["General Consultation"]),
        "skin": ("General OPD", ["Blood Test", "Biopsy"]),
        "eye": ("ENT / Eye", ["Eye Test", "CT Scan"]),
        "ear": ("ENT / Eye", ["Audiometry", "General Checkup"]),
    }

    symptoms_lower = symptoms_text.lower()
    for keyword, (dept, tests) in symptom_keywords.items():
        if keyword in symptoms_lower:
            department_hint = dept
            test_hints = tests
            break

    # Always return AI response (works without database)
    return {
        "session_id": "session-" + str(hash(symptoms_text))[:8],
        "department_hint": department_hint,
        "recommended_tests": test_hints,
    }


# --- Doctor Endpoints ---
@router.get("/doctors")
async def get_doctors(specialty: Optional[str] = None):
    # Return sample doctors without database dependency
    sample_doctors = [
        {"id": "1", "name": "Dr. Priya Sharma", "specialty": "General Physician", "qualification": "MBBS, MD", "experience_years": 12, "department": "General OPD", "consultation_fee": 500, "languages": "Hindi, English, Marathi", "rating": 4.8, "total_reviews": 156, "is_available": True},
        {"id": "2", "name": "Dr. Rajesh Patel", "specialty": "Cardiologist", "qualification": "MBBS, DM Cardiology", "experience_years": 18, "department": "Heart & Emergency", "consultation_fee": 800, "languages": "Hindi, English", "rating": 4.9, "total_reviews": 243, "is_available": True},
        {"id": "3", "name": "Dr. Anjali Desai", "specialty": "Pediatrician", "qualification": "MBBS, MD Pediatrics", "experience_years": 10, "department": "Child OPD", "consultation_fee": 600, "languages": "Hindi, English, Marathi", "rating": 4.7, "total_reviews": 189, "is_available": True},
        {"id": "4", "name": "Dr. Vikram Singh", "specialty": "Orthopedic", "qualification": "MBBS, MS Ortho", "experience_years": 15, "department": "Orthopedic", "consultation_fee": 700, "languages": "Hindi, English", "rating": 4.6, "total_reviews": 132, "is_available": True},
        {"id": "5", "name": "Dr. Sunita Joshi", "specialty": "Neurologist", "qualification": "MBBS, DM Neurology", "experience_years": 20, "department": "Neurology", "consultation_fee": 1000, "languages": "Hindi, English", "rating": 4.9, "total_reviews": 278, "is_available": True},
        {"id": "6", "name": "Dr. Amit Kumar", "specialty": "Diabetologist", "qualification": "MBBS, MD Medicine", "experience_years": 14, "department": "Diabetes & Kidney", "consultation_fee": 650, "languages": "Hindi, English, Marathi", "rating": 4.5, "total_reviews": 98, "is_available": True},
        {"id": "7", "name": "Dr. Meera Gupta", "specialty": "Gynecologist", "qualification": "MBBS, MS OBG", "experience_years": 16, "department": "Women & Pregnancy", "consultation_fee": 750, "languages": "Hindi, English", "rating": 4.8, "total_reviews": 215, "is_available": True},
        {"id": "8", "name": "Dr. Suresh Nair", "specialty": "Emergency Medicine", "qualification": "MBBS, MD Emergency", "experience_years": 8, "department": "Accident & Trauma", "consultation_fee": 550, "languages": "Hindi, English, Malayalam", "rating": 4.4, "total_reviews": 67, "is_available": True},
    ]
    return {"doctors": sample_doctors}


@router.get("/doctors/{doctor_id}")
async def get_doctor(doctor_id: str):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        result = sb.table("doctors").select("*").eq("id", doctor_id).execute()
        if not result.data:
            raise HTTPException(404, "Doctor not found")
        return {"doctor": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to get doctor: {str(e)}")


# --- Video Consultation Endpoints ---
@router.post("/video-consultations")
async def book_video_consultation(data: VideoConsultationCreate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured - run healthcare_tables.sql")

    try:
        result = sb.table("video_consultations").insert({
            "patient_email": data.patient_email,
            "doctor_id": data.doctor_id,
            "appointment_date": data.appointment_date.isoformat(),
            "notes": data.notes,
            "consultation_fee": data.consultation_fee,
            "status": "scheduled",
        }).execute()
        return {"id": result.data[0]["id"], "message": "Video consultation booked"}
    except Exception as e:
        raise HTTPException(500, f"Failed to book consultation: {str(e)}")


@router.get("/video-consultations/{patient_email}")
async def get_video_consultations(patient_email: str):
    sb = get_supabase()
    if not sb:
        return {"consultations": []}

    try:
        result = sb.table("video_consultations").select("*").eq("patient_email", patient_email).order("appointment_date", desc=True).execute()
        return {"consultations": result.data}
    except Exception as e:
        return {"consultations": [], "error": str(e)}


# --- Medicine Endpoints ---
@router.post("/medicines")
async def add_medicine(data: MedicineCreate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured - run healthcare_tables.sql")

    try:
        result = sb.table("patient_medicines").insert({
            "patient_email": data.patient_email,
            "prescription_id": data.prescription_id,
            "medicine_name": data.medicine_name,
            "dosage": data.dosage,
            "frequency": data.frequency,
            "timing": data.timing,
            "duration": data.duration,
            "instructions": data.instructions,
            "start_date": data.start_date.isoformat() if data.start_date else None,
            "end_date": data.end_date.isoformat() if data.end_date else None,
        }).execute()
        return {"id": result.data[0]["id"], "message": "Medicine added"}
    except Exception as e:
        raise HTTPException(500, f"Failed to add medicine: {str(e)}")


@router.get("/medicines/{patient_email}")
async def get_patient_medicines(patient_email: str, active_only: bool = True):
    sb = get_supabase()
    if not sb:
        return {"medicines": []}

    try:
        query = sb.table("patient_medicines").select("*").eq("patient_email", patient_email)
        if active_only:
            query = query.eq("is_active", True)
        result = query.order("created_at", desc=True).execute()
        return {"medicines": result.data}
    except Exception as e:
        return {"medicines": [], "error": str(e)}


@router.put("/medicines/{medicine_id}")
async def update_medicine(medicine_id: str, is_active: Optional[bool] = None):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        update_data = {}
        if is_active is not None:
            update_data["is_active"] = is_active
        result = sb.table("patient_medicines").update(update_data).eq("id", medicine_id).execute()
        return {"message": "Medicine updated", "id": medicine_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to update medicine: {str(e)}")


# --- Diet Plan Endpoints ---
@router.post("/diets")
async def add_diet(data: DietCreate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured - run healthcare_tables.sql")

    try:
        result = sb.table("patient_diets").insert({
            "patient_email": data.patient_email,
            "diet_name": data.diet_name,
            "diet_type": data.diet_type,
            "calories": data.calories,
            "timing": data.timing,
            "foods": data.foods,
            "instructions": data.instructions,
            "is_active": True,
        }).execute()
        return {"id": result.data[0]["id"], "message": "Diet plan added"}
    except Exception as e:
        raise HTTPException(500, f"Failed to add diet: {str(e)}")


@router.get("/diets/{patient_email}")
async def get_patient_diets(patient_email: str, active_only: bool = True):
    sb = get_supabase()
    if not sb:
        return {"diets": []}

    try:
        query = sb.table("patient_diets").select("*").eq("patient_email", patient_email)
        if active_only:
            query = query.eq("is_active", True)
        result = query.order("created_at", desc=True).execute()
        return {"diets": result.data}
    except Exception as e:
        return {"diets": [], "error": str(e)}


@router.put("/diets/{diet_id}")
async def update_diet(diet_id: str, is_active: Optional[bool] = None):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        update_data = {"updated_at": datetime.utcnow().isoformat()}
        if is_active is not None:
            update_data["is_active"] = is_active
        result = sb.table("patient_diets").update(update_data).eq("id", diet_id).execute()
        return {"message": "Diet updated", "id": diet_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to update diet: {str(e)}")
