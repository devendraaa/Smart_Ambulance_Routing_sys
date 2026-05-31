from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from supabase import create_client, AsyncClient
import os
import sys
import uuid

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
    chief_complaint: Optional[str] = None
    symptom_notes: Optional[str] = None
    severity_level: Optional[int] = None
    duration: Optional[str] = None
    existing_diseases: Optional[str] = None
    diagnosis: Optional[str] = None
    emergency_indicators: Optional[List[str]] = None
    vitals: Optional[Dict[str, Any]] = None
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
    patient_name: Optional[str] = None
    hospital_name: Optional[str] = None
    appointment_id: Optional[str] = None
    prescription_id: Optional[str] = None
    medicine_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    timing: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    route: Optional[str] = 'Oral'
    is_prn: Optional[bool] = False
    quantity: Optional[str] = None
    refills: Optional[str] = '0'
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class MedicineUpdate(BaseModel):
    medicine_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    timing: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    route: Optional[str] = None
    is_prn: Optional[bool] = None
    quantity: Optional[str] = None
    refills: Optional[str] = None
    is_active: Optional[bool] = None
    medicine_collected: Optional[bool] = None
    collected_at: Optional[datetime] = None
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
            "chief_complaint": data.chief_complaint,
            "symptom_notes": data.symptom_notes,
            "severity_level": data.severity_level,
            "duration": data.duration,
            "existing_diseases": data.existing_diseases,
            "diagnosis": data.diagnosis,
            "emergency_indicators": data.emergency_indicators,
            "vitals": data.vitals,
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
async def get_patient_tests(patient_email: str, patient_name: Optional[str] = None):
    sb = get_supabase()
    if not sb:
        return {"tests": []}

    try:
        if patient_name:
            result = sb.table("patient_tests").select("*").eq("patient_name", patient_name).eq("patient_email", patient_email).order("created_at", desc=True).execute()
            if result.data:
                return {"tests": result.data}
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


@router.post("/tests/{test_id}/upload-file")
async def upload_test_report_file(test_id: str, file: UploadFile = File(...)):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    ALLOWED_TYPES = {
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Invalid file type. Allowed: {', '.join(ALLOWED_TYPES.keys())}")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large. Maximum size is 10MB")

    ext = ALLOWED_TYPES[file.content_type]
    filename = f"{uuid.uuid4()}{ext}"
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "reports")
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    report_url = f"/uploads/reports/{filename}"

    try:
        sb.table("patient_tests").update({
            "report_url": report_url,
            "status": "completed",
        }).eq("id", test_id).execute()
        return {"message": "Report uploaded successfully", "report_url": report_url, "id": test_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to update test record: {str(e)}")


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
            "patient_name": data.patient_name,
            "hospital_name": data.hospital_name,
            "appointment_id": data.appointment_id,
            "prescription_id": data.prescription_id,
            "medicine_name": data.medicine_name,
            "dosage": data.dosage,
            "frequency": data.frequency,
            "timing": data.timing,
            "duration": data.duration,
            "instructions": data.instructions,
            "route": data.route,
            "is_prn": data.is_prn,
            "quantity": data.quantity,
            "refills": data.refills,
            "start_date": data.start_date.isoformat() if data.start_date else None,
            "end_date": data.end_date.isoformat() if data.end_date else None,
        }).execute()
        return {"id": result.data[0]["id"], "message": "Medicine added"}
    except Exception as e:
        raise HTTPException(500, f"Failed to add medicine: {str(e)}")


@router.get("/medicines/{patient_email}")
async def get_patient_medicines(patient_email: str, active_only: bool = True, patient_name: Optional[str] = None):
    sb = get_supabase()
    if not sb:
        return {"medicines": []}

    try:
        if patient_name:
            query = sb.table("patient_medicines").select("*").eq("patient_name", patient_name).eq("patient_email", patient_email)
            if active_only:
                query = query.eq("is_active", True)
            result = query.order("created_at", desc=True).execute()
            if result.data:
                return {"medicines": result.data}
        query = sb.table("patient_medicines").select("*").eq("patient_email", patient_email)
        if active_only:
            query = query.eq("is_active", True)
        result = query.order("created_at", desc=True).execute()
        return {"medicines": result.data}
    except Exception as e:
        return {"medicines": [], "error": str(e)}


@router.put("/medicines/{medicine_id}")
async def update_medicine(medicine_id: str, data: MedicineUpdate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        result = sb.table("patient_medicines").update(update_data).eq("id", medicine_id).execute()
        return {"message": "Medicine updated", "id": medicine_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to update medicine: {str(e)}")


@router.delete("/medicines/{medicine_id}")
async def delete_medicine(medicine_id: str):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        sb.table("patient_medicines").delete().eq("id", medicine_id).execute()
        return {"message": "Medicine deleted", "id": medicine_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to delete medicine: {str(e)}")


@router.post("/medicines/{medicine_id}/toggle-collect")
async def toggle_collect_medicine(medicine_id: str):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        current = sb.table("patient_medicines").select("medicine_collected").eq("id", medicine_id).single().execute()
        was_collected = current.data.get("medicine_collected", False)
        update_data = {
            "medicine_collected": not was_collected,
            "collected_at": datetime.utcnow().isoformat() if not was_collected else None,
        }
        sb.table("patient_medicines").update(update_data).eq("id", medicine_id).execute()
        return {"message": "Collection status toggled", "id": medicine_id, "collected": not was_collected}
    except Exception as e:
        raise HTTPException(500, f"Failed to toggle collection: {str(e)}")


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


# ============== Doctor Prescriptions & Tests ==============

class DoctorPrescriptionCreate(BaseModel):
    patient_email: str
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    doctor_name: str
    hospital_id: Optional[str] = None
    hospital_name: Optional[str] = None
    symptoms: Optional[str] = None
    chief_complaint: Optional[str] = None
    symptom_notes: Optional[str] = None
    severity_level: Optional[int] = None
    duration: Optional[str] = None
    existing_diseases: Optional[str] = None
    diagnosis: Optional[str] = None
    emergency_indicators: Optional[List[str]] = None
    prescription_notes: Optional[str] = None
    medicines: Optional[str] = None  # JSON string
    follow_up_date: Optional[str] = None
    appointment_id: Optional[str] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    temperature: Optional[float] = None
    pulse: Optional[int] = None
    spo2: Optional[int] = None
    respiratory_rate: Optional[int] = None
    blood_sugar: Optional[int] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    bmi: Optional[float] = None
    pain_score: Optional[int] = None
    allergies: Optional[str] = None
    smoking_history: Optional[str] = None
    alcohol_history: Optional[str] = None
    past_medications: Optional[str] = None
    status: Optional[str] = "Active"


class DoctorPrescriptionUpdate(BaseModel):
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    symptoms: Optional[str] = None
    chief_complaint: Optional[str] = None
    symptom_notes: Optional[str] = None
    severity_level: Optional[int] = None
    duration: Optional[str] = None
    existing_diseases: Optional[str] = None
    diagnosis: Optional[str] = None
    emergency_indicators: Optional[List[str]] = None
    prescription_notes: Optional[str] = None
    medicines: Optional[str] = None
    follow_up_date: Optional[str] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    temperature: Optional[float] = None
    pulse: Optional[int] = None
    spo2: Optional[int] = None
    respiratory_rate: Optional[int] = None
    blood_sugar: Optional[int] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    bmi: Optional[float] = None
    pain_score: Optional[int] = None
    allergies: Optional[str] = None
    smoking_history: Optional[str] = None
    alcohol_history: Optional[str] = None
    past_medications: Optional[str] = None
    status: Optional[str] = None


class DoctorTestCreate(BaseModel):
    patient_email: str
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    doctor_name: str
    hospital_id: Optional[str] = None
    hospital_name: Optional[str] = None
    test_type: str
    test_reason: Optional[str] = None
    urgency: Optional[str] = "normal"
    notes: Optional[str] = None


class TestAppointmentCreate(BaseModel):
    test_id: str
    appointment_date: str  # YYYY-MM-DD
    appointment_time: str
    technician_name: Optional[str] = None
    room_number: Optional[str] = None
    preparation_notes: Optional[str] = None


# --- Doctor Prescription Endpoints ---
@router.post("/doctor/prescriptions")
async def create_doctor_prescription(data: DoctorPrescriptionCreate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        insert_data = {
            "patient_email": data.patient_email,
            "patient_name": data.patient_name,
            "patient_phone": data.patient_phone,
            "doctor_name": data.doctor_name,
            "hospital_id": data.hospital_id,
            "hospital_name": data.hospital_name,
            "symptoms": data.symptoms,
            "chief_complaint": data.chief_complaint,
            "symptom_notes": data.symptom_notes,
            "severity_level": data.severity_level,
            "duration": data.duration,
            "existing_diseases": data.existing_diseases,
            "diagnosis": data.diagnosis,
            "emergency_indicators": data.emergency_indicators,
            "prescription_notes": data.prescription_notes,
            "medicines": data.medicines,
            "follow_up_date": data.follow_up_date,
            "bp_systolic": data.bp_systolic,
            "bp_diastolic": data.bp_diastolic,
            "temperature": data.temperature,
            "pulse": data.pulse,
            "spo2": data.spo2,
            "respiratory_rate": data.respiratory_rate,
            "blood_sugar": data.blood_sugar,
            "weight": data.weight,
            "height": data.height,
            "bmi": data.bmi,
            "pain_score": data.pain_score,
            "allergies": data.allergies,
            "smoking_history": data.smoking_history,
            "alcohol_history": data.alcohol_history,
            "past_medications": data.past_medications,
            "status": "Active",
        }
        if data.appointment_id:
            insert_data["appointment_id"] = data.appointment_id
        result = sb.table("doctor_prescriptions").insert(insert_data).execute()
        return {"id": result.data[0]["id"], "message": "Prescription created successfully"}
    except Exception as e:
        raise HTTPException(500, f"Failed to create prescription: {str(e)}")


@router.put("/doctor/prescriptions/{prescription_id}")
async def update_doctor_prescription(prescription_id: str, data: DoctorPrescriptionUpdate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        if not update_data:
            raise HTTPException(400, "No fields to update")
        result = sb.table("doctor_prescriptions").update(update_data).eq("id", prescription_id).execute()
        if not result.data:
            raise HTTPException(404, "Prescription not found")
        return {"id": result.data[0]["id"], "message": "Prescription updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to update prescription: {str(e)}")


@router.delete("/doctor/prescriptions/{prescription_id}")
async def delete_doctor_prescription(prescription_id: str):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        result = sb.table("doctor_prescriptions").delete().eq("id", prescription_id).execute()
        if not result.data:
            raise HTTPException(404, "Prescription not found")
        return {"message": "Prescription deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to delete prescription: {str(e)}")


@router.get("/doctor/prescriptions")
async def get_doctor_prescriptions(
    hospital_id: Optional[str] = None,
    doctor_name: Optional[str] = None,
    patient_email: Optional[str] = None
):
    sb = get_supabase()
    if not sb:
        return {"prescriptions": []}

    try:
        query = sb.table("doctor_prescriptions").select("*").order("created_at", desc=True)
        if hospital_id:
            query = query.eq("hospital_id", hospital_id)
        if doctor_name:
            query = query.eq("doctor_name", doctor_name)
        if patient_email:
            query = query.eq("patient_email", patient_email)

        result = query.execute()
        return {"prescriptions": result.data}
    except Exception as e:
        return {"prescriptions": [], "error": str(e)}


@router.get("/doctor/prescriptions/stats")
async def get_prescription_stats(hospital_id: Optional[str] = None):
    sb = get_supabase()
    if not sb:
        return {"total": 0, "today": 0, "by_hospital": []}

    try:
        query = sb.table("doctor_prescriptions").select("*")
        if hospital_id:
            query = query.eq("hospital_id", hospital_id)
        result = query.execute()

        today = datetime.utcnow().date()
        prescriptions = result.data

        total = len(prescriptions)
        today_count = sum(1 for p in prescriptions if p.get("created_at") and
                         datetime.fromisoformat(p["created_at"].replace("Z", "+00:00")).date() == today)

        # Hospital-wise count
        hospital_stats = {}
        for p in prescriptions:
            h_name = p.get("hospital_name", "Unknown")
            hospital_stats[h_name] = hospital_stats.get(h_name, 0) + 1

        by_hospital = [{"hospital": k, "count": v} for k, v in hospital_stats.items()]

        return {"total": total, "today": today_count, "by_hospital": by_hospital}
    except Exception as e:
        return {"total": 0, "today": 0, "by_hospital": [], "error": str(e)}


# --- Doctor Test Assignment Endpoints ---
@router.post("/doctor/tests")
async def create_doctor_test(data: DoctorTestCreate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        result = sb.table("doctor_tests").insert({
            "patient_email": data.patient_email,
            "patient_name": data.patient_name,
            "patient_phone": data.patient_phone,
            "doctor_name": data.doctor_name,
            "hospital_id": data.hospital_id,
            "hospital_name": data.hospital_name,
            "test_type": data.test_type,
            "test_reason": data.test_reason,
            "urgency": data.urgency,
            "notes": data.notes,
            "status": "assigned",
        }).execute()
        return {"id": result.data[0]["id"], "message": "Test assigned successfully"}
    except Exception as e:
        raise HTTPException(500, f"Failed to assign test: {str(e)}")


@router.get("/doctor/tests")
async def get_doctor_tests(
    hospital_id: Optional[str] = None,
    status: Optional[str] = None,
    patient_email: Optional[str] = None
):
    sb = get_supabase()
    if not sb:
        return {"tests": []}

    try:
        query = sb.table("doctor_tests").select("*").order("created_at", desc=True)
        if hospital_id:
            query = query.eq("hospital_id", hospital_id)
        if status:
            query = query.eq("status", status)
        if patient_email:
            query = query.eq("patient_email", patient_email)

        result = query.execute()
        return {"tests": result.data}
    except Exception as e:
        return {"tests": [], "error": str(e)}


@router.get("/doctor/tests/stats")
async def get_test_stats(hospital_id: Optional[str] = None):
    sb = get_supabase()
    if not sb:
        return {"total": 0, "pending": 0, "completed": 0, "by_type": [], "by_hospital": []}

    try:
        query = sb.table("doctor_tests").select("*")
        if hospital_id:
            query = query.eq("hospital_id", hospital_id)
        result = query.execute()

        tests = result.data
        total = len(tests)
        pending = sum(1 for t in tests if t.get("status") in ["assigned", "scheduled"])
        completed = sum(1 for t in tests if t.get("status") == "completed")

        # By test type
        type_stats = {}
        for t in tests:
            t_type = t.get("test_type", "Unknown")
            type_stats[t_type] = type_stats.get(t_type, 0) + 1

        by_type = [{"test_type": k, "count": v} for k, v in type_stats.items()]

        # Hospital-wise
        hospital_stats = {}
        for t in tests:
            h_name = t.get("hospital_name", "Unknown")
            hospital_stats[h_name] = hospital_stats.get(h_name, 0) + 1

        by_hospital = [{"hospital": k, "count": v} for k, v in hospital_stats.items()]

        return {"total": total, "pending": pending, "completed": completed, "by_type": by_type, "by_hospital": by_hospital}
    except Exception as e:
        return {"total": 0, "pending": 0, "completed": 0, "by_type": [], "by_hospital": [], "error": str(e)}


@router.put("/doctor/tests/{test_id}/status")
async def update_test_status(test_id: str, status: str):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        result = sb.table("doctor_tests").update({
            "status": status,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", test_id).execute()
        return {"message": "Test status updated", "id": test_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to update test status: {str(e)}")


# --- Test Appointments (Test Operator) ---
@router.post("/tests/appointments")
async def create_test_appointment(data: TestAppointmentCreate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        # First get test details
        test_result = sb.table("doctor_tests").select("*").eq("id", data.test_id).execute()
        if not test_result.data:
            raise HTTPException(404, "Test not found")

        test = test_result.data[0]

        # Create appointment
        result = sb.table("test_appointments").insert({
            "test_id": data.test_id,
            "patient_email": test.get("patient_email"),
            "patient_name": test.get("patient_name"),
            "test_type": test.get("test_type"),
            "hospital_id": test.get("hospital_id"),
            "hospital_name": test.get("hospital_name"),
            "appointment_date": data.appointment_date,
            "appointment_time": data.appointment_time,
            "technician_name": data.technician_name,
            "room_number": data.room_number,
            "preparation_notes": data.preparation_notes,
            "status": "scheduled",
        }).execute()

        # Update test status to scheduled
        sb.table("doctor_tests").update({
            "status": "scheduled",
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", data.test_id).execute()

        return {"id": result.data[0]["id"], "message": "Appointment scheduled successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to create appointment: {str(e)}")


@router.get("/tests/appointments")
async def get_test_appointments(
    hospital_id: Optional[str] = None,
    patient_email: Optional[str] = None,
    date: Optional[str] = None
):
    sb = get_supabase()
    if not sb:
        return {"appointments": []}

    try:
        query = sb.table("test_appointments").select("*").order("appointment_date", desc=True).order("appointment_time", desc=True)
        if hospital_id:
            query = query.eq("hospital_id", hospital_id)
        if patient_email:
            query = query.eq("patient_email", patient_email)
        if date:
            query = query.eq("appointment_date", date)

        result = query.execute()
        return {"appointments": result.data}
    except Exception as e:
        return {"appointments": [], "error": str(e)}


@router.put("/tests/appointments/{appointment_id}")
async def update_test_appointment(appointment_id: str, status: Optional[str] = None, appointment_date: Optional[str] = None, appointment_time: Optional[str] = None):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        update_data = {"updated_at": datetime.utcnow().isoformat()}
        if status:
            update_data["status"] = status
        if appointment_date:
            update_data["appointment_date"] = appointment_date
        if appointment_time:
            update_data["appointment_time"] = appointment_time

        result = sb.table("test_appointments").update(update_data).eq("id", appointment_id).execute()
        return {"message": "Appointment updated", "id": appointment_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to update appointment: {str(e)}")


# --- Hospitals List ---
@router.get("/hospitals")
async def get_hospitals_list():
    sb = get_supabase()
    if not sb:
        return {"hospitals": []}

    try:
        result = sb.table("hospitals").select("id, name, address, city, state, contact_phone, hospital_type, bed_capacity").execute()
        return {"hospitals": result.data}
    except Exception as e:
        return {"hospitals": [], "error": str(e)}


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


class AppointmentStatusUpdate(BaseModel):
    status: str


@router.put("/appointments/{appointment_id}/status")
async def update_appointment_status(appointment_id: str, data: AppointmentStatusUpdate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")
    valid_statuses = ["scheduled", "in-consultation", "completed", "cancelled"]
    if data.status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid_statuses}")
    try:
        result = sb.table("patient_appointments").update({
            "status": data.status,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", appointment_id).execute()
        if not result.data:
            raise HTTPException(404, "Appointment not found")
        return {"message": f"Appointment status updated to {data.status}", "id": appointment_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to update appointment status: {str(e)}")


# ============== Patient Admission / Discharge / Notes / Transfers ==============

class AdmitPatientCreate(BaseModel):
    task_id: str
    triage_level: str
    triage_notes: Optional[str] = None
    ward_name: Optional[str] = None
    consultant_name: Optional[str] = None


class DoctorNoteCreate(BaseModel):
    task_id: str
    doctor_name: str
    note_type: str = "clinical"
    note_text: str


class PatientTransferCreate(BaseModel):
    task_id: str
    to_ward: str
    to_bed: Optional[str] = None
    reason: Optional[str] = None
    transferred_by: str


@router.post("/admit-patient")
async def admit_patient(data: AdmitPatientCreate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured - run admission_tables.sql")

    try:
        update_data = {
            "triage_level": data.triage_level,
            "triage_notes": data.triage_notes,
            "ward_name": data.ward_name,
            "admitted_at": datetime.utcnow().isoformat(),
            "discharge_status": "active",
        }
        if data.consultant_name:
            # store consultant in result_json or a dedicated column
            # result_json is JSONB, so we can store structured admission data
            pass

        result = sb.table("route_tasks").update(update_data).eq("id", data.task_id).execute()
        if not result.data:
            raise HTTPException(404, "Route task not found")

        return {
            "message": "Patient admitted successfully",
            "task_id": data.task_id,
            "admitted_at": update_data["admitted_at"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to admit patient: {str(e)}")


@router.get("/admitted-patients")
async def get_admitted_patients(hospital_name: Optional[str] = None):
    sb = get_supabase()
    if not sb:
        return {"patients": []}

    try:
        query = sb.table("route_tasks").select("*").eq("discharge_status", "active").order("admitted_at", desc=True, nullsfirst=False)
        if hospital_name:
            query = query.eq("hospital_name", hospital_name)
        result = query.execute()
        return {"patients": result.data}
    except Exception as e:
        return {"patients": [], "error": str(e)}


@router.get("/admitted-patients/all")
async def get_all_admitted_patients(hospital_name: Optional[str] = None):
    """Get all patients with any discharge status (active, discharged, transferred)."""
    sb = get_supabase()
    if not sb:
        return {"patients": []}

    try:
        query = sb.table("route_tasks").select("*").order("created_at", desc=True)
        if hospital_name:
            query = query.eq("hospital_name", hospital_name)
        result = query.execute()
        return {"patients": result.data}
    except Exception as e:
        return {"patients": [], "error": str(e)}


@router.put("/discharge-patient/{task_id}")
async def discharge_patient(task_id: str):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        result = sb.table("route_tasks").update({
            "discharge_status": "discharged",
        }).eq("id", task_id).execute()
        if not result.data:
            raise HTTPException(404, "Route task not found")
        return {"message": "Patient discharged", "task_id": task_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to discharge patient: {str(e)}")


@router.post("/doctor-notes")
async def add_doctor_note(data: DoctorNoteCreate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        result = sb.table("patient_doctor_notes").insert({
            "task_id": data.task_id,
            "doctor_name": data.doctor_name,
            "note_type": data.note_type,
            "note_text": data.note_text,
        }).execute()
        return {"id": result.data[0]["id"], "message": "Note added"}
    except Exception as e:
        raise HTTPException(500, f"Failed to add note: {str(e)}")


@router.get("/doctor-notes/{task_id}")
async def get_doctor_notes(task_id: str):
    sb = get_supabase()
    if not sb:
        return {"notes": []}

    try:
        result = sb.table("patient_doctor_notes").select("*").eq("task_id", task_id).order("created_at", desc=True).execute()
        return {"notes": result.data}
    except Exception as e:
        return {"notes": [], "error": str(e)}


@router.delete("/doctor-notes/{note_id}")
async def delete_doctor_note(note_id: str):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        result = sb.table("patient_doctor_notes").delete().eq("id", note_id).execute()
        if not result.data:
            raise HTTPException(404, "Note not found")
        return {"message": "Note deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to delete note: {str(e)}")


@router.post("/patient-transfers")
async def create_patient_transfer(data: PatientTransferCreate):
    sb = get_supabase()
    if not sb:
        raise HTTPException(503, "Database not configured")

    try:
        # Get current ward/bed info before updating
        current = sb.table("route_tasks").select("ward_name").eq("id", data.task_id).execute()
        from_ward = current.data[0].get("ward_name") if current.data else None

        # Create transfer record
        result = sb.table("patient_transfers").insert({
            "task_id": data.task_id,
            "from_ward": from_ward,
            "from_bed": None,
            "to_ward": data.to_ward,
            "to_bed": data.to_bed,
            "reason": data.reason,
            "transferred_by": data.transferred_by,
        }).execute()

        # Update route_tasks with new ward
        sb.table("route_tasks").update({
            "ward_name": data.to_ward,
        }).eq("id", data.task_id).execute()

        return {"id": result.data[0]["id"], "message": "Transfer recorded"}
    except Exception as e:
        raise HTTPException(500, f"Failed to create transfer: {str(e)}")


@router.get("/patient-transfers/{task_id}")
async def get_patient_transfers(task_id: str):
    sb = get_supabase()
    if not sb:
        return {"transfers": []}

    try:
        result = sb.table("patient_transfers").select("*").eq("task_id", task_id).order("transferred_at", desc=True).execute()
        return {"transfers": result.data}
    except Exception as e:
        return {"transfers": [], "error": str(e)}
