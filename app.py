import streamlit as st
import pandas as pd

from data_processing import process_plant_1_data
from anomaly_detection import detect_solar_anomalies

@st.cache_data
def load_plant_data():
    df, _ = process_plant_1_data(how="left")
    analyzed_df, summary = detect_solar_anomalies(df)
    return analyzed_df, summary

try:
    plant_df, anomaly_summary = load_plant_data()
    data_loaded = True
except Exception as e:
    plant_df = pd.DataFrame()
    anomaly_summary = {}
    data_loaded = False
    st.error(f"Could not load plant data: {e}")

# Page setup
st.set_page_config(
    page_title="Solar Plant Health Dashboard",
    page_icon="☀️",
    layout="wide"
)

# Sidebar for testing inputs
st.sidebar.header("⚙️ Test Plant Generation")
st.sidebar.write("Adjust generation values to test dashboard scenarios:")

expected_generation = st.sidebar.number_input(
    "Expected Generation (kWh)",
    min_value=0,
    value=550,
    step=10,
    help="Target energy expected for the plant. Must be 0 or higher."
)

actual_generation = st.sidebar.number_input(
    "Actual Generation (kWh)",
    min_value=0,
    value=483,
    step=10,
    help="Actual energy generated. Must be 0 or higher."
)

# Dynamic calculations (handling expected_generation = 0 safely)
if expected_generation > 0:
    energy_loss = max(0, expected_generation - actual_generation)
    loss_percentage = (energy_loss / expected_generation) * 100
else:
    energy_loss = 0
    loss_percentage = 0.0

# Header
st.title("☀️ Solar Plant Health Dashboard")
st.write("Monitor solar generation and identify unusual performance.")

st.divider()

# --- Section 1: Plant Overview ---
st.subheader("Plant Overview")

col1, col2, col3 = st.columns(3)
col1.metric("Actual Generation", f"{actual_generation} kWh")
col2.metric("Expected Generation", f"{expected_generation} kWh")

delta_text = f"-{loss_percentage:.1f}%" if loss_percentage > 0 else "0.0%"
delta_color_mode = "inverse" if loss_percentage > 0 else "off"

col3.metric(
    "Energy Loss",
    f"{energy_loss:.0f} kWh",
    delta=delta_text,
    delta_color=delta_color_mode
)

st.caption(f"Energy Loss: {loss_percentage:.1f}% of expected generation")

st.divider()

# --- Section 2: Solar Generation Analysis ---
st.subheader("📊 Solar Generation Analysis")
st.write("Daily comparison of expected vs. actual energy generation.")

chart_data = pd.DataFrame({
    "Day": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "Expected Generation (kWh)": [100, 110, 120, 115, 105],
    "Actual Generation (kWh)": [95, 108, 80, 110, 90],
})

st.line_chart(chart_data.set_index("Day"))

st.divider()

# --- Section 3: Plant Health Status ---
st.subheader("Plant Health Status")

if expected_generation == 0:
    st.info("ℹ️ Plant Status: Offline / No Expected Generation (0 kWh)")
elif actual_generation >= expected_generation * 0.9:
    st.success("Plant Status: Healthy")
elif actual_generation >= expected_generation * 0.7:
    st.warning("Plant Status: Needs Attention")
else:
    st.error("Plant Status: Low Generation")

# --- Section 4: Alerts ---
st.subheader("Alerts")

if expected_generation == 0:
    st.info("ℹ️ System Idle: Expected generation is set to 0 kWh.")
elif actual_generation < expected_generation * 0.7:
    st.error("🚨 Critical Alert: Actual generation is critically low (< 70% of expected)!")
elif actual_generation < expected_generation * 0.9:
    st.warning("⚠️ Alert: Actual generation is below expected generation.")
else:
    st.success("✅ No performance alert. Generation is within the expected range.")

# --- Section 5: Real Plant Data & Anomaly Detection ---
st.divider()
st.header("🔍 Real Plant Data & Anomaly Detection")

if data_loaded:
    st.success("Plant 1 dataset loaded successfully.")

    total_records = anomaly_summary["total_records_analyzed"]
    total_anomalies = anomaly_summary["anomalous_records_count"]
    anomaly_rate = anomaly_summary["anomaly_rate_percent"]

    col1, col2, col3 = st.columns(3)
    col1.metric("Readings Analyzed", f"{total_records:,}")
    col2.metric("Detected Anomalies", f"{total_anomalies:,}")
    col3.metric("Anomaly Rate", f"{anomaly_rate:.2f}%")

    st.subheader("Inverter Health Status")
    health_counts = (
        plant_df["HEALTH_STATUS"]
        .value_counts()
        .rename_axis("Health Status")
        .reset_index(name="Readings")
    )
    st.dataframe(health_counts, width="stretch", hide_index=True)

    st.subheader("Recent Anomaly Records")
    anomalies = plant_df[plant_df["IS_ANOMALOUS"]].copy()
    display_columns = [
        "DATE_TIME",
        "SOURCE_KEY",
        "AC_POWER",
        "IRRADIATION",
        "HEALTH_STATUS",
    ]
    st.dataframe(
        anomalies[display_columns].head(20),
        width="stretch",
        hide_index=True,
    )
else:
    st.warning("Real plant data could not be loaded. Check the error shown above.")
