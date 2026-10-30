"""api.py
------
FastAPI Backend for Solar Plant Health Dashboard.
Provides endpoints for initial plant data retrieval, dynamic CSV processing,
sampling interval detection, dynamic expected power calculation,
and data-driven anomaly detection.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from anomaly_detection import detect_solar_anomalies
from data_processing import process_plant_1_data, process_uploaded_data

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Solar Plant Health API",
    description="Dynamic API for Solar Plant Generation & Weather Telemetry Analysis",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CsvUploadPayload(BaseModel):
    generation_csv: str
    weather_csv: Optional[str] = None
    sensitivity: Optional[float] = 0.25


def sanitize_dataframe_for_json(df) -> List[Dict[str, Any]]:
    """Converts timestamps, NaNs, and infinite values into JSON-safe serializable dictionaries."""
    df_clean = df.copy()

    for col in df_clean.select_dtypes(include=["datetime", "datetimetz"]).columns:
        df_clean[col] = df_clean[col].astype(str)

    # Convert timestamp to epoch milliseconds for charting compatibility
    if "DATE_TIME" in df.columns and pd_is_datetime(df["DATE_TIME"]):
        df_clean["TIMESTAMP"] = (df["DATE_TIME"].astype("int64") // 10**6).tolist()
    else:
        df_clean["TIMESTAMP"] = None

    df_clean = df_clean.astype(object).where(df_clean.notna(), None)
    return df_clean.to_dict(orient="records")


def pd_is_datetime(series) -> bool:
    import pandas as pd
    return pd.api.types.is_datetime64_any_dtype(series)


@app.get("/")
def home():
    return {
        "service": "Solar Plant Health API",
        "status": "online",
        "version": "2.0.0",
        "endpoints": [
            "/api/plant-data",
            "/api/process-csv",
            "/api/upload-data",
        ],
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/plant-data")
def get_plant_data():
    """
    Returns baseline Plant 1 telemetry data dynamically evaluated
    with leave-one-out peer baselines, dynamic sampling intervals,
    and anomaly detection.
    """
    try:
        df, proc_report = process_plant_1_data(how="left")
        interval_hours = proc_report.get("sampling_interval_hours", 0.25)

        df, anomaly_summary = detect_solar_anomalies(
            df,
            sampling_interval_hours=interval_hours,
        )

        records = sanitize_dataframe_for_json(df)

        return {
            "success": True,
            "total_readings": len(df),
            "sampling_interval_hours": interval_hours,
            "columns": df.columns.tolist(),
            "summary": anomaly_summary,
            "data": records,
        }
    except Exception as e:
        logger.exception("Failed to load default plant data.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating plant data: {str(e)}",
        )


@app.post("/api/process-csv")
@app.post("/api/upload-data")
async def process_csv_endpoint(request: Request):
    """
    Dynamically processes uploaded generation CSV and optional weather CSV.
    Computes:
    - Flexible column normalization (handles aliases)
    - Dynamic sampling interval determination
    - Leave-one-out peer median benchmark
    - Physical irradiance expected power (when weather data present)
    - Power deficit and energy loss in kWh
    - Multi-stage anomaly detection with severity and cause
    """
    try:
        content_type = request.headers.get("content-type", "")

        generation_csv = ""
        weather_csv = None
        sensitivity = 0.25

        if "application/json" in content_type:
            body = await request.json()
            generation_csv = body.get("generation_csv", "")
            weather_csv = body.get("weather_csv")
            sensitivity = float(body.get("sensitivity", 0.25))
        else:
            # Handle plain text CSV or raw body
            raw_body = (await request.body()).decode("utf-8", errors="replace")
            if raw_body.strip().startswith("{") and raw_body.strip().endswith("}"):
                data = json.loads(raw_body)
                generation_csv = data.get("generation_csv", "")
                weather_csv = data.get("weather_csv")
                sensitivity = float(data.get("sensitivity", 0.25))
            else:
                generation_csv = raw_body

        if not generation_csv or not generation_csv.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No generation CSV data was received.",
            )

        # Ingest and validate data
        df, proc_report = process_uploaded_data(
            gen_source=generation_csv,
            weather_source=weather_csv,
            how="left",
        )

        interval_hours = proc_report.get("sampling_interval_hours", 0.25)

        # Detect anomalies dynamically
        df, anomaly_summary = detect_solar_anomalies(
            df,
            underperformance_ratio=sensitivity,
            sampling_interval_hours=interval_hours,
        )

        records = sanitize_dataframe_for_json(df)

        return {
            "success": True,
            "total_readings": len(df),
            "sampling_interval_hours": interval_hours,
            "columns": df.columns.tolist(),
            "summary": anomaly_summary,
            "data": records,
        }

    except ValueError as ve:
        logger.warning(f"Validation error in uploaded CSV: {ve}")
        return {
            "success": False,
            "error": str(ve),
        }
    except Exception as e:
        logger.exception("Unexpected error processing uploaded CSV.")
        return {
            "success": False,
            "error": f"Failed to process CSV: {str(e)}",
        }
