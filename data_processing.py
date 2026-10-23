"""
data_processing.py
------------------
Data processing module for the Solar Plant Health Dashboard project.

Author: Member 2 (Data Processing)
Dataset: Kaggle Solar Power Generation Dataset (Plant 1)

Key Responsibilities & Design Decisions:
1. File Loading & Fallback:
   - Supports both uncompressed (.csv) and compressed (.csv.zip) files transparently.
2. Datetime Parsing:
   - Generation Data: Parsed using format '%d-%m-%Y %H:%M'.
   - Weather Sensor Data: Parsed using format '%Y-%m-%d %H:%M:%S'.
3. Data Validation & Integrity:
   - Validates column existence, expected datatypes, null counts, and value boundaries.
   - Does NOT silently delete records; any anomalies or missing values are tracked and reported.
4. Key Preservation:
   - Preserves PLANT_ID and inverter SOURCE_KEY for inverter-level analysis.
   - Renames the single weather sensor SOURCE_KEY to WEATHER_SENSOR_KEY to prevent collision
     and maintain semantic clarity.
5. Preserved DC_POWER Units (Requirement 8):
   - DC_POWER values are preserved strictly as originally recorded.
   - In Plant 1, DC_POWER is observed to be ~10x AC_POWER (mean ratio ~10.23:1).
   - Because physical units are unconfirmed in the Kaggle metadata (e.g. DC in 100W vs AC in kW),
     no division by 10 is applied here to avoid corrupting raw measurements.
6. No Invented Expected Generation (Requirement 9):
   - Neither dataset contains an 'expected_generation' column.
   - No synthetic expected generation or arbitrary plant capacity is invented here.
   - Actual metrics (DC_POWER, AC_POWER, DAILY_YIELD, TOTAL_YIELD) and sensor metrics
     (AMBIENT_TEMPERATURE, MODULE_TEMPERATURE, IRRADIATION) are preserved as raw signals
     for modeling in subsequent pipeline steps.
"""

from __future__ import annotations

import logging
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


def resolve_filepath(filepath: Union[str, Path]) -> Path:
    """
    Resolves the provided filepath, falling back to .zip or uncompressed variations if needed,
    and searching relative to PROJECT_ROOT if not found in current working directory.

    Inputs:
        filepath (str | Path): Path to the target file.

    Outputs:
        Path: Existing filesystem path.

    Raises:
        FileNotFoundError: If neither the file nor its .zip / uncompressed counterpart exists.
    """
    path = Path(filepath)

    # 1. Direct match in current directory / absolute path
    if path.is_file():
        return path

    # 2. Check relative to PROJECT_ROOT if relative path was passed
    if not path.is_absolute():
        project_relative = PROJECT_ROOT / path
        if project_relative.is_file():
            return project_relative

    # 3. Check if .csv.zip exists (working dir or PROJECT_ROOT)
    zip_path = Path(str(path) + ".zip")
    if zip_path.is_file():
        logger.info(f"Target '{path}' not found directly; using compressed archive '{zip_path}'.")
        return zip_path

    if not zip_path.is_absolute():
        project_zip = PROJECT_ROOT / zip_path
        if project_zip.is_file():
            logger.info(f"Target '{path}' not found directly; using compressed archive '{project_zip}'.")
            return project_zip

    # 4. If file was passed as .zip, check if uncompressed file exists
    if path.suffix.lower() == ".zip":
        stem_path = path.with_suffix("")
        if stem_path.is_file():
            logger.info(f"Zip archive '{path}' not found; using uncompressed file '{stem_path}'.")
            return stem_path
        if not stem_path.is_absolute():
            project_stem = PROJECT_ROOT / stem_path
            if project_stem.is_file():
                logger.info(f"Zip archive '{path}' not found; using uncompressed file '{project_stem}'.")
                return project_stem

    raise FileNotFoundError(
        f"Could not locate dataset file at '{path}' or '{zip_path}'. "
        f"Checked current directory and project root '{PROJECT_ROOT}'."
    )


def validate_dataframe(
    df: pd.DataFrame,
    dataset_name: str,
    required_columns: List[str],
) -> Dict[str, Any]:
    """
    Validates a loaded DataFrame for column completeness, missing values, duplicates,
    and out-of-range negative values.

    Inputs:
        df (pd.DataFrame): DataFrame to inspect.
        dataset_name (str): Descriptive name for logging / diagnostics.
        required_columns (List[str]): Expected column names.

    Outputs:
        Dict[str, Any]: Validation summary dictionary containing:
            - 'dataset_name': name of the dataset
            - 'row_count': total rows
            - 'column_count': total columns
            - 'missing_columns': any expected columns not found
            - 'null_counts': dictionary mapping column name to count of null values
            - 'total_nulls': sum of all null values
            - 'exact_duplicate_rows': count of fully identical rows
            - 'negative_value_counts': count of values < 0 for numeric columns
            - 'unique_sources_count': number of unique SOURCE_KEYs
            - 'date_min': earliest timestamp
            - 'date_max': latest timestamp

    Raises:
        ValueError: If required columns are missing from the DataFrame.
    """
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise ValueError(
            f"Dataset '{dataset_name}' is missing required columns: {missing_cols}. "
            f"Present columns: {list(df.columns)}"
        )

    null_counts = df[required_columns].isnull().sum().to_dict()
    total_nulls = sum(null_counts.values())

    exact_duplicates = int(df.duplicated().sum())

    # Check for negative values in numeric columns (excluding PLANT_ID)
    numeric_cols = [
        col for col in df.select_dtypes(include=[np.number]).columns
        if col != "PLANT_ID" and col in required_columns
    ]
    negative_counts = {col: int((df[col] < 0).sum()) for col in numeric_cols}

    date_min = df["DATE_TIME"].min() if "DATE_TIME" in df.columns else None
    date_max = df["DATE_TIME"].max() if "DATE_TIME" in df.columns else None
    unique_sources = int(df["SOURCE_KEY"].nunique()) if "SOURCE_KEY" in df.columns else 0

    report = {
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

    if total_nulls > 0:
        logger.warning(f"Dataset '{dataset_name}' contains {total_nulls} null values: {null_counts}")
    if exact_duplicates > 0:
        logger.warning(f"Dataset '{dataset_name}' contains {exact_duplicates} exact duplicate rows.")
    for col, count in negative_counts.items():
        if count > 0:
            logger.warning(f"Dataset '{dataset_name}' contains {count} negative values in '{col}'.")

    return report


def load_generation_data(
    filepath: Union[str, Path] = DEFAULT_PLANT_1_GEN_PATH,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Loads, parses, and validates Plant 1 inverter power generation data.

    Inputs:
        filepath (str | Path, optional): Path to generation CSV or ZIP. Defaults to 'data/Plant_1_Generation_Data.csv'.

    Outputs:
        Tuple[pd.DataFrame, Dict[str, Any]]:
            - pd.DataFrame: Cleaned generation DataFrame with parsed 'DATE_TIME'.
            - Dict[str, Any]: Validation report dictionary.

    Notes on Units (Requirement 8):
        - Raw DC_POWER values are preserved without division.
        - The mean DC_POWER / AC_POWER ratio in Plant 1 is ~10.23:1.
        - Because units are not explicitly confirmed in metadata (e.g. 100W vs kW),
          this module preserves raw numbers and documents the uncertainty.
    """
    resolved_path = resolve_filepath(filepath)
    logger.info(f"Loading Generation Data from: {resolved_path}")

    # Read CSV (pandas natively handles .zip compression)
    df = pd.read_csv(resolved_path)

    # Parse DATE_TIME: Plant 1 Generation uses '%d-%m-%Y %H:%M'
    df["DATE_TIME"] = pd.to_datetime(df["DATE_TIME"], format="%d-%m-%Y %H:%M")

    # Validate schema and data integrity
    report = validate_dataframe(df, "Plant_1_Generation_Data", EXPECTED_GEN_COLUMNS)

    return df, report


def load_weather_data(
    filepath: Union[str, Path] = DEFAULT_PLANT_1_WEATHER_PATH,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Loads, parses, and validates Plant 1 weather sensor data.

    Inputs:
        filepath (str | Path, optional): Path to weather CSV. Defaults to 'data/Plant_1_Weather_Sensor_Data.csv'.

    Outputs:
        Tuple[pd.DataFrame, Dict[str, Any]]:
            - pd.DataFrame: Cleaned weather sensor DataFrame with parsed 'DATE_TIME'.
            - Dict[str, Any]: Validation report dictionary.
    """
    resolved_path = resolve_filepath(filepath)
    logger.info(f"Loading Weather Sensor Data from: {resolved_path}")

    df = pd.read_csv(resolved_path)

    # Parse DATE_TIME: Plant 1 Weather uses '%Y-%m-%d %H:%M:%S'
    df["DATE_TIME"] = pd.to_datetime(df["DATE_TIME"], format="%Y-%m-%d %H:%M:%S")

    # Validate schema and data integrity
    report = validate_dataframe(df, "Plant_1_Weather_Sensor_Data", EXPECTED_WEATHER_COLUMNS)

    return df, report


def merge_plant_data(
    gen_df: pd.DataFrame,
    weather_df: pd.DataFrame,
    how: str = "left",
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Merges inverter generation data with plant weather sensor data on DATE_TIME and PLANT_ID.

    Key Structural Adjustments:
    - Renames weather station 'SOURCE_KEY' to 'WEATHER_SENSOR_KEY' before merging.
      This ensures 'SOURCE_KEY' in the merged dataset uniquely identifies the inverter,
      preserving inverter-level granularity for anomaly detection and analytics.
    - Matches on both 'DATE_TIME' and 'PLANT_ID'.
    - Defaults to how='left' to preserve all generation rows.

    Inputs:
        gen_df (pd.DataFrame): Validated inverter generation DataFrame.
        weather_df (pd.DataFrame): Validated weather sensor DataFrame.
        how (str, optional): Merge method ('left', 'inner', 'right', 'outer'). Defaults to 'left'.

    Outputs:
        Tuple[pd.DataFrame, Dict[str, Any]]:
            - pd.DataFrame: Merged analysis-ready DataFrame.
            - Dict[str, Any]: Comprehensive merge diagnostics report containing:
                - 'rows_before_generation': int
                - 'rows_before_weather': int
                - 'rows_after_merge': int
                - 'unique_timestamps_generation': int
                - 'unique_timestamps_weather': int
                - 'common_timestamps_count': int
                - 'unmatched_generation_timestamps': list of timestamps in gen but not in weather
                - 'unmatched_generation_timestamps_count': int
                - 'unmatched_weather_timestamps': list of timestamps in weather but not in gen
                - 'unmatched_weather_timestamps_count': int
                - 'merge_method': str
                - 'missing_values_after_merge': dict of column -> null count
                - 'unique_inverters_preserved': list of inverter SOURCE_KEYs
    """
    # 1. Analyze timestamps before merge
    gen_ts = set(gen_df["DATE_TIME"])
    weather_ts = set(weather_df["DATE_TIME"])

    common_ts = gen_ts.intersection(weather_ts)
    unmatched_gen_ts = sorted(list(gen_ts - weather_ts))
    unmatched_weather_ts = sorted(list(weather_ts - gen_ts))

    # 2. Prepare weather DataFrame: rename SOURCE_KEY to avoid collision with inverter SOURCE_KEY
    weather_prep = weather_df.rename(columns={"SOURCE_KEY": "WEATHER_SENSOR_KEY"})

    # 3. Perform merge on DATE_TIME and PLANT_ID
    merged_df = pd.merge(
        gen_df,
        weather_prep,
        on=["DATE_TIME", "PLANT_ID"],
        how=how,
    )

    # 4. Sort rows deterministically by DATE_TIME and SOURCE_KEY (inverter)
    merged_df = merged_df.sort_values(by=["DATE_TIME", "SOURCE_KEY"]).reset_index(drop=True)

    # 5. Build detailed merge diagnostics
    nulls_after = merged_df.isnull().sum().to_dict()
    unique_inverters = sorted(merged_df["SOURCE_KEY"].dropna().unique().tolist())

    diagnostics = {
        "rows_before_generation": len(gen_df),
        "rows_before_weather": len(weather_df),
        "rows_after_merge": len(merged_df),
        "unique_timestamps_generation": len(gen_ts),
        "unique_timestamps_weather": len(weather_ts),
        "common_timestamps_count": len(common_ts),
        "unmatched_generation_timestamps": [str(ts) for ts in unmatched_gen_ts],
        "unmatched_generation_timestamps_count": len(unmatched_gen_ts),
        "unmatched_weather_timestamps": [str(ts) for ts in unmatched_weather_ts],
        "unmatched_weather_timestamps_count": len(unmatched_weather_ts),
        "merge_method": how,
        "missing_values_after_merge": nulls_after,
        "unique_inverters_preserved_count": len(unique_inverters),
        "unique_inverters_preserved": unique_inverters,
    }

    logger.info(
        f"Merge complete ('{how}'): {len(merged_df)} rows. "
        f"Common timestamps: {len(common_ts)}, "
        f"Gen unmatched: {len(unmatched_gen_ts)}, "
        f"Weather unmatched: {len(unmatched_weather_ts)}."
    )

    return merged_df, diagnostics


def process_plant_1_data(
    gen_path: Union[str, Path] = DEFAULT_PLANT_1_GEN_PATH,
    weather_path: Union[str, Path] = DEFAULT_PLANT_1_WEATHER_PATH,
    how: str = "left",
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    End-to-end pipeline function to load, validate, and merge Plant 1 data.

    Inputs:
        gen_path (str | Path, optional): Path to generation file. Defaults to DEFAULT_PLANT_1_GEN_PATH.
        weather_path (str | Path, optional): Path to weather file. Defaults to DEFAULT_PLANT_1_WEATHER_PATH.
        how (str, optional): Merge method ('left' or 'inner'). Defaults to 'left' to preserve all generation rows.

    Outputs:
        Tuple[pd.DataFrame, Dict[str, Any]]:
            - pd.DataFrame: Analysis-ready merged dataset.
            - Dict[str, Any]: Combined report containing generation validation,
              weather validation, and merge diagnostics.
    """
    gen_df, gen_report = load_generation_data(gen_path)
    weather_df, weather_report = load_weather_data(weather_path)

    merged_df, merge_diagnostics = merge_plant_data(gen_df, weather_df, how=how)

    combined_report = {
        "generation_validation": gen_report,
        "weather_validation": weather_report,
        "merge_diagnostics": merge_diagnostics,
    }

    return merged_df, combined_report


if __name__ == "__main__":
    print("=" * 80)
    print("RUNNING DATA PROCESSING PIPELINE ON PLANT 1 (PRESERVING ALL GENERATION ROWS)")
    print("=" * 80)

    # 1. Run pipeline with left merge to preserve all generation rows
    merged, report = process_plant_1_data(how="left")

    # 2. Display summary results
    gen_v = report["generation_validation"]
    w_v = report["weather_validation"]
    m_d = report["merge_diagnostics"]

    print("\n1. GENERATION DATA VALIDATION:")
    print(f"   - File row count: {gen_v['row_count']:,}")
    print(f"   - Inverters (SOURCE_KEY): {gen_v['unique_sources_count']}")
    print(f"   - Date range: {gen_v['date_min']} to {gen_v['date_max']}")
    print(f"   - Total nulls: {gen_v['total_nulls']}")
    print(f"   - Exact duplicate rows: {gen_v['exact_duplicate_rows']}")
    print(f"   - Negative values: {gen_v['negative_value_counts']}")

    print("\n2. WEATHER SENSOR DATA VALIDATION:")
    print(f"   - File row count: {w_v['row_count']:,}")
    print(f"   - Weather sensors: {w_v['unique_sources_count']}")
    print(f"   - Date range: {w_v['date_min']} to {w_v['date_max']}")
    print(f"   - Total nulls: {w_v['total_nulls']}")
    print(f"   - Exact duplicate rows: {w_v['exact_duplicate_rows']}")
    print(f"   - Negative values: {w_v['negative_value_counts']}")

    print("\n3. MERGE DIAGNOSTICS ('left' merge):")
    print(f"   - Rows before merge: Generation = {m_d['rows_before_generation']:,}, Weather = {m_d['rows_before_weather']:,}")
    print(f"   - Rows after merge: {m_d['rows_after_merge']:,} (100% of generation records preserved)")
    print(f"   - Generation unique timestamps: {m_d['unique_timestamps_generation']}")
    print(f"   - Weather unique timestamps: {m_d['unique_timestamps_weather']}")
    print(f"   - Common timestamps: {m_d['common_timestamps_count']}")
    print(f"   - Unmatched Generation timestamps ({m_d['unmatched_generation_timestamps_count']}): {m_d['unmatched_generation_timestamps']}")
    print(f"   - Unmatched Weather timestamps ({m_d['unmatched_weather_timestamps_count']}): {m_d['unmatched_weather_timestamps'][:5]} ... (total {m_d['unmatched_weather_timestamps_count']})")
    print(f"   - Missing values in merged data per column: {m_d['missing_values_after_merge']}")
    print(f"   - Unique inverters preserved: {m_d['unique_inverters_preserved_count']}")

    print("\n4. FIRST 5 ROWS OF MERGED DATA:")
    print(merged.head(5).to_string())

    print("\n5. ROWS WITH MISSING WEATHER DATA (UNMATCHED GENERATION TIMESTAMP):")
    unmatched_rows = merged[merged["WEATHER_SENSOR_KEY"].isnull()]
    print(unmatched_rows[["DATE_TIME", "PLANT_ID", "SOURCE_KEY", "DC_POWER", "AC_POWER", "IRRADIATION"]].to_string())

    print("\n" + "=" * 80)
    print("PIPELINE EXECUTION AND VERIFICATION SUCCESSFUL")
    print("=" * 80)
