"""chatbot.py
----------
SolarWatch Assistant - Python CLI & Reasoning Engine.
Answers solar plant performance, anomaly detection, energy loss,
and inverter diagnostic queries using real plant telemetry data.
"""

import os
import json
import pandas as pd
from typing import Dict, Any, Optional

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "solar_generation_with_anomalies.csv")
PLANT_1_PATH = os.path.join(os.path.dirname(__file__), "data", "Plant_1_Generation_Data.csv", "Plant_1_Generation_Data.csv")

def load_summary() -> Dict[str, Any]:
    target = None
    if os.path.exists(DATA_PATH):
        target = DATA_PATH
    elif os.path.exists(PLANT_1_PATH):
        target = PLANT_1_PATH
        
    if not target:
        return {"status": "no_data"}
        
    try:
        df = pd.read_csv(target)
        inverters = df["SOURCE_KEY"].nunique() if "SOURCE_KEY" in df.columns else 0
        total_ac = float(df["AC_POWER"].sum()) if "AC_POWER" in df.columns else 0.0
        anomalies = int(df["IS_ANOMALOUS"].sum()) if "IS_ANOMALOUS" in df.columns else 0
        return {
            "status": "loaded",
            "file": os.path.basename(target),
            "rows": len(df),
            "inverters": inverters,
            "total_ac_kw": round(total_ac, 2),
            "anomalies": anomalies,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

def answer_solar_query(query: str, summary: Dict[str, Any]) -> str:
    q = query.lower().strip()
    
    if "performance" in q:
        return (
            f"☀️ [SolarWatch Assistant - Plant Performance]\n"
            f"Dataset: {summary.get('file', 'Telemetry')}\n"
            f"Total Readings: {summary.get('rows', 0):,}\n"
            f"Active Inverters: {summary.get('inverters', 0)}\n"
            f"Detected Anomalies: {summary.get('anomalies', 0)} events\n"
            f"Cumulative AC Generation: {summary.get('total_ac_kw', 0):,} kW"
        )
    elif "loss" in q:
        return (
            "⚡ [Energy Loss Analysis]\n"
            "Energy loss is computed as max(0, Expected_Power - Actual_Power) * sampling_interval.\n"
            f"Detected anomaly intervals: {summary.get('anomalies', 0)} intervals."
        )
    elif "ac" in q and "dc" in q:
        return (
            "🔌 [AC Power vs DC Power]\n"
            "DC Power is generated directly by PV panels. The inverter converts it into synchronized AC Power.\n"
            "Efficiency is AC / DC, typically 96% - 98.5%."
        )
    elif "maintenance" in q:
        return (
            "🛠️ [Maintenance Recommendations]\n"
            "1. Inspect AC breakers for tripped units.\n"
            "2. Clean heat sink air filters on inverters with thermal warnings.\n"
            "3. Test DC string combiner boxes with a clamp meter."
        )
    else:
        return (
            f"☀️ SolarWatch Assistant: Analyzing {summary.get('inverters', 0)} inverters.\n"
            "Ask about 'performance', 'loss', 'AC vs DC', or 'maintenance'."
        )

if __name__ == "__main__":
    print("☀️ SolarWatch Assistant Initialized")
    summary = load_summary()
    print(f"Loaded telemetry: {summary.get('file', 'None')} ({summary.get('rows', 0):,} rows)\n")
    while True:
        try:
            user_input = input("You: ")
            if user_input.lower() in ["exit", "quit", "q"]:
                break
            print("\nSolarWatch Assistant:", answer_solar_query(user_input, summary), "\n")
        except (KeyboardInterrupt, EOFError):
            break
