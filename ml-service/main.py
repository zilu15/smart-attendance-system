from typing import List, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model import predict_risk

app = FastAPI(
    title="AttendEase ML Risk Service",
    description="Attendance Risk Analysis and Dropout Prediction Engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StudentRiskRequest(BaseModel):
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    attended_sessions: int = Field(..., ge=0, description="Total sessions attended")
    total_sessions: int = Field(..., ge=1, description="Total sessions conducted")
    consecutive_absences: int = Field(0, ge=0, description="Recent consecutive absences")


class BatchRiskRequest(BaseModel):
    course_id: Optional[int] = None
    course_name: Optional[str] = None
    students: List[StudentRiskRequest]


@app.get("/health")
def health_check():
    return {
        "status": "success",
        "service": "AttendEase ML Risk Predictor",
        "model_loaded": True,
    }


@app.post("/predict-risk")
def predict_single(request: StudentRiskRequest):
    result = predict_risk(
        attended_sessions=request.attended_sessions,
        total_sessions=request.total_sessions,
        consecutive_absences=request.consecutive_absences,
    )
    if request.student_id is not None:
        result["student_id"] = request.student_id
    if request.student_name is not None:
        result["student_name"] = request.student_name
    return result


@app.post("/predict-batch")
def predict_batch(request: BatchRiskRequest):
    predictions = []
    high_risk_count = 0
    medium_risk_count = 0
    low_risk_count = 0

    for s in request.students:
        res = predict_risk(
            attended_sessions=s.attended_sessions,
            total_sessions=s.total_sessions,
            consecutive_absences=s.consecutive_absences,
        )
        if s.student_id is not None:
            res["student_id"] = s.student_id
        if s.student_name is not None:
            res["student_name"] = s.student_name

        if res["risk_level"] == "High Risk":
            high_risk_count += 1
        elif res["risk_level"] == "Medium Risk":
            medium_risk_count += 1
        else:
            low_risk_count += 1

        predictions.append(res)

    # Sort so highest risk students appear first
    risk_order = {"High Risk": 0, "Medium Risk": 1, "Low Risk": 2}
    predictions.sort(key=lambda x: (risk_order.get(x["risk_level"], 3), x["attendance_percentage"]))

    return {
        "course_id": request.course_id,
        "course_name": request.course_name,
        "total_evaluated": len(predictions),
        "high_risk_count": high_risk_count,
        "medium_risk_count": medium_risk_count,
        "low_risk_count": low_risk_count,
        "students": predictions,
    }
