
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from data_processing import process_plant_1_data
from anomaly_detection import detect_solar_anomalies

app = FastAPI(title="Solar Plant Health API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
         "https://solar-plant-health-dashboard-5nqws3qiu-codecraze3.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "Solar Plant Health API is running"}


@app.get("/api/plant-data")
def get_plant_data():
    df, diagnostics = process_plant_1_data(how="left")
    df, anomaly_summary = detect_solar_anomalies(df)

    # Convert timestamps and missing values into JSON-safe values.
    df = df.copy()
    for column in df.select_dtypes(include=["datetime", "datetimetz"]).columns:
        df[column] = df[column].astype(str)

    df = df.astype(object).where(df.notna(), None)

    return {
        "total_readings": len(df),
        "columns": df.columns.tolist(),
        "data": df.to_dict(orient="records"),
    }
