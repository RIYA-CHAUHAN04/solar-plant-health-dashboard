import streamlit as st
import pandas as pd

# Page Configuration
st.set_page_config(page_title="Solar Sense AI", layout="wide", initial_sidebar_state="expanded")

# --- SIDEBAR NAVIGATION ---
with st.sidebar:
    st.markdown("### ☀️ SOLAR SENSE AI")
    st.caption("MONITOR • DETECT • OPTIMIZE")
    
    selected_page = st.radio(
        "Navigation",
        ["Overview", "Plant Analytics", "Inverter Health", "Anomaly Detection", "Alerts", "Settings"],
        index=5,  # Defaults to Settings for testing
        label_visibility="collapsed"
    )
    
    st.divider()
    st.caption("PLANT TELEMETRY CONTROLS")
    inverter_scope = st.selectbox("Inverter Scope", ["All Inverters (Plant Total)", "Inverter 1", "Inverter 2"])
    fault_sensitivity = st.slider("Fault Sensitivity", 10, 50, 25, format="%d%%")
    weather_overlay = st.checkbox("Weather Overlay", value=True)
    faults_only = st.checkbox("Faults Only", value=False)

# --- SETTINGS VIEW ---
if selected_page == "Settings":
    st.title("⚙️ System & Plant Settings")
    st.caption("Configure your user profile, plant identifiers, telemetry data sources, and dashboard preferences.")
    
    # Create the 4 tabs with icons
    tab1, tab2, tab3, tab4 = st.tabs([
        "👤 User Profile", 
        "🆔 Customer & Plant ID", 
        "🗄️ Data Management", 
        "🎛️ Dashboard Configuration"
    ])
    
    # 1. USER PROFILE
    with tab1:
        st.subheader("Operator Profile & Notifications")
        col1, col2 = st.columns(2)
        with col1:
            st.text_input("Operator Name", value="Riya Chauhan")
            st.text_input("Email Address", value="operator@solarsense.ai")
            st.selectbox("Role", ["Lead Plant Engineer", "Grid Operator", "System Administrator", "Viewer"])
        with col2:
            st.text_input("Contact Number", value="+91 98765 43210")
            st.multiselect(
                "Alert Notification Channels",
                ["Email", "SMS", "WhatsApp", "In-App Push", "Webhook"],
                default=["Email", "In-App Push"]
            )
            st.selectbox("Shift Schedule", ["Day Shift (06:00 - 18:00)", "Night Shift", "24/7 On-Call"])
            
        if st.button("Save Profile Changes", type="primary"):
            st.success("User profile updated successfully!")

    # 2. CUSTOMER ID & PLANT DETAILS
    with tab2:
        st.subheader("Customer ID & Solar Plant Metadata")
        col1, col2 = st.columns(2)
        with col1:
            st.text_input("Customer ID", value="CUST-SOLAR-2026-8841", disabled=True)
            st.text_input("Plant Registration Code", value="IND-UP-PLANT-01")
            st.number_input("Installed Capacity (MWp)", value=50.0, step=0.5)
        with col2:
            st.text_input("Grid Substation ID", value="SUB-NR-440KV")
            st.text_input("Location Coordinates", value="26.8467° N, 80.9462° E")
            st.text_input("API / SCADA Integration Key", value="sk_live_983749823749283", type="password")
            
        if st.button("Update Plant Metadata", type="primary"):
            st.success("Customer and Plant ID settings saved!")

    # 3. DATA MANAGEMENT
    with tab3:
        st.subheader("Telemetry Data & CSV Management")
        st.info("Currently active dataset: **Plant_1_Generation_Data.csv** (68,778 readings loaded)")
        
        uploaded_file = st.file_uploader(
            "Upload New Plant CSV File (Required columns: DATE_TIME, SOURCE_KEY, AC_POWER)", 
            type=["csv"]
        )
        
        col1, col2, col3 = st.columns(3)
        with col1:
            st.selectbox("Data Retention Policy", ["30 Days", "90 Days", "1 Year", "Archive Forever"], index=2)
        with col2:
            st.selectbox("Missing Data Imputation", ["Linear Interpolation", "Forward Fill", "Drop Null Rows"])
        with col3:
            st.selectbox("Sampling Frequency", ["15 Minutes (Default)", "5 Minutes", "1 Hour"])
            
        st.divider()
        c1, c2 = st.columns([1, 4])
        with c1:
            if st.button("🗑️ Clear Cached Data"):
                st.warning("Active dataset cache cleared.")
        with c2:
            if st.button("📥 Export Processed Telemetry (CSV)"):
                st.success("Preparing download...")

    # 4. DASHBOARD CONFIGURATION
    with tab4:
        st.subheader("UI Preferences & AI Anomaly Thresholds")
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("##### Display & Refresh")
            st.selectbox("Theme Mode", ["Dark Emerald (Default)", "High Contrast Dark", "Light Mode"])
            st.selectbox("Auto-Refresh Interval", ["Off", "30 Seconds", "1 Minute", "5 Minutes", "15 Minutes"], index=2)
            st.selectbox("Power Unit Display", ["kW (Kilowatts)", "MW (Megawatts)", "W (Watts)"])
        with col2:
            st.markdown("##### AI & Inverter Alert Rules")
            st.slider("DC/AC Conversion Efficiency Alert Threshold (%)", 70, 99, 88)
            st.slider("Inverter Over-Temperature Warning (°C)", 50, 90, 75)
            st.toggle("Enable Predictive Maintenance Forecasting", value=True)
            st.toggle("Auto-acknowledge minor low-irradiance warnings", value=False)
            
        if st.button("Apply Dashboard Configuration", type="primary"):
            st.success("Dashboard configuration applied!")
    )
else:
    st.warning("Real plant data could not be loaded. Check the error shown above.")
