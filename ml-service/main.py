
from fastapi import FastAPI

app = FastAPI(
    title="Smart Attendance ML Service",
    description="Machine learning service for attendance risk analysis",
    version="1.0.0",
)


@app.get("/health")
def health_check():
    return {
        "status": "success",
        "message": "Smart Attendance ML Service is running",
    }
