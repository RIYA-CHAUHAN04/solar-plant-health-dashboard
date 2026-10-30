import { SolarAssistant } from "./solarAssistant";

export default function App() {
  // Existing state in your dashboard
  const [selectedInverter, setSelectedInverter] = useState("All Inverters");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Your existing Navbar, KPI Cards, and Charts */}
      {/* ... */}

      {/* Floating Chatbot Assistant */}
      <SolarAssistant
        selectedInverter={selectedInverter}
        metrics={{
          healthScore: 0.0,
          totalLossKwh: 17174317.9,
          anomalyCount: 245,
          activeInverters: 5,
        }}
      />
    </div>
  );
}