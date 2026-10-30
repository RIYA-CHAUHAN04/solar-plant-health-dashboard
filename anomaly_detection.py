"""anomaly_detection.py
--------------------
Fault detection, dynamic baseline modeling, and health diagnostics module
for Solar Plant Inverter Telemetry.

Designed to dynamically process any solar generation and weather datasets
(Plant 1, Plant 2, or custom uploaded datasets).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Tuple
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def compute_peer_benchmarks(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes leave-one-out peer statistics for each inverter at every timestamp:
    - PEER_AC_MEDIAN: Median AC power of all OTHER inverters at timestamp t (excluding self).
    - PEER_AC_MEAN: Mean AC power of all OTHER inverters.
    - PEER_AC_STD: Standard deviation of all OTHER inverters.
    - PEER_COUNT: Number of peer inverters reporting at timestamp t.
    """
    df = df.copy()

    if "DATE_TIME" not in df.columns or "SOURCE_KEY" not in df.columns or "AC_POWER" not in df.columns:
        return df

    unique_inverters = df["SOURCE_KEY"].nunique()

    # If only 1 inverter exists, peers cannot be calculated
    if unique_inverters <= 1:
        df["PEER_AC_MEDIAN"] = np.nan
        df["PEER_AC_MEAN"] = np.nan
        df["PEER_AC_STD"] = np.nan
        df["PEER_COUNT"] = 0
        df["FLEET_AC_MEDIAN"] = df["AC_POWER"]
        return df

    # Pivot table: index=DATE_TIME, columns=SOURCE_KEY, values=AC_POWER
    pvt = df.pivot_table(index="DATE_TIME", columns="SOURCE_KEY", values="AC_POWER", aggfunc="first")

    peer_medians = pd.DataFrame(index=pvt.index)
    peer_means = pd.DataFrame(index=pvt.index)
    peer_stds = pd.DataFrame(index=pvt.index)

    for col in pvt.columns:
        others = pvt.drop(columns=[col])
        peer_medians[col] = others.median(axis=1)
        peer_means[col] = others.mean(axis=1)
        peer_stds[col] = others.std(axis=1)

    peer_med_df = peer_medians.reset_index().melt(
        id_vars="DATE_TIME", var_name="SOURCE_KEY", value_name="PEER_AC_MEDIAN"
    )
    peer_mean_df = peer_means.reset_index().melt(
        id_vars="DATE_TIME", var_name="SOURCE_KEY", value_name="PEER_AC_MEAN"
    )
    peer_std_df = peer_stds.reset_index().melt(
        id_vars="DATE_TIME", var_name="SOURCE_KEY", value_name="PEER_AC_STD"
    )

    peers_df = pd.merge(peer_med_df, peer_mean_df, on=["DATE_TIME", "SOURCE_KEY"], how="left")
    peers_df = pd.merge(peers_df, peer_std_df, on=["DATE_TIME", "SOURCE_KEY"], how="left")
    peers_df["PEER_COUNT"] = unique_inverters - 1

    df = pd.merge(df, peers_df, on=["DATE_TIME", "SOURCE_KEY"], how="left")

    # Overall fleet median
    fleet_med = df.groupby("DATE_TIME")["AC_POWER"].transform("median")
    df["FLEET_AC_MEDIAN"] = fleet_med

    return df


def compute_derived_metrics(
    df: pd.DataFrame,
    sampling_interval_hours: Optional[float] = None,
) -> pd.DataFrame:
    """
    Computes operational metrics required for anomaly detection:
    - Hour and date features.
    - Robust daylight detection.
    - Apparent DC-to-AC conversion ratio (AC / DC).
    - Leave-one-out peer statistics per timestamp.
    - Dynamic physical & peer expected generation.
    - Power deficit and energy loss in kWh.
    """
    df = df.copy()

    # Time features
    if "DATE_TIME" in df.columns and pd.api.types.is_datetime64_any_dtype(df["DATE_TIME"]):
        df["HOUR"] = df["DATE_TIME"].dt.hour
    else:
        df["HOUR"] = 12

    # Conversion efficiency ratio (Handling 0 / 0 safely)
    if "DC_POWER" in df.columns:
        df["AC_DC_RATIO"] = np.where(
            (df["DC_POWER"] > 10.0) & (df["AC_POWER"] > 0),
            df["AC_POWER"] / df["DC_POWER"],
            np.nan,
        )
    else:
        df["AC_DC_RATIO"] = np.nan

    # Leave-one-out peer benchmarks
    df = compute_peer_benchmarks(df)

    # Determine daylight threshold
    has_irrad = "IRRADIATION" in df.columns and df["IRRADIATION"].notna().sum() > 0
    if has_irrad:
        df["IS_DAYLIGHT"] = df["IRRADIATION"].fillna(0) > 0.02
    else:
        fleet_max = df.groupby("DATE_TIME")["AC_POWER"].transform("max")
        fleet_med = df.get("FLEET_AC_MEDIAN", df["AC_POWER"])
        # Sunlight inferred from fleet power generation and daylight hours
        df["IS_DAYLIGHT"] = (fleet_max > 10.0) | ((fleet_med > 5.0) & (df["HOUR"] >= 6) & (df["HOUR"] <= 19))

    # Plant-level estimated nominal capacity per inverter
    positive_ac = df[df["AC_POWER"] > 10.0]["AC_POWER"]
    plant_nominal_kw = float(positive_ac.quantile(0.99)) if len(positive_ac) > 100 else 620.0
    if plant_nominal_kw <= 10.0:
        plant_nominal_kw = 620.0

    # Dynamic Expected Power calculation
    # Rule 1: When multiple inverters available, compare against comparable peer inverters (excluding self)
    # Rule 2: When weather data available, use irradiance-based expected power
    # Rule 3: If neither peer data nor weather data exists, mark as unavailable (do NOT set to actual or 0)
    has_peers = df["PEER_AC_MEDIAN"].notna().any()
    has_weather = has_irrad

    if has_peers:
        # Multi-inverter fleet baseline
        # Expected power is the peer median during daylight, 0 at night
        expected = np.where(df["IS_DAYLIGHT"], df["PEER_AC_MEDIAN"].fillna(0.0), 0.0)
        df["EXPECTED_POWER"] = expected
        df["EXPECTED_POWER_STATUS"] = "VALID_PEER_BASELINE"
    elif has_weather:
        # Single inverter with weather sensor
        irrad = df["IRRADIATION"].fillna(0.0)
        t_mod = df["MODULE_TEMPERATURE"].fillna(35.0) if "MODULE_TEMPERATURE" in df.columns else 35.0
        temp_factor = np.maximum(0.7, 1.0 - 0.0038 * np.maximum(0.0, t_mod - 25.0))
        p_irr = plant_nominal_kw * (irrad / 1.0) * temp_factor * 0.985
        df["EXPECTED_POWER"] = np.where(df["IS_DAYLIGHT"], np.maximum(0.0, p_irr), 0.0)
        df["EXPECTED_POWER_STATUS"] = "VALID_WEATHER_MODEL"
    else:
        # Single inverter with no weather data: reliable baseline cannot be calculated
        df["EXPECTED_POWER"] = np.nan
        df["EXPECTED_POWER_STATUS"] = "UNAVAILABLE_INSUFFICIENT_DATA"

    # Sampling interval in hours (determine from data if not passed)
    if sampling_interval_hours is None or sampling_interval_hours <= 0:
        from data_processing import determine_sampling_interval_hours
        interval_h = determine_sampling_interval_hours(df)
    else:
        interval_h = float(sampling_interval_hours)

    df["SAMPLING_INTERVAL_HOURS"] = interval_h

    # Power Deficit = max(Expected Power - Actual Power, 0)
    # Energy Loss = Power Deficit * interval_hours (kWh)
    valid_exp = df["EXPECTED_POWER"].notna() & df["IS_DAYLIGHT"]
    df["POWER_DEFICIT"] = np.where(
        valid_exp,
        np.maximum(df["EXPECTED_POWER"] - df["AC_POWER"], 0.0),
        0.0,
    )
    df["ENERGY_LOSS_KWH"] = (df["POWER_DEFICIT"] * interval_h).round(3)

    return df


def detect_solar_anomalies(
    df: pd.DataFrame,
    clipping_threshold_ac: Optional[float] = None,
    min_irradiation_threshold: float = 0.20,
    underperformance_ratio: float = 0.25,  # 25% shortfall threshold (1 - sensitivity)
    expected_ac_dc_ratio_floor: float = 0.075,
    sampling_interval_hours: Optional[float] = None,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Evaluates inverter health and tags physical and statistical anomalies dynamically.
    Returns:
        Tuple[pd.DataFrame, Dict[str, Any]]:
            - DataFrame with anomaly flags, reason, severity, and health status.
            - Diagnostic summary report.
    """
    processed = compute_derived_metrics(df, sampling_interval_hours=sampling_interval_hours)

    # Dynamic clipping threshold based on plant 99.5th percentile AC power
    if clipping_threshold_ac is None:
        p995 = float(processed[processed["AC_POWER"] > 10.0]["AC_POWER"].quantile(0.995)) if len(processed) > 100 else 1350.0
        clipping_threshold_ac = max(p995 * 0.98, 1200.0)

    has_irrad = "IRRADIATION" in processed.columns and processed["IRRADIATION"].notna().sum() > 0
    has_dc = "DC_POWER" in processed.columns and processed["DC_POWER"].notna().sum() > 0
    has_mod_temp = "MODULE_TEMPERATURE" in processed.columns and processed["MODULE_TEMPERATURE"].notna().sum() > 0

    irrad_active = processed["IRRADIATION"] >= min_irradiation_threshold if has_irrad else False
    peer_active = processed["PEER_AC_MEDIAN"] >= 40.0 if "PEER_AC_MEDIAN" in processed.columns else False

    # 1. Complete Inverter Drop / Failure (Critical)
    # Sun is shining strong or peer fleet is generating, but target inverter output is near zero
    processed["FAULT_ZERO_DROPOUT"] = (
        processed["IS_DAYLIGHT"]
        & (peer_active | irrad_active)
        & (processed["AC_POWER"] <= 1.0)
    )

    # 2. Inverter Power Clipping / Saturation
    processed["FLAG_INVERTER_CLIPPING"] = processed["AC_POWER"] >= clipping_threshold_ac

    # 3. Severe Conversion Degradation (Major)
    if has_dc:
        processed["FAULT_LOW_CONVERSION_EFFICIENCY"] = (
            processed["IS_DAYLIGHT"]
            & (processed["DC_POWER"] > 50.0)
            & (
                (processed["AC_POWER"] <= 2.0)
                | (
                    (processed["AC_DC_RATIO"] < expected_ac_dc_ratio_floor)
                    & (processed["AC_DC_RATIO"].notna())
                )
            )
            & (~processed["FAULT_ZERO_DROPOUT"])
        )
    else:
        processed["FAULT_LOW_CONVERSION_EFFICIENCY"] = False

    # 4. Thermal Overheating / Throttling (Medium/High)
    if has_mod_temp:
        processed["FAULT_THERMAL_THROTTLING"] = (
            processed["IS_DAYLIGHT"]
            & (processed["MODULE_TEMPERATURE"] >= 52.0)
            & (processed["POWER_DEFICIT"] >= 30.0)
            & (~processed["FAULT_ZERO_DROPOUT"])
        )
    else:
        processed["FAULT_THERMAL_THROTTLING"] = False

    # 5. Peer-Relative Underperformance (Partial Loss / String Outage)
    shortfall = processed["POWER_DEFICIT"]
    exp_power = processed["EXPECTED_POWER"].fillna(0.0)
    shortfall_ratio = np.where(exp_power > 1.0, shortfall / exp_power, 0.0)

    peer_high = processed["PEER_AC_MEDIAN"] > 50.0 if "PEER_AC_MEDIAN" in processed.columns else (exp_power > 50.0)

    processed["FAULT_FLEET_UNDERPERFORMANCE"] = (
        processed["IS_DAYLIGHT"]
        & peer_high
        & (shortfall_ratio >= underperformance_ratio)
        & (shortfall >= 15.0)
        & (~processed["FAULT_ZERO_DROPOUT"])
        & (~processed["FAULT_LOW_CONVERSION_EFFICIENCY"])
    )

    # 6. Composite Anomaly Flag
    fault_columns = [
        "FAULT_ZERO_DROPOUT",
        "FAULT_LOW_CONVERSION_EFFICIENCY",
        "FAULT_THERMAL_THROTTLING",
        "FAULT_FLEET_UNDERPERFORMANCE",
    ]
    processed["IS_ANOMALOUS"] = processed[fault_columns].any(axis=1)

    # Classify Health Status and Anomaly Reason
    def assign_diagnostics(row: pd.Series) -> Tuple[str, str, Optional[str]]:
        if row.get("EXPECTED_POWER_STATUS") == "UNAVAILABLE_INSUFFICIENT_DATA":
            return "INSUFFICIENT_DATA", "Insufficient baseline data to evaluate expected power", None

        if not row["IS_DAYLIGHT"]:
            return "NORMAL_NIGHT", "", None

        if row["FAULT_ZERO_DROPOUT"]:
            return (
                "CRITICAL_INVERTER_TRIP",
                "Critical Inverter Trip: Zero generation during active solar daylight",
                "High",
            )
        if row["FAULT_LOW_CONVERSION_EFFICIENCY"]:
            return (
                "MAJOR_EFFICIENCY_LOSS",
                "Major Conversion Loss: DC power present but AC conversion efficiency collapsed",
                "High",
            )
        if row["FAULT_THERMAL_THROTTLING"]:
            temp_val = f" ({row['MODULE_TEMPERATURE']:.1f}°C)" if pd.notna(row.get("MODULE_TEMPERATURE")) else ""
            return (
                "THERMAL_THROTTLING",
                f"Thermal Throttling: High module temperature{temp_val} causing generation derating",
                "Medium",
            )
        if row["FAULT_FLEET_UNDERPERFORMANCE"]:
            sf_pct = round(float(shortfall_ratio[row.name]) * 100) if row.name in range(len(shortfall_ratio)) else 30
            sev = "High" if sf_pct >= 40 else "Medium"
            return (
                "MODERATE_UNDERPERFORMANCE",
                f"Fleet Underperformance: {sf_pct}% shortfall compared to peer inverter baseline",
                sev,
            )
        if row["FLAG_INVERTER_CLIPPING"]:
            return "NORMAL_CLIPPING", "Inverter Clipping: Peak generation capped at maximum capacity", None

        return "NORMAL_HEALTHY", "", None

    diagnostics = [assign_diagnostics(row) for _, row in processed.iterrows()]
    processed["HEALTH_STATUS"] = [d[0] for d in diagnostics]
    processed["ANOMALY_REASON"] = [d[1] for d in diagnostics]
    processed["SEVERITY"] = [d[2] for d in diagnostics]

    # Build Summary Audit
    total_records = len(processed)
    anom_count = int(processed["IS_ANOMALOUS"].sum())
    anom_rate = round(float(anom_count / total_records * 100), 2) if total_records > 0 else 0.0

    summary = {
        "total_records_analyzed": total_records,
        "anomalous_records_count": anom_count,
        "anomaly_rate_percent": anom_rate,
        "sampling_interval_hours": processed["SAMPLING_INTERVAL_HOURS"].iloc[0] if total_records > 0 else 0.25,
        "total_energy_loss_kwh": round(float(processed["ENERGY_LOSS_KWH"].sum()), 2),
        "breakdown": {
            "zero_dropout_count": int(processed["FAULT_ZERO_DROPOUT"].sum()),
            "low_efficiency_count": int(processed["FAULT_LOW_CONVERSION_EFFICIENCY"].sum()),
            "thermal_throttling_count": int(processed["FAULT_THERMAL_THROTTLING"].sum()),
            "fleet_underperformance_count": int(processed["FAULT_FLEET_UNDERPERFORMANCE"].sum()),
            "clipping_events_count": int(processed["FLAG_INVERTER_CLIPPING"].sum()),
        },
        "inverters_by_fault_frequency": (
            processed[processed["IS_ANOMALOUS"]]
            .groupby("SOURCE_KEY")["IS_ANOMALOUS"]
            .count()
            .sort_values(ascending=False)
            .to_dict()
        ),
    }

    logger.info(
        "Anomaly scan completed: %d anomalies detected (%.2f%% of total rows). Total loss: %.1f kWh.",
        summary["anomalous_records_count"],
        summary["anomaly_rate_percent"],
        summary["total_energy_loss_kwh"],
    )

    return processed, summary


if __name__ == "__main__":
    from data_processing import process_plant_1_data, process_uploaded_data, PROJECT_ROOT

    print("=" * 80)
    print("TESTING DYNAMIC ANOMALY DETECTION ON PLANT 1 AND PLANT 2")
    print("=" * 80)

    # 1. Test Plant 1
    p1_data, p1_proc = process_plant_1_data()
    p1_tagged, p1_report = detect_solar_anomalies(p1_data, sampling_interval_hours=p1_proc["sampling_interval_hours"])
    print(f"Plant 1: {len(p1_tagged):,} rows, {p1_report['anomalous_records_count']:,} anomalies, {p1_report['total_energy_loss_kwh']:,} kWh loss")

    # 2. Test Plant 2
    p2_path = PROJECT_ROOT / "data" / "Plant_2_Generation_Data.csv"
    if p2_path.is_file():
        p2_data, p2_proc = process_uploaded_data(p2_path)
        p2_tagged, p2_report = detect_solar_anomalies(p2_data, sampling_interval_hours=p2_proc["sampling_interval_hours"])
        print(f"Plant 2: {len(p2_tagged):,} rows, {p2_report['anomalous_records_count']:,} anomalies, {p2_report['total_energy_loss_kwh']:,} kWh loss")
