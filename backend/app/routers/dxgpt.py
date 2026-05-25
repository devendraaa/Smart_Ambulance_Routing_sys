from fastapi import FastAPI
from pydantic import BaseModel
import requests
import uuid
import os

app = FastAPI()

DXGPT_API = os.getenv("DXGPT_API_URL")
DXGPT_KEY = os.getenv("DXGPT_API_KEY")


class PatientData(BaseModel):
    symptoms: str


@app.post("/diagnose")
def diagnose(data: PatientData):

    headers = {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": DXGPT_KEY
    }

    payload = {
        "description": data.symptoms,
        "myuuid": str(uuid.uuid4()),
        "timezone": "Asia/Kolkata",
        "model": "gpt4o"
    }

    response = requests.post(
        DXGPT_API,
        headers=headers,
        json=payload,
        timeout=60
    )

    return response.json()