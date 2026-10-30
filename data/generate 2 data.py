import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def generate_solar_plant_data():
    np.random.seed(42)
    
    # 24-hour timestamps at 15-minute intervals (96 intervals)
    start_time = datetime(2026, 10, 30, 0, 0)
    timestamps = [start_time + timedelta(minutes=15 * i) for i in range(96)]
    
    # Generate diurnal sunlight curve (bell curve peaking around 12:30 PM)
    hours = np.array([t.hour + t.minute / 60.0 for t in timestamps])
    
    # Realistic solar irradiation (W/m^2): peak ~950 W/m^2 between 06:00 and 18:30
    irradiation = np.maximum(0, np.sin(np.pi * (hours - 6) / 12.5)) ** 1.8 * 950
    irradiation[hours < 6.0] = 0.0
    irradiation[hours > 18.5] = 0.0
    
    # Ambient and module temperature (deg C)
    ambient_temp = 20 + 12 * np.sin(np.pi * (hours - 8) / 14)
    module_temp = ambient_temp + (irradiation / 1000.0) * 28.0

    # Define inverters: 3 normal, 2 with distinct faults
    inverters = [
        {"id": "INV-01", "type": "Normal"},
        {"id": "INV-02", "type": "Normal"},
        {"id": "INV-03", "type": "Normal"},
        {"id": "INV-04", "type": "Midday_Trip"},       # Midday breaker trip
        {"id": "INV-05", "type": "String_Disconnect"}  # Permanent partial loss
    ]
    
    records = []
    
    for inv in inverters:
        inv_id = inv["id"]
        inv_type = inv["type"]
        
        daily_yield = 0.0
        
        for t, h, irr, m_temp in zip(timestamps, hours, irradiation, module_temp):
            # Base nominal DC conversion: DC kW ~= (Irradiance / 1000) * 100 kW plant capacity
            dc_nominal = (irr / 1000.0) * 100.0
            
            # Module efficiency drops ~0.4% per deg C over 25 deg C
            thermal_loss = max(0.0, (m_temp - 25.0) * 0.004)
            dc_power = dc_nominal * (1.0 - thermal_loss) + np.random.normal(0, 0.4)
            dc_power = max(0.0, dc_power)
            
            # Typical inverter efficiency: 97.5%
            ac_power = dc_power * 0.975 if dc_power > 0.5 else 0.0

            # --- FAULT INJECTIONS ---
            # Fault 1: Midday Inverter Trip (INV-04 fails completely between 11:30 and 13:45)
            if inv_type == "Midday_Trip" and 11.5 <= h <= 13.75:
                dc_power = 0.0
                ac_power = 0.0

            # Fault 2: String Disconnect / Heavy Soiling (INV-05 loses ~40% output throughout the day)
            elif inv_type == "String_Disconnect" and irr > 50:
                dc_power *= 0.60
                ac_power = dc_power * 0.965

            # Accumulate daily yield in kWh (power * 0.25 hours)
            daily_yield += ac_power * 0.25
            
            records.append({
                "timestamp": t.strftime("%Y-%m-%d %H:%M:%S"),
                "inverter_id": inv_id,
                "irradiation": round(float(irr), 2),
                "ambient_temp": round(float(m_temp - 20), 2),
                "module_temp": round(float(m_temp), 2),
                "dc_power": round(float(dc_power), 2),
                "ac_power": round(float(ac_power), 2),
                "daily_yield": round(float(daily_yield), 2)
            })
            
    df = pd.DataFrame(records)
    return df

# Save synthetic dataset
df = generate_solar_plant_data()
df.to_csv("solar_generation_with_anomalies.csv", index=False)
print("Saved solar_generation_with_anomalies.csv successfully!")
