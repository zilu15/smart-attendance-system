import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

MODEL_PATH = os.path.join(os.path.dirname(__file__), "attendance_risk_model.joblib")


def generate_training_data(n_samples=2500):
    """Generate synthetic historical student attendance patterns to train the classifier."""
    np.random.seed(42)

    total_sessions = np.random.randint(5, 50, size=n_samples)
    attended_ratio = np.random.beta(a=5, b=2, size=n_samples)  # skewed towards higher attendance
    attended_sessions = np.clip((total_sessions * attended_ratio).astype(int), 0, total_sessions)
    consecutive_absences = np.random.geometric(p=0.4, size=n_samples) - 1
    consecutive_absences = np.minimum(consecutive_absences, total_sessions - attended_sessions)

    percentages = (attended_sessions / np.maximum(total_sessions, 1)) * 100

    # Risk labeling logic:
    # High Risk: percentage < 65% or (percentage < 75% and consecutive_absences >= 2)
    # Medium Risk: 65% <= percentage < 75% or (75% <= percentage < 80% and consecutive_absences >= 3)
    # Low Risk: percentage >= 75% with stable streak
    labels = []
    for pct, streak in zip(percentages, consecutive_absences):
        if pct < 65.0 or (pct < 75.0 and streak >= 2):
            labels.append("High Risk")
        elif pct < 75.0 or (pct < 80.0 and streak >= 3):
            labels.append("Medium Risk")
        else:
            labels.append("Low Risk")

    X = pd.DataFrame({
        "current_percentage": percentages,
        "total_sessions": total_sessions,
        "attended_sessions": attended_sessions,
        "consecutive_absences": consecutive_absences,
    })

    y = np.array(labels)
    return X, y


def get_or_train_model():
    """Load existing model or train and save a new one."""
    if os.path.exists(MODEL_PATH):
        try:
            return joblib.load(MODEL_PATH)
        except Exception:
            pass

    X, y = generate_training_data()
    clf = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    clf.fit(X, y)
    joblib.dump(clf, MODEL_PATH)
    return clf


# Initialize the model at startup
model = get_or_train_model()


def calculate_advice(attended: int, total: int, target_pct: float = 75.0) -> str:
    """Calculate actionable attendance requirements to stay above target threshold."""
    if total <= 0:
        return "No classes recorded yet."

    current_pct = (attended / total) * 100.0

    if current_pct >= target_pct:
        # How many consecutive classes can the student miss before dropping below target_pct?
        # (attended) / (total + x) >= target_pct / 100
        # total + x <= attended / (target_pct / 100)
        max_skips = int((attended / (target_pct / 100.0)) - total)
        if max_skips <= 0:
            return "Attendance is right at the threshold. Avoid missing any upcoming lectures."
        return f"Safe. Student can miss at most {max_skips} upcoming class(es) without falling below {int(target_pct)}%."
    else:
        # How many consecutive classes must the student attend to recover?
        # (attended + y) / (total + y) >= target_pct / 100
        # (attended + y) >= 0.75 * total + 0.75 * y
        # 0.25 * y >= 0.75 * total - attended
        required = int(np.ceil(((target_pct / 100.0) * total - attended) / (1.0 - (target_pct / 100.0))))
        return f"Warning! Student must attend the next {max(1, required)} consecutive class(es) to recover to {int(target_pct)}%."


def predict_risk(attended_sessions: int, total_sessions: int, consecutive_absences: int = 0) -> dict:
    """Predict risk level and probability for a single student."""
    total = max(1, total_sessions)
    attended = min(total, max(0, attended_sessions))
    pct = round((attended / total) * 100.0, 2)

    X_in = pd.DataFrame([{
        "current_percentage": pct,
        "total_sessions": total,
        "attended_sessions": attended,
        "consecutive_absences": max(0, consecutive_absences),
    }])

    prediction = model.predict(X_in)[0]
    probs = model.predict_proba(X_in)[0]
    classes = list(model.classes_)
    confidence = round(float(probs[classes.index(prediction)]) * 100.0, 1)

    recommendation = calculate_advice(attended, total, target_pct=75.0)

    return {
        "attendance_percentage": pct,
        "total_sessions": total,
        "attended_sessions": attended,
        "consecutive_absences": consecutive_absences,
        "risk_level": str(prediction),
        "confidence": confidence,
        "recommendation": recommendation,
    }
