"""main.py
Runner script linking data processing and anomaly detection.
"""

from data_processing import process_plant_1_data
from anomaly_detection import detect_solar_anomalies

def main():
    print("Step 1: Ingesting and merging Plant 1 data...")
    merged_df, proc_report = process_plant_1_data(how="left")
    print(f"Data merged successfully. Total records: {len(merged_df):,}")

    print("\nStep 2: Scanning for anomalies and inverter faults...")
    analyzed_df, anomaly_report = detect_solar_anomalies(merged_df)

    print("\n" + "=" * 60)
    print("ANOMALY DETECTION SUMMARY")
    print("=" * 60)
    print(f"Total Rows Scanned:  {anomaly_report['total_records_analyzed']:,}")
    print(f"Anomalous Records:   {anomaly_report['anomalous_records_count']:,} ({anomaly_report['anomaly_rate_percent']}%)")
    
    print("\nFault Breakdown:")
    for fault, count in anomaly_report["breakdown"].items():
        print(f"  - {fault:32s}: {count:,}")

    # Export results for dashboarding / further analysis
    output_path = "data/Plant_1_Analyzed_Anomalies.csv"
    analyzed_df.to_csv(output_path, index=False)
    print(f"\nSaved annotated dataset to: {output_path}")

if __name__ == "__main__":
    main()