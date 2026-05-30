from fastapi import APIRouter, HTTPException, Query
import uuid
import json
import re
import os
import sys
import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx
import websockets

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app.config import settings
    DXGPT_API_URL = settings.DXGPT_API_URL
    DXGPT_KEY = settings.DXGPT_API_KEY
    SUPABASE_URL = settings.SUPABASE_URL
    SUPABASE_KEY = settings.SUPABASE_KEY
except ImportError:
    DXGPT_API_URL = os.getenv("DXGPT_API_URL", "")
    DXGPT_KEY = os.getenv("DXGPT_API_KEY", "")
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

DXGPT_API_BASE = DXGPT_API_URL.removesuffix("/diagnose").removesuffix("/")
DXGPT_DIAGNOSE_URL = DXGPT_API_BASE + "/diagnose" if DXGPT_API_BASE else ""
DXGPT_NEGOTIATE_URL = DXGPT_API_BASE + "/pubsub/negotiate" if DXGPT_API_BASE else ""

router = APIRouter(tags=["dxgpt"])

ai_progress_store: dict[str, float] = {}

# Local fallback diagnosis rules
LOCAL_SYMPTOM_DB = {
    "chest pain": {
        "diagnoses": [
            {"disease": "Acute Coronary Syndrome", "probability": "45%", "description": "Chest pain with potential cardiac involvement. Check ECG, troponin."},
            {"disease": "Gastroesophageal Reflux Disease", "probability": "25%", "description": "Burning chest pain, often after meals or lying down."},
            {"disease": "Costochondritis", "probability": "15%", "description": "Chest wall tenderness, reproducible on palpation."},
            {"disease": "Anxiety/Panic Attack", "probability": "10%", "description": "Chest tightness with palpitations, hyperventilation."},
            {"disease": "Pulmonary Embolism", "probability": "5%", "description": "Sudden chest pain with dyspnea, risk factors for DVT."},
        ],
        "tests": ["ECG", "Troponin I/T", "Chest X-ray", "D-dimer"],
    },
    "headache": {
        "diagnoses": [
            {"disease": "Migraine", "probability": "35%", "description": "Unilateral throbbing headache with nausea, photophobia."},
            {"disease": "Tension Headache", "probability": "30%", "description": "Bilateral pressing/tightening quality, mild to moderate."},
            {"disease": "Sinusitis", "probability": "15%", "description": "Facial pain, nasal congestion, worse on bending."},
            {"disease": "Hypertension", "probability": "10%", "description": "Occipital headache, elevated BP reading."},
            {"disease": "Cluster Headache", "probability": "10%", "description": "Severe unilateral orbital pain with autonomic features."},
        ],
        "tests": ["BP measurement", "CT Head (if red flags)", "Fundoscopy"],
    },
    "fever": {
        "diagnoses": [
            {"disease": "Viral Upper Respiratory Infection", "probability": "40%", "description": "Fever with cough, sore throat, rhinorrhea."},
            {"disease": "Urinary Tract Infection", "probability": "20%", "description": "Fever with dysuria, frequency, urgency."},
            {"disease": "Dengue", "probability": "15%", "description": "High fever with myalgia, retro-orbital pain, rash."},
            {"disease": "Malaria", "probability": "10%", "description": "Cyclic fever with chills, rigors."},
            {"disease": "Pneumonia", "probability": "10%", "description": "Fever with cough, sputum production, breathlessness."},
        ],
        "tests": ["CBC", "Blood Culture", "Urinalysis", "Malaria Smear", "Dengue NS1"],
    },
    "shortness of breath": {
        "diagnoses": [
            {"disease": "Asthma", "probability": "30%", "description": "Wheezing, breathlessness, chest tightness, worse at night."},
            {"disease": "COPD Exacerbation", "probability": "25%", "description": "Increased dyspnea, cough, sputum in smoker."},
            {"disease": "Pneumonia", "probability": "20%", "description": "Fever, cough, productive sputum, consolidation."},
            {"disease": "Heart Failure", "probability": "15%", "description": "Orthopnea, PND, pedal edema, raised JVP."},
            {"disease": "Pulmonary Embolism", "probability": "10%", "description": "Sudden onset, pleuritic chest pain, hypoxia."},
        ],
        "tests": ["Chest X-ray", "ECG", "ABG", "BNP", "D-dimer"],
    },
    "abdominal pain": {
        "diagnoses": [
            {"disease": "Acute Gastroenteritis", "probability": "30%", "description": "Diffuse abdominal pain with diarrhea, vomiting."},
            {"disease": "Appendicitis", "probability": "20%", "description": "RLQ pain, guarding, rebound tenderness, anorexia."},
            {"disease": "Peptic Ulcer Disease", "probability": "15%", "description": "Epigastric pain, relation to meals, NSAID use."},
            {"disease": "Cholecystitis", "probability": "15%", "description": "RUQ pain, Murphy's sign, fatty meal intolerance."},
            {"disease": "Renal Colic", "probability": "10%", "description": "Flank pain radiating to groin, hematuria."},
        ],
        "tests": ["Ultrasound Abdomen", "CBC", "LFT", "Urinalysis", "Amylase"],
    },
    "cough": {
        "diagnoses": [
            {"disease": "Upper Respiratory Tract Infection", "probability": "35%", "description": "Cough with sore throat, coryza, low-grade fever."},
            {"disease": "Bronchitis", "probability": "25%", "description": "Productive cough, chest congestion, low-grade fever."},
            {"disease": "Pneumonia", "probability": "15%", "description": "Cough with high fever, dyspnea, consolidation signs."},
            {"disease": "Post-nasal Drip", "probability": "15%", "description": "Chronic cough, sensation of something in throat."},
            {"disease": "Tuberculosis", "probability": "10%", "description": "Chronic cough >3 weeks, night sweats, weight loss."},
        ],
        "tests": ["Chest X-ray", "CBC", "Sputum AFB", "CRP"],
    },
    "dizziness": {
        "diagnoses": [
            {"disease": "Benign Paroxysmal Positional Vertigo", "probability": "30%", "description": "Positional vertigo lasting <1 minute, positive Dix-Hallpike."},
            {"disease": "Anemia", "probability": "20%", "description": "Fatigue, pallor, dizziness on standing."},
            {"disease": "Hypotension", "probability": "20%", "description": "Dizziness on standing, low BP readings."},
            {"disease": "Vestibular Neuritis", "probability": "15%", "description": "Acute onset vertigo, nystagmus, no hearing loss."},
            {"disease": "Cardiac Arrhythmia", "probability": "10%", "description": "Palpitations, presyncope, irregular pulse."},
        ],
        "tests": ["CBC", "ECG", "BP lying/standing", "Dix-Hallpike maneuver"],
    },
}

# Local diet suggestions mapped to diagnoses
LOCAL_DIET_DB = {
    "Acute Coronary Syndrome": {"diet_name": "Heart-Healthy Diet", "diet_type": "Heart", "foods": "Oats, whole grains, berries, leafy greens, fatty fish, nuts, olive oil", "instructions": "Avoid saturated fats, trans fats, high-sodium foods, and processed meats. Limit caffeine. Small frequent meals."},
    "Gastroesophageal Reflux Disease": {"diet_name": "GERD Management Diet", "diet_type": "General", "foods": "Bananas, melons, oatmeal, whole grains, lean poultry, fish, green vegetables", "instructions": "Avoid spicy, fried, acidic foods. No citrus, tomatoes, chocolate, caffeine, or alcohol. Eat small meals. Don't lie down after eating."},
    "Costochondritis": {"diet_name": "Anti-Inflammatory Diet", "diet_type": "General", "foods": "Turmeric, ginger, berries, leafy greens, fatty fish, nuts, seeds", "instructions": "Avoid processed foods and refined sugars. Include omega-3 rich foods. Stay hydrated."},
    "Migraine": {"diet_name": "Migraine Management Diet", "diet_type": "General", "foods": "Leafy greens, almonds, fatty fish, magnesium-rich foods, ginger tea", "instructions": "Avoid trigger foods: aged cheese, chocolate, caffeine, alcohol, artificial sweeteners, processed meats. Eat regular meals, don't skip."},
    "Tension Headache": {"diet_name": "Balanced Stress-Reduction Diet", "diet_type": "General", "foods": "Complex carbohydrates, green tea, dark chocolate (moderate), magnesium-rich foods", "instructions": "Stay hydrated. Limit caffeine. Eat regular meals to maintain blood sugar. Avoid skipping breakfast."},
    "Sinusitis": {"diet_name": "Sinus Relief Diet", "diet_type": "General", "foods": "Warm soups, ginger tea, turmeric milk, garlic, onions, citrus fruits, pineapple", "instructions": "Avoid dairy if it thickens mucus. Stay well hydrated. Avoid spicy foods if they worsen symptoms."},
    "Hypertension": {"diet_name": "DASH Diet", "diet_type": "Low Salt", "foods": "Fruits, vegetables, whole grains, low-fat dairy, lean protein, nuts, seeds", "instructions": "Strictly limit sodium to <1500mg/day. Avoid processed foods, canned foods, pickles. Limit alcohol. Increase potassium intake."},
    "Viral Upper Respiratory Infection": {"diet_name": "Immune-Boosting Recovery Diet", "diet_type": "General", "foods": "Warm soups, ginger tea, honey, citrus fruits, garlic, turmeric milk, bone broth", "instructions": "Stay well hydrated. Eat light, easy-to-digest foods. Avoid cold beverages and dairy if congested. Rest."},
    "Urinary Tract Infection": {"diet_name": "UTI Prevention Diet", "diet_type": "General", "foods": "Cranberry juice, blueberries, vitamin C-rich foods, yogurt, probiotics, plenty of water", "instructions": "Avoid caffeine, alcohol, spicy foods, and artificial sweeteners. Drink plenty of water. Include probiotic foods."},
    "Dengue": {"diet_name": "Dengue Recovery Diet", "diet_type": "General", "foods": "Papaya leaf juice, coconut water, pomegranate, kiwi, orange juice, vegetable soup, porridge", "instructions": "Avoid dark-colored foods that may mimic GI bleeding. Stay hydrated with ORS and fluids. Eat small frequent meals. Avoid oily/spicy foods."},
    "Malaria": {"diet_name": "Malaria Recovery Diet", "diet_type": "General", "foods": "High-protein foods, lentils, rice, bananas, coconut water, citrus fruits, green leafy vegetables", "instructions": "Stay hydrated. Eat frequent small meals. Avoid oily, fried foods. Include iron-rich foods."},
    "Asthma": {"diet_name": "Asthma Management Diet", "diet_type": "General", "foods": "Fruits rich in vitamin C, leafy greens, fatty fish, ginger, turmeric, nuts, seeds", "instructions": "Avoid sulfites (dried fruits, wine), processed foods, and known food allergens. Eat anti-inflammatory foods."},
    "COPD Exacerbation": {"diet_name": "COPD Support Diet", "diet_type": "General", "foods": "High-protein foods, eggs, lean meat, lentils, whole grains, fruits, vegetables", "instructions": "Eat small frequent meals to avoid bloating. Avoid gas-producing foods. Stay hydrated. Limit salt."},
    "Pneumonia": {"diet_name": "Pneumonia Recovery Diet", "diet_type": "General", "foods": "Warm soups, protein-rich foods, eggs, yogurt, fruits, green vegetables, honey, ginger", "instructions": "Stay well hydrated. Eat small frequent meals. Avoid cold foods and dairy products. Include zinc-rich foods."},
    "Heart Failure": {"diet_name": "Heart Failure Diet", "diet_type": "Heart", "foods": "Fresh fruits, vegetables, lean protein, whole grains, low-fat dairy", "instructions": "Strictly limit sodium to <1500mg/day. Limit fluid intake as advised. Avoid alcohol. Monitor weight daily."},
    "Pulmonary Embolism": {"diet_name": "Heart-Healthy Diet", "diet_type": "Heart", "foods": "Oats, berries, leafy greens, fatty fish, nuts, olive oil, garlic", "instructions": "Avoid vitamin K-rich foods in excess if on warfarin. Stay hydrated. Limit salt. Avoid prolonged sitting."},
    "Acute Gastroenteritis": {"diet_name": "BRAT Diet", "diet_type": "General", "foods": "Bananas, rice, applesauce, toast, clear soups, oral rehydration solution", "instructions": "Avoid dairy, fatty foods, spicy foods, caffeine, and alcohol. Stay hydrated with ORS. Introduce foods gradually."},
    "Appendicitis": {"diet_name": "Post-Appendectomy Diet", "diet_type": "General", "foods": "Clear liquids, bland foods, toast, rice, boiled vegetables, yogurt", "instructions": "Start with clear liquids. Gradually add soft foods. Avoid gas-producing foods, spicy, and fatty foods."},
    "Peptic Ulcer Disease": {"diet_name": "Ulcer-Friendly Diet", "diet_type": "General", "foods": "Bananas, oatmeal, whole grains, lean poultry, fish, yogurt, cabbage juice", "instructions": "Avoid spicy foods, caffeine, alcohol, citrus, tomatoes, and NSAIDs. Eat small frequent meals."},
    "Cholecystitis": {"diet_name": "Gallbladder-Friendly Diet", "diet_type": "Low Salt", "foods": "Lean protein, fish, vegetables, fruits, whole grains, low-fat dairy", "instructions": "Strictly avoid fried, fatty, and oily foods. Eat small frequent meals. Avoid gas-producing vegetables."},
    "Renal Colic": {"diet_name": "Kidney Stone Prevention Diet", "diet_type": "General", "foods": "Lemon water, citrus fruits, watermelon, cucumber, berries, low-oxalate vegetables", "instructions": "Drink plenty of water (2-3L/day). Limit salt, animal protein, oxalate-rich foods (spinach, beets, nuts). Avoid soda."},
    "Upper Respiratory Tract Infection": {"diet_name": "Cold Recovery Diet", "diet_type": "General", "foods": "Warm soups, honey, ginger tea, garlic, citrus fruits, chicken soup, turmeric milk", "instructions": "Stay hydrated. Eat warm, soothing foods. Get plenty of rest. Avoid cold beverages."},
    "Bronchitis": {"diet_name": "Bronchitis Recovery Diet", "diet_type": "General", "foods": "Warm soups, ginger tea, honey, turmeric milk, garlic, fruits rich in vitamin C", "instructions": "Stay hydrated. Avoid dairy if it increases mucus. Avoid cold drinks. Eat anti-inflammatory foods."},
    "Post-nasal Drip": {"diet_name": "Mucus-Reduction Diet", "diet_type": "General", "foods": "Ginger tea, warm lemon water, turmeric, garlic, onion, spicy foods (if tolerated)", "instructions": "Stay hydrated. Limit dairy products. Avoid caffeine and alcohol. Use steam inhalation."},
    "Tuberculosis": {"diet_name": "TB Recovery Diet", "diet_type": "Weight Gain", "foods": "High-protein foods, eggs, milk, lentils, nuts, bananas, ghee, whole grains, fruits", "instructions": "Eat calorie-dense, nutrient-rich foods. Small frequent meals. Include iron and vitamin-rich foods. Stay hydrated."},
    "Benign Paroxysmal Positional Vertigo": {"diet_name": "Balance-Support Diet", "diet_type": "General", "foods": "Ginger tea, almonds, vitamin D-rich foods, leafy greens, bananas", "instructions": "Stay hydrated. Limit salt, caffeine, and alcohol. Avoid sudden head movements."},
    "Anemia": {"diet_name": "Iron-Boosting Diet", "diet_type": "General", "foods": "Spinach, lentils, red meat, beans, fortified cereals, citrus fruits, nuts, seeds", "instructions": "Pair iron-rich foods with vitamin C (citrus) for absorption. Avoid tea/coffee with meals. Include folate and B12 rich foods."},
    "Hypotension": {"diet_name": "BP-Stabilizing Diet", "diet_type": "Low Salt", "foods": "Salty foods (in moderation), plenty of fluids, small frequent meals, electrolyte-rich drinks", "instructions": "Increase fluid intake. Add moderate salt to meals. Avoid large heavy meals. Include caffeine if not contraindicated."},
    "Vestibular Neuritis": {"diet_name": "Vestibular Support Diet", "diet_type": "General", "foods": "Ginger, almonds, vitamin D-rich foods, bananas, leafy greens", "instructions": "Stay hydrated. Limit salt, caffeine, and alcohol. Avoid triggers. Small frequent meals."},
    "Cardiac Arrhythmia": {"diet_name": "Heart-Healthy Diet", "diet_type": "Heart", "foods": "Magnesium-rich foods (bananas, spinach, nuts), potassium-rich foods, whole grains, fatty fish", "instructions": "Limit caffeine and alcohol. Avoid energy drinks. Stay hydrated. Limit sodium. Avoid large heavy meals."},
}

# Drug interaction database
DRUG_INTERACTIONS = {
    ("Warfarin", "Aspirin"): {"severity": "major", "effect": "Increased risk of bleeding. Monitor INR closely."},
    ("Warfarin", "Ibuprofen"): {"severity": "major", "effect": "Increased bleeding risk. Avoid combination if possible."},
    ("Warfarin", "Metronidazole"): {"severity": "major", "effect": "Enhanced anticoagulant effect. Reduce warfarin dose."},
    ("Warfarin", "Amiodarone"): {"severity": "major", "effect": "Increased INR. Reduce warfarin dose by 30-50%."},
    ("Aspirin", "Ibuprofen"): {"severity": "moderate", "effect": "Increased GI bleeding risk. Use with PPI."},
    ("Aspirin", "Clopidogrel"): {"severity": "major", "effect": "Significantly increased bleeding risk."},
    ("Aspirin", "Methotrexate"): {"severity": "major", "effect": "Decreased methotrexate clearance. Avoid."},
    ("ACE Inhibitors", "Potassium Supplements"): {"severity": "moderate", "effect": "Risk of hyperkalemia. Monitor K+ levels."},
    ("ACE Inhibitors", "NSAIDs"): {"severity": "moderate", "effect": "Reduced antihypertensive effect, risk of renal impairment."},
    ("Metformin", "Contrast Dye"): {"severity": "moderate", "effect": "Risk of lactic acidosis. Withhold metformin 48hr before."},
    ("Metformin", "Alcohol"): {"severity": "moderate", "effect": "Increased risk of lactic acidosis. Limit alcohol intake."},
    ("Statins", "Azole Antifungals"): {"severity": "major", "effect": "Increased risk of myopathy/rhabdomyolysis."},
    ("Statins", "Macrolide Antibiotics"): {"severity": "moderate", "effect": "Increased statin levels, myopathy risk."},
    ("Statins", "Amiodarone"): {"severity": "moderate", "effect": "Increased risk of myopathy/rhabdomyolysis."},
    ("Digoxin", "Amiodarone"): {"severity": "major", "effect": "Increased digoxin levels. Reduce digoxin dose by 50%."},
    ("Digoxin", "Verapamil"): {"severity": "major", "effect": "Increased digoxin levels. Monitor levels closely."},
    ("Digoxin", "Furosemide"): {"severity": "moderate", "effect": "Hypokalemia increases digoxin toxicity risk."},
    ("SSRIs", "MAOIs"): {"severity": "major", "effect": "Risk of serotonin syndrome. 14-day washout required."},
    ("SSRIs", "Triptans"): {"severity": "moderate", "effect": "Risk of serotonin syndrome. Monitor for symptoms."},
    ("SSRIs", "NSAIDs"): {"severity": "moderate", "effect": "Increased risk of GI bleeding."},
    ("Theophylline", "Ciprofloxacin"): {"severity": "major", "effect": "Increased theophylline levels, seizure risk."},
    ("Phenytoin", "Fluconazole"): {"severity": "major", "effect": "Increased phenytoin levels. Monitor levels."},
    ("Lithium", "NSAIDs"): {"severity": "major", "effect": "Increased lithium levels, toxicity risk."},
    ("Lithium", "Furosemide"): {"severity": "major", "effect": "Increased lithium levels, toxicity risk."},
    ("Doxycycline", "Antacids"): {"severity": "moderate", "effect": "Reduced doxycycline absorption. Separate by 2-3 hours."},
    ("Ciprofloxacin", "Antacids"): {"severity": "moderate", "effect": "Reduced absorption. Separate by 4 hours."},
    ("Levothyroxine", "Calcium"): {"severity": "moderate", "effect": "Reduced levothyroxine absorption. Separate by 4 hours."},
    ("Levothyroxine", "Iron"): {"severity": "moderate", "effect": "Reduced levothyroxine absorption. Separate by 4 hours."},
}


@router.get("/progress/{prescription_id}")
async def get_ai_progress(prescription_id: str):
    pct = ai_progress_store.get(prescription_id, 0)
    return {"prescription_id": prescription_id, "progress": pct}

try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception:
    supabase = None


def fetch_patient_history(patient_name: str, current_prescription_id: str) -> list[dict]:
    if not supabase or not patient_name:
        return []
    try:
        result = supabase.table("doctor_prescriptions").select(
            "id, chief_complaint, diagnosis, ai_diagnosis, existing_diseases, allergies, past_medications, created_at"
        ).eq("patient_name", patient_name).neq("id", current_prescription_id).order("created_at", desc=True).limit(5).execute()
        return result.data or []
    except Exception:
        return []


def build_prompt_from_prescription(p: dict) -> str:
    parts = []
    if p.get("chief_complaint"):
        parts.append(f"Chief Complaint: {p['chief_complaint']}")
    if p.get("symptoms"):
        parts.append(f"Symptoms: {p['symptoms']}")
    if p.get("duration"):
        parts.append(f"Duration: {p['duration']}")
    if p.get("severity_level") is not None:
        parts.append(f"Severity: {p['severity_level']}/10")
    if p.get("pain_score") is not None:
        parts.append(f"Pain Score: {p['pain_score']}/10")

    vitals = []
    if p.get("temperature") is not None:
        vitals.append(f"Temp: {p['temperature']}C")
    if p.get("bp_systolic") is not None and p.get("bp_diastolic") is not None:
        vitals.append(f"BP: {p['bp_systolic']}/{p['bp_diastolic']}")
    if p.get("pulse") is not None:
        vitals.append(f"Pulse: {p['pulse']} bpm")
    if p.get("spo2") is not None:
        vitals.append(f"SpO2: {p['spo2']}%")
    if p.get("respiratory_rate") is not None:
        vitals.append(f"RR: {p['respiratory_rate']}/min")
    if p.get("blood_sugar") is not None:
        vitals.append(f"Blood Sugar: {p['blood_sugar']} mg/dL")
    if vitals:
        parts.append(f"Vitals: {' | '.join(vitals)}")

    history = []
    if p.get("existing_diseases"):
        diseases = p["existing_diseases"]
        if isinstance(diseases, list):
            diseases = ", ".join(diseases)
        history.append(f"Existing Diseases: {diseases}")
    if p.get("allergies"):
        history.append(f"Allergies: {p['allergies']}")
    if p.get("smoking_history") and p["smoking_history"] != "Never":
        history.append(f"Smoking: {p['smoking_history']}")
    if p.get("alcohol_history") and p["alcohol_history"] != "Never":
        history.append(f"Alcohol: {p['alcohol_history']}")
    if p.get("past_medications"):
        history.append(f"Past Medications: {p['past_medications']}")
    if p.get("current_medications"):
        history.append(f"Current Medications: {p['current_medications']}")

    # Add patient's previous visit history
    patient_name = p.get("patient_name", p.get("patientName", ""))
    prescription_id = p.get("id", "")
    if patient_name and prescription_id:
        past_visits = fetch_patient_history(patient_name, str(prescription_id))
        if past_visits:
            visit_summaries = []
            for v in past_visits:
                summary_parts = []
                summary_parts.append(f"Date: {v.get('created_at', '')[:10]}")
                if v.get("chief_complaint"):
                    summary_parts.append(f"Complaint: {v['chief_complaint']}")
                if v.get("diagnosis"):
                    summary_parts.append(f"Diag: {v['diagnosis']}")
                if v.get("ai_diagnosis"):
                    summary_parts.append(f"AI: {v['ai_diagnosis']}")
                if summary_parts:
                    visit_summaries.append(" | ".join(summary_parts))
            if visit_summaries:
                history.append("Previous Visits: " + " || ".join(visit_summaries))

    if history:
        parts.append(f"History: {' | '.join(history)}")

    if p.get("symptom_notes"):
        parts.append(f"Additional Notes: {p['symptom_notes']}")

    return "\n".join(parts)


STOP_WORDS = {"a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "and", "or", "is", "was", "it"}

def local_fallback_diagnose(prompt_text: str) -> dict:
    """Rule-based fallback diagnosis when DxGPT API is unavailable."""
    prompt_lower = prompt_text.lower()

    # Score each diagnosis category
    scores: dict[str, float] = {}
    for symptom_key, data in LOCAL_SYMPTOM_DB.items():
        score = 0
        if symptom_key in prompt_lower:
            score += 10
        for keyword in symptom_key.split():
            if keyword in STOP_WORDS:
                continue
            if keyword in prompt_lower:
                score += 1
        if "fever" in symptom_key and any(kw in prompt_lower for kw in ["temp:", "temperature", "38", "39", "40"]):
            score += 5
        if "shortness of breath" in symptom_key and any(kw in prompt_lower for kw in ["spo2", "oxygen", "breathless", "dyspnea"]):
            score += 5
        if "chest pain" in symptom_key and any(kw in prompt_lower for kw in ["bp:", "ecg", "cardiac", "heart"]):
            score += 5
        if score > 0:
            scores[symptom_key] = score

    if not scores:
        return {
            "primary_diagnosis": "Undifferentiated symptoms",
            "differential_diagnoses": [],
            "predicted_diseases": [],
            "suggested_tests": ["CBC", "Comprehensive Metabolic Panel", "Chest X-ray"],
            "ai_notes": "Symptoms did not match local diagnosis database. Suggest comprehensive workup.",
            "source": "local_fallback",
            "suggested_diet": None
        }

    # When tied, prefer the match whose exact key appears in the Chief Complaint
    max_score = max(scores.values())
    tied = [k for k, v in scores.items() if v == max_score]
    if len(tied) > 1:
        chief_complaint_section = ""
        if "chief complaint:" in prompt_lower:
            cc_start = prompt_lower.index("chief complaint:") + len("chief complaint:")
            cc_end = prompt_lower.index("\n", cc_start) if "\n" in prompt_lower[cc_start:] else len(prompt_lower)
            chief_complaint_section = prompt_lower[cc_start:cc_end]
        cc_matches = [k for k in tied if k in chief_complaint_section] if chief_complaint_section else []
        if cc_matches:
            best_match = cc_matches[0]
        else:
            exact_matches = [k for k in tied if k in prompt_lower]
            best_match = exact_matches[0] if exact_matches else tied[0]
    else:
        best_match = max(scores, key=scores.get)
    best_data = LOCAL_SYMPTOM_DB[best_match]

    # Build predicted_diseases
    predicted = []
    for d in best_data["diagnoses"]:
        predicted.append({
            "disease": d["disease"],
            "probability": d["probability"],
            "description": d["description"],
            "symptoms_in_common": [best_match],
            "symptoms_not_in_common": []
        })

    return {
        "primary_diagnosis": predicted[0]["disease"],
        "differential_diagnoses": [d["disease"] for d in best_data["diagnoses"]],
        "predicted_diseases": predicted,
        "suggested_tests": best_data["tests"],
        "ai_notes": f"Local fallback diagnosis based on symptom: '{best_match}'. Rule-based analysis, not AI-generated. Consult specialist for confirmation.",
        "source": "local_fallback",
        "suggested_diet": LOCAL_DIET_DB.get(predicted[0]["disease"])
    }


async def call_dxgpt(prompt_text: str, progress_key: str | None = None) -> dict:
    # Use local fallback if no API URL configured
    if not DXGPT_API_URL:
        if progress_key:
            ai_progress_store[progress_key] = 100
        return local_fallback_diagnose(prompt_text)

    myuuid = str(uuid.uuid4())

    def set_progress(pct: float):
        if progress_key:
            ai_progress_store[progress_key] = pct

    set_progress(5)
    headers = {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": DXGPT_KEY
    }

    async with httpx.AsyncClient(timeout=30) as client:
        neg_resp = await client.post(
            DXGPT_NEGOTIATE_URL,
            headers=headers,
            json={"myuuid": myuuid}
        )
        neg_resp.raise_for_status()
        neg_data = neg_resp.json()

    set_progress(15)
    ws_url = neg_data.get("url")
    if not ws_url:
        raise Exception(f"No WebSocket URL in negotiate response")

    set_progress(20)
    async def flow():
        async with websockets.connect(ws_url) as ws:
            set_progress(30)
            async with httpx.AsyncClient(timeout=120) as client:
                diag_resp = await client.post(
                    DXGPT_DIAGNOSE_URL,
                    headers=headers,
                    json={
                        "description": prompt_text,
                        "myuuid": myuuid,
                        "timezone": "Asia/Kolkata"
                    }
                )
                diag_resp.raise_for_status()

            set_progress(40)
            msg_count = 0
            async for message in ws:
                msg = json.loads(message)
                t = msg.get("type")
                msg_count += 1
                set_progress(min(40 + msg_count * 10, 90))
                if t in ("result", "complete"):
                    set_progress(100)
                    return msg
                elif t == "error":
                    raise Exception(msg.get("error", "Unknown WebSocket error"))

    try:
        result = await asyncio.wait_for(flow(), timeout=120)
        set_progress(100)
        return result
    except Exception:
        # Fallback to local on API failure
        if progress_key:
            ai_progress_store[progress_key] = 100
        return local_fallback_diagnose(prompt_text)


def _extract_diagnoses(dxgpt_json: dict) -> list:
    raw_list = []
    try:
        if dxgpt_json.get("type") in ("result", "complete") and dxgpt_json.get("status") == "success":
            inner = dxgpt_json.get("data", {})
            if isinstance(inner, dict):
                raw_list = inner.get("data", [])
        elif dxgpt_json.get("result") == "success":
            inner = dxgpt_json.get("data", {})
            if isinstance(inner, dict):
                raw_list = inner.get("data", [])
        if not raw_list:
            result_wrapper = dxgpt_json.get("result", {})
            if isinstance(result_wrapper, dict):
                inner = result_wrapper.get("data", {})
                if isinstance(inner, dict):
                    raw_list = inner.get("data", [])
        # Fallback: check for predicted_diseases array at any nesting level
        if not raw_list:
            for candidate in [dxgpt_json, dxgpt_json.get("data", {}), dxgpt_json.get("result", {})]:
                if isinstance(candidate, dict):
                    pd = candidate.get("predicted_diseases", [])
                    if pd and isinstance(pd, list):
                        raw_list = pd
                        break
    except Exception:
        pass
    return raw_list


def parse_dxgpt_response(dxgpt_json: dict) -> dict:
    diagnoses = []
    try:
        for d in _extract_diagnoses(dxgpt_json):
            diagnoses.append({
                "disease": d.get("diagnosis") or d.get("disease", ""),
                "description": d.get("description", ""),
                "symptoms_in_common": d.get("symptoms_in_common", []),
                "symptoms_not_in_common": d.get("symptoms_not_in_common", [])
            })
    except Exception:
        pass

    if not diagnoses:
        return {
            "primary_diagnosis": "AI diagnosis could not be parsed",
            "differential_diagnoses": [],
            "predicted_diseases": [],
            "suggested_tests": [],
            "ai_notes": "Raw: " + str(dxgpt_json)[:500]
        }

    primary = diagnoses[0]["disease"]
    differentials = diagnoses

    total = len(differentials)
    predictions = [
        {"disease": d["disease"], "probability": f"{round((total - i) / total * 100)}%"}
        for i, d in enumerate(differentials)
    ]

    suggested_tests = []
    test_keywords = ["test", "examination", "scan", "blood", "imaging", "MRI", "CT", "X-ray", "ECG", "EEG"]
    for d in diagnoses:
        desc = d.get("description", "")
        for kw in test_keywords:
            pattern = r'[^.]*\b' + re.escape(kw) + r'\b[^.]*\.'
            matches = re.findall(pattern, desc, re.IGNORECASE)
            for s in matches:
                s = s.strip()
                if s and s not in suggested_tests:
                    suggested_tests.append(s)

    notes_parts = []
    for d in diagnoses:
        common = d.get("symptoms_in_common", [])
        not_common = d.get("symptoms_not_in_common", [])
        if common:
            notes_parts.append(f"{d['disease']}: matches - {', '.join(common)}")
        if not_common:
            notes_parts.append(f"{d['disease']}: non-matching - {', '.join(not_common)}")

    merged_predictions = []
    for i, diff in enumerate(differentials):
        merged = dict(diff)
        prob = predictions[i]["probability"] if i < len(predictions) else "0%"
        merged["probability"] = prob
        merged_predictions.append(merged)

    # Look up diet suggestion from LOCAL_DIET_DB based on primary diagnosis
    suggested_diet = None
    if primary in LOCAL_DIET_DB:
        suggested_diet = LOCAL_DIET_DB[primary]
    elif merged_predictions:
        for pred in merged_predictions:
            disease = pred.get("disease", pred.get("disease_name", ""))
            if disease in LOCAL_DIET_DB:
                suggested_diet = LOCAL_DIET_DB[disease]
                break

    return {
        "primary_diagnosis": primary,
        "differential_diagnoses": differentials,
        "predicted_diseases": merged_predictions,
        "suggested_tests": suggested_tests[:10],
        "ai_notes": ("; ".join(notes_parts) if notes_parts else "DxGPT analysis completed.")[:500],
        "suggested_diet": suggested_diet
    }


@router.post("/diagnose/{prescription_id}")
async def diagnose_prescription(prescription_id: str):
    if not supabase:
        raise HTTPException(503, "Database not configured")

    try:
        result = supabase.table("doctor_prescriptions").select("*").eq("id", prescription_id).execute()
        if not result.data:
            raise HTTPException(404, "Prescription not found")
        prescription = result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch prescription: {e}")

    if prescription.get("ai_processed"):
        return {
            "message": "Already processed",
            "prescription_id": prescription_id,
            "ai_diagnosis": prescription.get("ai_diagnosis"),
            "ai_disease_predictions": prescription.get("ai_disease_predictions"),
            "ai_suggested_tests": prescription.get("ai_suggested_tests"),
            "ai_suggested_diet": prescription.get("ai_suggested_diet")
        }

    prompt = build_prompt_from_prescription(prescription)

    ai_progress_store[prescription_id] = 0
    try:
        dxgpt_result = await call_dxgpt(prompt, progress_key=prescription_id)
        parsed = parse_dxgpt_response(dxgpt_result)
    except Exception as e:
        ai_progress_store[prescription_id] = 0
        parsed = {
            "primary_diagnosis": f"AI service unavailable: {str(e)[:200]}",
            "differential_diagnoses": [],
            "predicted_diseases": [],
            "suggested_tests": [],
            "ai_notes": "DxGPT API call failed. Diagnosis could not be generated."
        }

    ai_diagnosis = parsed.get("primary_diagnosis", "")
    ai_disease_predictions = parsed.get("predicted_diseases", [])
    ai_suggested_tests = parsed.get("suggested_tests", [])
    ai_notes = parsed.get("ai_notes", "")
    ai_suggested_diet = parsed.get("suggested_diet")

    try:
        supabase.table("doctor_prescriptions").update({
            "ai_diagnosis": ai_diagnosis,
            "ai_disease_predictions": ai_disease_predictions,
            "ai_suggested_tests": ai_suggested_tests,
            "ai_notes": ai_notes,
            "ai_suggested_diet": ai_suggested_diet,
            "ai_processed": True,
            "ai_processed_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", prescription_id).execute()
    except Exception as e:
        print(f"Warning: Failed to save AI results to DB: {e}")

    return {
        "message": "AI diagnosis complete",
        "prescription_id": prescription_id,
        "ai_diagnosis": ai_diagnosis,
        "ai_disease_predictions": ai_disease_predictions,
        "ai_suggested_tests": ai_suggested_tests,
        "ai_notes": ai_notes,
        "ai_suggested_diet": ai_suggested_diet
    }


@router.post("/drug-interaction")
async def check_drug_interaction(drug_a: str = Query(..., description="First drug name"),
                                  drug_b: str = Query(..., description="Second drug name")):
    drug_a_clean = drug_a.strip().lower()
    drug_b_clean = drug_b.strip().lower()

    # Normalize drug names
    def normalize(name: str) -> str:
        name_map = {
            "ace": "ACE Inhibitors",
            "acei": "ACE Inhibitors",
            "nsaid": "NSAIDs",
            "ssri": "SSRIs",
            "maoi": "MAOIs",
            "triptan": "Triptans",
            "statin": "Statins",
            "macrolide": "Macrolide Antibiotics",
        }
        return name_map.get(name, name.title())

    drug_a_norm = normalize(drug_a_clean)
    drug_b_norm = normalize(drug_b_clean)

    # Check both orderings
    interaction = DRUG_INTERACTIONS.get((drug_a_norm, drug_b_norm))
    if not interaction:
        interaction = DRUG_INTERACTIONS.get((drug_b_norm, drug_a_norm))

    if interaction:
        return {
            "drug_a": drug_a,
            "drug_b": drug_b,
            "severity": interaction["severity"],
            "effect": interaction["effect"],
            "interaction_found": True,
        }

    return {
        "drug_a": drug_a,
        "drug_b": drug_b,
        "interaction_found": False,
        "severity": "none",
        "effect": "No known interaction in local database. Verify with clinical reference.",
    }


@router.get("/prescription-history/{patient_name}")
async def get_prescription_history(patient_name: str, limit: int = Query(5, ge=1, le=20)):
    if not supabase or not patient_name:
        return {"history": []}
    try:
        result = supabase.table("doctor_prescriptions").select(
            "id, chief_complaint, diagnosis, ai_diagnosis, existing_diseases, allergies, past_medications, created_at"
        ).eq("patient_name", patient_name).order("created_at", desc=True).limit(limit).execute()
        return {"history": result.data or []}
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch history: {e}")


@router.post("/diagnose-local")
async def diagnose_local(
    symptoms: str = Query(..., description="Patient symptoms description"),
    vitals: Optional[str] = Query(None, description="Vital signs summary"),
    history: Optional[str] = Query(None, description="Patient medical history"),
):
    """Direct local fallback diagnosis without needing a prescription record."""
    prompt_parts = [f"Symptoms: {symptoms}"]
    if vitals:
        prompt_parts.append(f"Vitals: {vitals}")
    if history:
        prompt_parts.append(f"History: {history}")
    prompt_text = "\n".join(prompt_parts)

    result = local_fallback_diagnose(prompt_text)
    return {
        "message": "Local diagnosis complete",
        "source": "local_fallback",
        "primary_diagnosis": result["primary_diagnosis"],
        "differential_diagnoses": result["differential_diagnoses"],
        "predicted_diseases": result["predicted_diseases"],
        "suggested_tests": result["suggested_tests"],
        "ai_notes": result["ai_notes"],
        "suggested_diet": result.get("suggested_diet"),
    }
