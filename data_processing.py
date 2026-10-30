"""
data_processing.py
------------------
Data processing module for the Solar Plant Health Dashboard project.
Handles loading, column normalization, timestamp parsing, validation,
sampling interval detection, and dataset merging for any solar generation
and weather sensor datasets (Plant 1, Plant 2, or custom user uploads).
"""

from __future__ import annotations

import io
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd

# Configure module-level logger
logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(levelname)s] %(asctime)s - %(name)s: %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# Project root anchor for cross-platform and directory-independent path resolution
PROJECT_ROOT = Path(__file__).resolve().parent

# Default dataset paths (relative to project root)
DEFAULT_PLANT_1_GEN_PATH = PROJECT_ROOT / "data" / "Plant_1_Generation_Data.csv"
DEFAULT_PLANT_1_WEATHER_PATH = PROJECT_ROOT / "data" / "Plant_1_Weather_Sensor_Data.csv"

# Expected schema definitions
EXPECTED_GEN_COLUMNS = [
    "DATE_TIME",
    "PLANT_ID",
    "SOURCE_KEY",
    "DC_POWER",
    "AC_POWER",
    "DAILY_YIELD",
    "TOTAL_YIELD",
]

EXPECTED_WEATHER_COLUMNS = [
    "DATE_TIME",
    "PLANT_ID",
    "SOURCE_KEY",
    "AMBIENT_TEMPERATURE",
    "MODULE_TEMPERATURE",
    "IRRADIATION",
]

# Comprehensive synonyms and aliases for flexible column recognition
GEN_COLUMN_ALIASES: Dict[str, List[str]] = {
    "DATE_TIME": [
        "date_time", "datetime", "timestamp", "date", "time", "date_and_time",
        "time_stamp", "datetime_utc", "reading_time", "record_time",
    ],
    "PLANT_ID": [
        "plant_id", "plant", "plantid", "site_id", "plant_key", "system_id", "station_id",
    ],
    "SOURCE_KEY": [
        "source_key", "inverter_id", "inverter", "source", "device_id", "inv_id",
        "inverterid", "key", "device", "inverter_name", "serial_number",
    ],
    "DC_POWER": [
        "dc_power", "dcpower", "dc_output", "dc", "dc_kw", "dc_power_kw",
        "dc_generation", "dcp",
    ],
    "AC_POWER": [
        "ac_power", "acpower", "ac_output", "power", "actual_power", "generation",
        "ac", "ac_kw", "ac_power_kw", "power_kw", "ac_generation", "acp",
    ],
    "DAILY_YIELD": [
        "daily_yield", "yield_daily", "dailyyield", "today_yield", "day_yield",
    ],
    "TOTAL_YIELD": [
        "total_yield", "yield_total", "totalyield", "cumulative_yield", "lifetime_yield",
    ],
}

WEATHER_COLUMN_ALIASES: Dict[str, List[str]] = {
    "DATE_TIME": [
        "date_time", "datetime", "timestamp", "date", "time", "date_and_time",
        "time_stamp", "datetime_utc", "reading_time", "record_time",
    ],
    "PLANT_ID": [
        "plant_id", "plant", "plantid", "site_id", "plant_key", "system_id",
    ],
    "SOURCE_KEY": [
        "source_key", "sensor_id", "sensor", "device_id", "weather_sensor_key",
        "weather_station_id", "station",
    ],
    "AMBIENT_TEMPERATURE": [
        "ambient_temperature", "ambient_temp", "amb_temp", "temp_ambient",
        "ambient", "ambtemp", "air_temp", "temp_air", "t_amb",
    ],
    "MODULE_TEMPERATURE": [
        "module_temperature", "module_temp", "mod_temp", "panel_temp",
        "temp_module", "module", "modtemp", "cell_temperature", "t_mod",
    ],
    "IRRADIATION": [
        "irradiation", "irradiance", "radiation", "solar_radiation", "irrad",
        "sunlight", "ghi", "poa", "solar_irradiance", "irradiance_kw_m2",
    ],
}


def clean_header_string(header: str) -> str:
    """Normalize a header string: uppercase, stripping spaces, underscores, and hyphens."""
    return re.sub(r"[\s_\-]+", "", str(header).strip().upper())


def standardize_columns(df: pd.DataFrame, aliases_dict: Dict[str, List[str]]) -> pd.DataFrame:
    """
    Renames columns in df to their canonical names if they match known aliases.
    Case-insensitive, whitespace-insensitive, punctuation-insensitive.
    """
    col_map: Dict[str, str] = {}
    cleaned_df_cols = {clean_header_string(c): c for c in df.columns}

    for canonical, aliases in aliases_dict.items():
        canonical_clean = clean_header_string(canonical)
        if canonical_clean in cleaned_df_cols:
            col_map[cleaned_df_cols[canonical_clean]] = canonical
            continue

        for alias in aliases:
            alias_clean = clean_header_string(alias)
            if alias_clean in cleaned_df_cols:
                col_map[cleaned_df_cols[alias_clean]] = canonical
                break

    return df.rename(columns=col_map)


def parse_timestamps(series: pd.Series) -> pd.Series:
    """
    Robustly parses a series of datetime strings into pd.Timestamp,
    supporting DD-MM-YYYY, YYYY-MM-DD, slashes, ISO, and mixed formats.
    """
    clean_series = series.astype(str).str.strip().str.replace("Z", "", regex=False)

    try:
        parsed = pd.to_datetime(clean_series, format="mixed", dayfirst=True, errors="coerce")
    except Exception:
        parsed = pd.to_datetime(clean_series, errors="coerce")

    return parsed


def determine_sampling_interval_hours(df: pd.DataFrame) -> float:
    """
    Calculates the median positive sampling interval across inverters in hours.
    Falls back to 0.25 (15 minutes) if insufficient data.
    """
    if "DATE_TIME" not in df.columns or len(df) < 2:
        return 0.25

    try:
        sort_cols = ["SOURCE_KEY", "DATE_TIME"] if "SOURCE_KEY" in df.columns else ["DATE_TIME"]
        sorted_df = df.sort_values(sort_cols)
        
        if "SOURCE_KEY" in df.columns:
            deltas = sorted_df.groupby("SOURCE_KEY")["DATE_TIME"].diff().dt.total_seconds().dropna()
        else:
            deltas = sorted_df["DATE_TIME"].diff().dt.total_seconds().dropna()

        positive_deltas = deltas[(deltas >= 60.0) & (deltas <= 86400.0)]
        if len(positive_deltas) > 0:
            median_sec = float(positive_deltas.median())
            return round(median_sec / 3600.0, 4)
    except Exception as e:
        logger.warning(f"Could not calculate sampling interval from timestamps: {e}. Defaulting to 0.25h.")

    return 0.25


def resolve_filepath(filepath: Union[str, Path]) -> Path:
    """
    Resolves the provided filepath, falling back to .zip or uncompressed variations.
    """
    path = Path(filepath)

    if path.is_file():
        return path

    if not path.is_absolute():
        project_relative = PROJECT_ROOT / path
        if project_relative.is_file():
            return project_relative

    zip_path = Path(str(path) + ".zip")
    if zip_path.is_file():
        return zip_path

    if not zip_path.is_absolute():
        project_zip = PROJECT_ROOT / zip_path
        if project_zip.is_file():
            return project_zip

    if path.suffix.lower() == ".zip":
        stem_path = path.with_suffix("")
        if stem_path.is_file():
            return stem_path
        if not stem_path.is_absolute():
            project_stem = PROJECT_ROOT / stem_path
            if project_stem.is_file():
                return project_stem

    raise FileNotFoundError(f"Could not locate dataset file at '{path}' or '{zip_path}'.")


def read_csv_flexible(source: Union[str, Path, io.StringIO, io.BytesIO, pd.DataFrame]) -> pd.DataFrame:
    """Reads CSV data from path, string, bytes, or returns DataFrame if already loaded."""
    if isinstance(source, pd.DataFrame):
        return source.copy()

    if isinstance(source, io.StringIO):
        return pd.read_csv(source)

    if isinstance(source, io.BytesIO):
        return pd.read_csv(source)

    if isinstance(source, str):
        if "\n" in source or "\r" in source:
            return pd.read_csv(io.StringIO(source))
        return pd.read_csv(resolve_filepath(source))

    if isinstance(source, Path):
        return pd.read_csv(resolve_filepath(source))

    raise TypeError(f"Unsupported source type for CSV loading: {type(source)}")


def validate_dataframe(
    df: pd.DataFrame,
    dataset_name: str,
    required_columns: List[str],
) -> Dict[str, Any]:
    """Validates dataframe for required columns, nulls, duplicates."""
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise ValueError(
            f"Dataset '{dataset_name}' is missing required column(s): {missing_cols}. "
            f"Found columns: {list(df.columns)}"
        )

    null_counts = df[required_columns].isnull().sum().to_dict()
    total_nulls = sum(null_counts.values())
    exact_duplicates = int(df.duplicated().sum())

    numeric_cols = [
        col for col in df.select_dtypes(include=[np.number]).columns
        if col != "PLANT_ID" and col in required_columns
    ]
    negative_counts = {col: int((df[col] < 0).sum()) for col in numeric_cols}

    date_min = df["DATE_TIME"].min() if "DATE_TIME" in df.columns else None
    date_max = df["DATE_TIME"].max() if "DATE_TIME" in df.columns else None
    unique_sources = int(df["SOURCE_KEY"].nunique()) if "SOURCE_KEY" in df.columns else 0

    return {
        "dataset_name": dataset_name,
        "row_count": len(df),
        "column_count": len(df.columns),
        "missing_columns": missing_cols,
        "null_counts": null_counts,
        "total_nulls": total_nulls,
        "exact_duplicate_rows": exact_duplicates,
        "negative_value_counts": negative_counts,
        "unique_sources_count": unique_sources,
        "date_min": str(date_min) if date_min is not None else None,
        "date_max": str(date_max) if date_max is not None else None,
    }


def load_generation_data(
    source: Union[str, Path, io.StringIO, io.BytesIO, pd.DataFrame] = DEFAULT_PLANT_1_GEN_PATH,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Loads, standardizes, validates, and cleans inverter generation data.
    Works dynamically with Plant 1, Plant 2, or any valid generation CSV.
    """
    df = read_csv_flexible(source)
    df = standardize_columns(df, GEN_COLUMN_ALIASES)

    # Core required columns for generation
    core_required = ["DATE_TIME", "SOURCE_KEY", "AC_POWER"]
    missing = [c for c in core_required if c not in df.columns]
    if missing:
        raise ValueError(
            f"Generation CSV is missing required column(s): {missing}. "
            f"Please ensure your CSV includes timestamp, inverter identifier, and AC power columns."
        )

    # Parse and validate timestamps
    df["DATE_TIME"] = parse_timestamps(df["DATE_TIME"])
    valid_dates = df["DATE_TIME"].notna()
    if not valid_dates.all():
        dropped_count = int((~valid_dates).sum())
        logger.warning(f"Dropping {dropped_count} rows with unparseable timestamps.")
        df = df[valid_dates].copy()

    if len(df) == 0:
        raise ValueError("No valid rows remaining in generation dataset after timestamp parsing.")

    # Clean inverters
    df["SOURCE_KEY"] = df["SOURCE_KEY"].astype(str).str.strip()

    # Coerce numeric generation metrics
    numeric_fields = ["AC_POWER", "DC_POWER", "DAILY_YIELD", "TOTAL_YIELD"]
    for field in numeric_fields:
        if field in df.columns:
            df[field] = pd.to_numeric(df[field], errors="coerce")
            # Power cannot be physically negative in generation
            if field in ["AC_POWER", "DC_POWER"]:
                df[field] = df[field].clip(lower=0.0)

    # Ensure PLANT_ID is present
    if "PLANT_ID" not in df.columns:
        df["PLANT_ID"] = 1
    else:
        df["PLANT_ID"] = df["PLANT_ID"].fillna(1)

    # Detect sampling interval
    interval_hours = determine_sampling_interval_hours(df)

    report = validate_dataframe(df, "Generation_Data", core_required)
    report["sampling_interval_hours"] = interval_hours

    return df, report


def load_weather_data(
    source: Union[str, Path, io.StringIO, io.BytesIO, pd.DataFrame] = DEFAULT_PLANT_1_WEATHER_PATH,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Loads, standardizes, validates, and cleans weather sensor data.
    Requires DATE_TIME and at least one weather metric.
    """
    df = read_csv_flexible(source)
    df = standardize_columns(df, WEATHER_COLUMN_ALIASES)

    if "DATE_TIME" not in df.columns:
        raise ValueError("Weather CSV is missing required 'DATE_TIME' column.")

    weather_metrics = [c for c in ["IRRADIATION", "AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE"] if c in df.columns]
    if not weather_metrics:
        raise ValueError(
            "Weather CSV must contain at least one weather metric column "
            "(e.g. IRRADIATION, AMBIENT_TEMPERATURE, or MODULE_TEMPERATURE)."
        )

    df["DATE_TIME"] = parse_timestamps(df["DATE_TIME"])
    valid_dates = df["DATE_TIME"].notna()
    if not valid_dates.all():
        df = df[valid_dates].copy()

    for col in weather_metrics:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        if col == "IRRADIATION":
            df[col] = df[col].clip(lower=0.0)

    if "PLANT_ID" not in df.columns:
        df["PLANT_ID"] = 1
    else:
        df["PLANT_ID"] = df["PLANT_ID"].fillna(1)

    if "SOURCE_KEY" in df.columns:
        df = df.rename(columns={"SOURCE_KEY": "WEATHER_SENSOR_KEY"})

    report = validate_dataframe(df, "Weather_Sensor_Data", ["DATE_TIME"] + weather_metrics)
    return df, report


def merge_plant_data(
    gen_df: pd.DataFrame,
    weather_df: Optional[pd.DataFrame] = None,
    how: str = "left",
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Merges inverter generation data with optional plant weather sensor data on DATE_TIME.
    Handles exact matching or graceful left joins.
    """
    if weather_df is None or len(weather_df) == 0:
        # Weather data not supplied; fill weather columns with None
        merged_df = gen_df.copy()
        for col in ["WEATHER_SENSOR_KEY", "AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE", "IRRADIATION"]:
            if col not in merged_df.columns:
                merged_df[col] = np.nan

        merged_df = merged_df.sort_values(by=["DATE_TIME", "SOURCE_KEY"]).reset_index(drop=True)
        return merged_df, {
            "rows_before_generation": len(gen_df),
            "rows_before_weather": 0,
            "rows_after_merge": len(merged_df),
            "weather_merged": False,
        }

    # Weather data supplied; merge on DATE_TIME and PLANT_ID if matching
    merge_keys = ["DATE_TIME"]
    if "PLANT_ID" in gen_df.columns and "PLANT_ID" in weather_df.columns:
        common_plants = set(gen_df["PLANT_ID"]).intersection(set(weather_df["PLANT_ID"]))
        if common_plants:
            merge_keys.append("PLANT_ID")

    # If weather timestamps are within 15 minutes but have slightly different seconds,
    # pandas merge will match exact DATE_TIME. Ensure DATE_TIME rounded to nearest minute if needed.
    weather_prep = weather_df.copy()
    if "SOURCE_KEY" in weather_prep.columns and "WEATHER_SENSOR_KEY" not in weather_prep.columns:
        weather_prep = weather_prep.rename(columns={"SOURCE_KEY": "WEATHER_SENSOR_KEY"})

    merged_df = pd.merge(gen_df, weather_prep, on=merge_keys, how=how)
    merged_df = merged_df.sort_values(by=["DATE_TIME", "SOURCE_KEY"]).reset_index(drop=True)

    diagnostics = {
        "rows_before_generation": len(gen_df),
        "rows_before_weather": len(weather_df),
        "rows_after_merge": len(merged_df),
        "merge_keys": merge_keys,
        "merge_method": how,
        "weather_merged": True,
        "unique_inverters": sorted(merged_df["SOURCE_KEY"].dropna().unique().tolist()),
    }

    return merged_df, diagnostics


def process_uploaded_data(
    gen_source: Union[str, Path, io.StringIO, io.BytesIO, pd.DataFrame],
    weather_source: Optional[Union[str, Path, io.StringIO, io.BytesIO, pd.DataFrame]] = None,
    how: str = "left",
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    General end-to-end processing function for any uploaded generation and weather CSVs.
    """
    gen_df, gen_report = load_generation_data(gen_source)

    weather_df = None
    weather_report = None
    if weather_source is not None:
        try:
            weather_df, weather_report = load_weather_data(weather_source)
        except Exception as e:
            logger.warning(f"Could not load weather data: {e}. Proceeding with generation data only.")

    merged_df, merge_diagnostics = merge_plant_data(gen_df, weather_df, how=how)

    combined_report = {
        "generation_validation": gen_report,
        "weather_validation": weather_report,
        "merge_diagnostics": merge_diagnostics,
        "sampling_interval_hours": gen_report.get("sampling_interval_hours", 0.25),
    }

    return merged_df, combined_report


def process_plant_1_data(
    gen_path: Union[str, Path] = DEFAULT_PLANT_1_GEN_PATH,
    weather_path: Union[str, Path] = DEFAULT_PLANT_1_WEATHER_PATH,
    how: str = "left",
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Legacy wrapper maintaining backward compatibility for default Plant 1 pipeline.
    """
    return process_uploaded_data(gen_path, weather_path, how=how)


if __name__ == "__main__":
    print("Testing dynamic data processing on Plant 1 and Plant 2...")
    m1, rep1 = process_plant_1_data()
    print(f"Plant 1 rows: {len(m1):,}, interval: {rep1['sampling_interval_hours']}h")

    p2_path = PROJECT_ROOT / "data" / "Plant_2_Generation_Data.csv"
    if p2_path.is_file():
        m2, rep2 = process_uploaded_data(p2_path)
        print(f"Plant 2 rows: {len(m2):,}, interval: {rep2['sampling_interval_hours']}h")
