# solar-plant-health-dashboard
Solar plant anomaly detection and energy loss dashboard
# Solar Plant Health Dashboard ☀️

**Problem Statement:** DEV-P01 — Solar Plant Health Dashboard  
**Domain:** Energy & Renewables  
**Team Name:** CodeCraze

## 📌 Project Overview

Solar power plants can experience reduced energy generation due to inverter faults, shading, soiling, temperature variations, and other operational issues. Detecting these problems early helps reduce energy losses and improve plant performance.

The Solar Plant Health Dashboard is a web-based application designed to monitor solar plant performance, identify potential anomalies, estimate energy losses, and display useful insights through an interactive dashboard.

## 🎯 Objectives

- Monitor solar plant generation and performance.
- Identify potential abnormal behaviour in solar plant data.
- Estimate potential energy losses.
- Visualize plant health through charts and performance indicators.
- Support maintenance decisions with anomaly information and alerts.

## ✨ Key Features

- **Performance Monitoring:** View solar generation data and key performance indicators.
- **Anomaly Detection:** Highlight unusual patterns in plant or inverter data.
- **Energy Loss Estimation:** Estimate potential energy losses based on the available data and implemented logic.
- **Interactive Dashboard:** Explore generation trends, charts, and plant health metrics.
- **Data Upload:** Upload supported CSV files for analysis, where supported by the application.
- **Alerts and Insights:** Review detected anomalies and potential operational issues.

## 🛠️ Technology Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **Data Processing:** Pandas
- **Visualization:** Dashboard charts and data visualizations
- **Version Control:** Git and GitHub
- **Deployment:** Vercel (frontend) and Render (backend), if deployment is enabled

## 📊 Dataset

The project uses solar plant generation and weather sensor data in CSV format.

The available datasets may include:
- Solar power generation readings
- Inverter-related generation information
- Weather measurements, such as temperature and solar irradiation

The analysis depends on the data provided and the datasets supported by the application.

## 🚀 Getting Started

### Prerequisites

Install the following tools:
- Python
- Node.js and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/RIYA-CHAUHAN04/solar-plant-health-dashboard.git
cd solar-plant-health-dashboard
```

### 2. Set Up the Backend

Create and activate a Python virtual environment if required, then install the backend dependencies listed in the project's dependency file.

Run the backend using the command configured for the project. For example, if the application entry point is `api.py` and it exposes a FastAPI app named `app`:

```bash
py -m pip install -r requirements.txt
py -m uvicorn api:app --reload
```

If the project uses a different entry point or dependency file, follow its actual configuration.

### 3. Set Up the Frontend

Open a terminal in the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

On Windows PowerShell, if `npm run dev` is blocked by the execution policy, try:

```powershell
npm.cmd run dev
```

Open the local URL printed in the terminal.

## 🌐 Deployment

The application can be deployed with:
- **Frontend:** Vercel
- **Backend:** Render

The frontend must be configured to call the correct backend API URL. The backend must allow requests from the deployed frontend origin.

Live demo: Add the verified Vercel URL here.

Backend API: Add the verified Render URL here.

## 👥 Team

**Team CodeCraze**

This project is being developed for Deviathon under the *Tech for Impact* theme.

## 🔮 Future Improvements

- Improve anomaly detection and validation.
- Enhance energy-loss estimation.
- Add more robust weather and generation data integration.
- Improve dashboard loading performance and error handling.
- Add more detailed maintenance insights.

## 📄 Disclaimer

Anomaly flags and energy-loss values are estimates generated using the project's implemented logic and available data. They should not be treated as confirmed equipment faults or exact financial losses without further validation.