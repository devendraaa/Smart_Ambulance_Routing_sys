from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import routes, hospitals, sensors, mqtt
from app.routers import hospitals_new
from app.routers import blood_banks
from app.tasks.worker import background_worker_thread

@asynccontextmanager
async def lifespan(app: FastAPI):
    background_worker_thread.start()
    yield


app = FastAPI(title="Smart Ambulance API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router, prefix="/api/route", tags=["routes"])
app.include_router(hospitals.router, prefix="/api/hospitals", tags=["hospitals"])
app.include_router(hospitals_new.router, prefix="/api/hospitals", tags=["hospitals"])
app.include_router(sensors.router, prefix="/api/sensors", tags=["sensors"])
app.include_router(mqtt.router, prefix="/api/mqtt", tags=["mqtt"])
app.include_router(blood_banks.router, prefix="/api/blood-banks", tags=["blood-banks"])

@app.get("/api/health")
async def health():
    return {"status": "ok"}
