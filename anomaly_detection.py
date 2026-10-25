"""anomaly_detection.py
--------------------
Fault detection, anomaly labeling, and health diagnostics module
for Plant 1 Solar Inverter Telemetry.

Designed to accept the output DataFrame from `data_processing.py`.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Tuple
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def compute_derived_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes baseline operational metrics required for anomaly detection:
    - Hour, date, and daylight indicators.
    - Apparent DC-to-AC conversion ratio (AC / DC).
    - Fleet median and IQR AC generation per timestamp.
    """
    df = df.copy()

    # Time features
    df["HOUR"] = df["DATE_TIME"].dt.hour
    
    # Daylight threshold based on actual measured irradiation
    # Kaggle dataset irradiation is typically in kW/m^2 (peaks ~ 1.0 - 1.2)
    df["IS_DAYLIGHT"] = df["IRRADIATION"].fillna(0) > 0.05

    # Conversion efficiency ratio (Handling 0 / 0 safely)
    # Note: DC_POWER in Plant 1 is raw ~10x AC_POWER
    df["AC_DC_RATIO"] = np.where(
        (df["DC_POWER"] > 10.0) & (df["AC_POWER"] > 0),
        df["AC_POWER"] / df["DC_POWER"],
        np.nan,
    )

    # Inverter fleet benchmarks per timestamp
    # Group by DATE_TIME to find the expected production under identical irradiance
    fleet_stats = (
        df.groupby("DATE_TIME")["AC_POWER"]
        .agg(
            FLEET_AC_MEDIAN="median",
            FLEET_AC_Q25=lambda x: x.quantile(0.25),
            FLEET_AC_Q75=lambda x: x.quantile(0.75),
        )
        .reset_index()
    )
    fleet_stats["FLEET_AC_IQR"] = fleet_stats["FLEET_AC_Q75"] - fleet_stats["FLEET_AC_Q25"]

    df = df.merge(fleet_stats, on="DATE_TIME", how="left")
    return df


def detect_solar_anomalies(
    df: pd.DataFrame,
    clipping_threshold_ac: float = 1350.0,
    min_irradiation_threshold: float = 0.20,
    underperformance_ratio: float = 0.60,
    expected_ac_dc_ratio_floor: float = 0.075,  # Baseline is ~0.098 (1/10.23)
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Evaluates inverter health and tags physical and statistical anomalies.

    Parameters:
        df: Merged output DataFrame from data_processing.py
        clipping_threshold_ac: Inverter AC power cap threshold
        min_irradiation_threshold: Sunlight threshold to qualify active daytime
        underperformance_ratio: Threshold below fleet median to trigger peer anomaly
        expected_ac_dc_ratio_floor: Minimum acceptable AC/DC power ratio

    Returns:
        Tuple[pd.DataFrame, Dict[str, Any]]:
            - DataFrame with boolean anomaly flags and descriptive tags.
            - Diagnostic summary report of identified anomalies.
    """
    processed = compute_derived_metrics(df)

    # 1. Complete Inverter Drop / Failure
    # Sun is shining strong, but inverter generates near-zero power
    processed["FAULT_ZERO_DROPOUT"] = (
        (processed["IRRADIATION"] >= min_irradiation_threshold)
        & (processed["AC_POWER"] <= 1.0)
    )

    # 2. Inverter Power Clipping / Saturation
    # Plant 1 inverters often plateau near ~1350 - 1410 kW during peak midday
    processed["FLAG_INVERTER_CLIPPING"] = (
        processed["AC_POWER"] >= clipping_threshold_ac
    )

    # 3. Severe Conversion Degradation
    # DC is coming in, but AC conversion efficiency dropped significantly
    processed["FAULT_LOW_CONVERSION_EFFICIENCY"] = (
        (processed["DC_POWER"] > 100.0)
        & (processed["IRRADIATION"] >= min_irradiation_threshold)
        & (processed["AC_DC_RATIO"] < expected_ac_dc_ratio_floor)
    )

    # 4. Peer-Relative Underperformance
    # Compared to other inverters under the exact same weather at the same minute
    processed["FAULT_FLEET_UNDERPERFORMANCE"] = (
        (processed["IS_DAYLIGHT"])
        & (processed["FLEET_AC_MEDIAN"] > 50.0)
        & (processed["AC_POWER"] < underperformance_ratio * processed["FLEET_AC_MEDIAN"])
        & (~processed["FAULT_ZERO_DROPOUT"])  # Separate partial loss from total drop
    )

    # 5. Composite Anomaly Flag
    fault_columns = [
        "FAULT_ZERO_DROPOUT",
        "FAULT_LOW_CONVERSION_EFFICIENCY",
        "FAULT_FLEET_UNDERPERFORMANCE",
    ]
    processed["IS_ANOMALOUS"] = processed[fault_columns].any(axis=1)

    # Human-readable severity classification
    def assign_status(row: pd.Series) -> str:
        if row["FAULT_ZERO_DROPOUT"]:
            return "CRITICAL_INVERTER_TRIP"
        if row["FAULT_LOW_CONVERSION_EFFICIENCY"]:
            return "MAJOR_EFFICIENCY_LOSS"
        if row["FAULT_FLEET_UNDERPERFORMANCE"]:
            return "MODERATE_UNDERPERFORMANCE"
        if row["FLAG_INVERTER_CLIPPING"]:
            return "NORMAL_CLIPPING"
        return "NORMAL_HEALTHY"

    processed["HEALTH_STATUS"] = processed.apply(assign_status, axis=1)

    # Build Summary Audit
    total_records = len(processed)
    summary = {
        "total_records_analyzed": total_records,
        "anomalous_records_count": int(processed["IS_ANOMALOUS"].sum()),
        "anomaly_rate_percent": round(
            float(processed["IS_ANOMALOUS"].sum() / total_records * 100), 2
        ),
        "breakdown": {
            "zero_dropout_count": int(processed["FAULT_ZERO_DROPOUT"].sum()),
            "low_efficiency_count": int(processed["FAULT_LOW_CONVERSION_EFFICIENCY"].sum()),
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
        "Anomaly scan completed: %d anomalies detected (%.2f%% of total rows).",
        summary["anomalous_records_count"],
        summary["anomaly_rate_percent"],
    )

    return processed, summary


if __name__ == "__main__":
    from data_processing import process_plant_1_data

    # 1. Ingest and merge data using your existing module
    merged_data, pipeline_report = process_plant_1_data(how="left")

    # 2. Run anomaly detection
    tagged_data, anomaly_report = detect_solar_anomalies(merged_data)

    print("\n" + "=" * 80)
    print("ANOMALY DETECTION SUMMARY REPORT")
    print("=" * 80)
    print(f"Total Rows Scanned:     {anomaly_report['total_records_analyzed']:,}")
    print(f"Anomalous Records:      {anomaly_report['anomalous_records_count']:,} ({anomaly_report['anomaly_rate_percent']}%)")
    print("\nFault Breakdown:")
    for fault, count in anomaly_report["breakdown"].items():
        print(f"  - {fault:30s}: {count:,}")

    print("\nTop Inverters by Anomaly Frequency:")
    for inv, count in list(anomaly_report["inverters_by_fault_frequency"].items())[:5]:
        print(f"  - Inverter {inv}: {count} anomalous timestamps")

    # Inspect worst offending cases
    worst_cases = tagged_data[tagged_data["FAULT_ZERO_DROPOUT"]][
        ["DATE_TIME", "SOURCE_KEY", "DC_POWER", "AC_POWER", "IRRADIATION", "HEALTH_STATUS"]
    ].head(10)
    print("\nSample Inverter Dropout Records (High Sun, Zero AC):")
    print(worst_cases.to_string(index=False))