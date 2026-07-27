"""
Heart Attack Risk Prediction — Flask backend.

Replicates the exact preprocessing pipeline from the training notebook:
  1. Build the same one-hot encoded feature vector produced by
     pd.get_dummies(df, drop_first=True) minus the dropped 'ST_Slope_Flat'
     column.
  2. Scale the 5 continuous columns with the fitted StandardScaler.
  3. Run the fitted LogisticRegression model.

Model artifacts (heartdisease_predict.pkl, scaler.pkl, columns.pkl) are
loaded once at startup from ./model.
"""
import os
import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")

model = joblib.load(os.path.join(MODEL_DIR, "heartdisease_predict.pkl"))
scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
columns = joblib.load(os.path.join(MODEL_DIR, "columns.pkl"))

CONTINUOUS_COLS = ["Age", "RestingBP", "Cholesterol", "MaxHR", "Oldpeak"]

app = Flask(__name__)


def build_feature_row(payload: dict) -> pd.DataFrame:
    """Turn a raw form payload into the exact one-hot-encoded row the
    model expects, in the exact column order stored in columns.pkl."""

    age = float(payload["Age"])
    resting_bp = float(payload["RestingBP"])
    cholesterol = float(payload["Cholesterol"])
    fasting_bs = int(payload["FastingBS"])
    max_hr = float(payload["MaxHR"])
    oldpeak = float(payload["Oldpeak"])

    sex = payload["Sex"]  # 'M' or 'F'
    chest_pain = payload["ChestPainType"]  # ATA, NAP, ASY, TA
    resting_ecg = payload["RestingECG"]  # Normal, ST, LVH
    exercise_angina = payload["ExerciseAngina"]  # Y or N
    st_slope = payload["ST_Slope"]  # Up, Flat, Down

    row = {
        "Age": age,
        "RestingBP": resting_bp,
        "Cholesterol": cholesterol,
        "FastingBS": fasting_bs,
        "MaxHR": max_hr,
        "Oldpeak": oldpeak,
        "Sex_M": 1 if sex == "M" else 0,
        "ChestPainType_ATA": 1 if chest_pain == "ATA" else 0,
        "ChestPainType_NAP": 1 if chest_pain == "NAP" else 0,
        "ChestPainType_TA": 1 if chest_pain == "TA" else 0,
        "RestingECG_Normal": 1 if resting_ecg == "Normal" else 0,
        "RestingECG_ST": 1 if resting_ecg == "ST" else 0,
        "ExerciseAngina_Y": 1 if exercise_angina == "Y" else 0,
        "ST_Slope_Up": 1 if st_slope == "Up" else 0,
    }

    df = pd.DataFrame([row], columns=columns)
    return df


def predict_risk(payload: dict) -> dict:
    df = build_feature_row(payload)

    df_scaled = df.copy()
    df_scaled[CONTINUOUS_COLS] = scaler.transform(df[CONTINUOUS_COLS])

    proba = model.predict_proba(df_scaled)[0]
    pred_class = int(model.predict(df_scaled)[0])
    risk_probability = float(proba[1])  # probability of class 1 = HeartDisease

    return {
        "prediction": pred_class,
        "risk_percent": round(risk_probability * 100, 1),
        "label": "High Risk" if pred_class == 1 else "Low Risk",
    }


REQUIRED_FIELDS = [
    "Age", "Sex", "ChestPainType", "RestingBP", "Cholesterol",
    "FastingBS", "RestingECG", "MaxHR", "ExerciseAngina", "Oldpeak",
    "ST_Slope",
]


def validate_payload(payload: dict):
    missing = [f for f in REQUIRED_FIELDS if f not in payload or payload[f] in (None, "")]
    if missing:
        return f"Missing fields: {', '.join(missing)}"
    return None


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/predict", methods=["POST"])
def predict():
    payload = request.get_json(silent=True) or {}
    error = validate_payload(payload)
    if error:
        return jsonify({"error": error}), 400

    try:
        result = predict_risk(payload)
    except (ValueError, KeyError) as exc:
        return jsonify({"error": f"Invalid input: {exc}"}), 400

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
