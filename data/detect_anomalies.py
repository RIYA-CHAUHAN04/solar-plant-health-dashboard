import pandas as pd
import numpy as np

df = pd.read_csv("solar_generation_with_anomalies.csv")
df["timestamp"] = pd.to_datetime(df["timestamp"])

# Filter out low irradiance/night periods (threshold: > 50 W/m^2)
daylight_df = df[df["irradiation"] > 50].copy()

# 1. Compute expected AC output from the peer median of all inverters at each timestamp
peer_medians = (
    daylight_df.groupby("timestamp")["ac_power"]
    .median()
    .rename("expected_ac_power")
)
daylight_df = daylight_df.merge(peer_medians, on="timestamp")

# 2. Compute deviation percentage and lost power
daylight_df["power_deficit"] = daylight_df["expected_ac_power"] - daylight_df["ac_power"]
daylight_df["deficit_pct"] = (daylight_df["power_deficit"] / daylight_df["expected_ac_power"]) * 100

# 3. Anomaly Criteria:
# - Critical Trip: Expected > 10 kW but Actual is 0 kW
# - Significant Underperformance: Deficit > 25% during active sunlight
is_trip = (daylight_df["expected_ac_power"] > 10.0) & (daylight_df["ac_power"] <= 0.1)
is_underperforming = daylight_df["deficit_pct"] > 25.0

daylight_df["is_anomaly"] = is_trip | is_underperforming

# 4. Energy loss per 15-minute interval (kWh = kW * 0.25)
daylight_df["lost_kwh"] = np.where(
    daylight_df["is_anomaly"], 
    daylight_df["power_deficit"] * 0.25, 
    0.0
)

# Summary table for dashboard display
anomalies_summary = (
    daylight_df[daylight_df["is_anomaly"]]
    .groupby("inverter_id")
    .agg(
        anomaly_count=("is_anomaly", "count"),
        total_lost_kwh=("lost_kwh", "sum"),
        avg_deficit_pct=("deficit_pct", "mean")
    )
    .reset_index()
)

print(anomalies_summary)
