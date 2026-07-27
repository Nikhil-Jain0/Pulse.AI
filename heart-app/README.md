# Cardio — AI Heart Disease Risk Predictor

A single-page, glassmorphism-styled cardiovascular risk assessment app.
Flask backend serves predictions from your trained model; a vanilla
HTML/CSS/JS frontend delivers the guided 5-step assessment, animated
results, and a what-if risk simulator.

## Run it

```bash
pip install -r requirements.txt
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

## Structure

```
app.py                   Flask app + /api/predict endpoint
model/                    Your trained artifacts (heartdisease_predict.pkl, scaler.pkl, columns.pkl)
templates/index.html      Page markup (landing, assessment, loading, results)
static/css/style.css      Design system (glassmorphism, dark theme, blood-red accents)
static/js/background.js   Ambient beating-heart canvas background
static/js/cursor.js       Custom plasma-trail cursor
static/js/app.js          Multi-step form logic, API calls, results rendering, simulator
```

## How predictions work

`/api/predict` rebuilds the exact one-hot-encoded feature row your notebook
produced (`pd.get_dummies(..., drop_first=True)` minus `ST_Slope_Flat`),
scales the 5 continuous columns with your fitted `StandardScaler`, and runs
your trained `LogisticRegression` model — so results match the notebook
exactly.

## Design

Dark glassmorphism theme (near-black gradient background, blood-red/crimson
accents), a slowly beating anatomical heart in the background with pulse
rings and particles, a custom plasma-trail cursor, a guided 5-step form
(Personal → Symptoms → Vitals → Clinical → ECG Analysis), an animated
loading sequence, and a results page with a circular risk meter, risk
factor cards, positive/negative indicators, personalized recommendations,
and an interactive "what happens if..." simulator that re-queries the model
live.

## Note

This is a statistical/educational tool, not a medical device. The UI
includes a disclaimer on the results page.
