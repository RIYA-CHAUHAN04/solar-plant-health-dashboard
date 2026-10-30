const http = require("http");

// ⚠️ PASTE YOUR REAL GEMINI API KEY BELOW (No spaces inside the quotes)
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    throw new Error("Gemini API key is missing!");
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
const PORTFOLIO_DATA = `
Name: Tejesh Goyal
Role: B.Tech Computer Science & Engineering Student (Section AA)
University: GLA University, Mathura, Uttar Pradesh (Enrolled 2026)
Schooling: Completed Class 12th (Board of School Education Haryana)
Technical Skills: Python, Java, C++, Node.js, Streamlit, Pandas, NumPy, LangChain, ChromaDB, Git, GitHub
Core Coursework: Programming for Problem Solving (Java), Foundations of AI, Digital Electronics, Basic Electronics & Semiconductor Devices, Design Thinking
Key Projects & Achievements:
1. Solar Plant Health Dashboard (Deviathon 48-Hour Hackathon - Tech for Impact Track): Built an anomaly detection system (anomaly-detection.py) using Python, Streamlit, Pandas, and NumPy to monitor solar plant efficiency and detect faults.
2. Federated Learning Study & Presentation: Conducted Foundations of AI coursework evaluation on privacy-preserving decentralized machine learning.
3. AI & Systems Architecture Research: Designed technical architectures for a RAG-based Academic PDF Q&A Assistant (LangChain + ChromaDB) and a multi-language Online Judge coding assessment platform.
4. Capgemini Brand Quest 2026: Completed Level 1 challenge.
`;

const HTML_UI = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tejesh Goyal | AI Portfolio</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #0b0f19;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }
    .dashboard {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 24px;
      max-width: 1100px;
      width: 100%;
    }
    @media (max-width: 850px) {
      .dashboard { grid-template-columns: 1fr; }
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    .badge-title {
      display: inline-block;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    h1 { font-size: 26px; margin-bottom: 6px; color: #ffffff; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 20px; }
    .section-title {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin: 18px 0 10px;
      font-weight: 700;
    }
    .skills { display: flex; flex-wrap: wrap; gap: 8px; }
    .skill-tag {
      background: #0f172a;
      border: 1px solid #334155;
      color: #e2e8f0;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 13px;
    }
    .project-item {
      background: #0f172a;
      border-left: 3px solid #3b82f6;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 10px;
      font-size: 13.5px;
    }
    .project-item strong { color: #93c5fd; display: block; margin-bottom: 4px; }
    
    /* Chat Column */
    .chat-panel { display: flex; flex-direction: column; height: 600px; }
    .chat-header {
      border-bottom: 1px solid #334155;
      padding-bottom: 14px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .status-dot {
      height: 10px; width: 10px; background: #22c55e;
      border-radius: 50%; display: inline-block; margin-right: 6px;
    }
    #chat-box {
      flex: 1;
      overflow-y: auto;
      padding-right: 6px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .msg {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14.5px;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .user {
      background: #2563eb;
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 2px;
    }
    .bot {
      background: #0f172a;
      border: 1px solid #334155;
      color: #e2e8f0;
      align-self: flex-start;
      border-bottom-left-radius: 2px;
    }
    .chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 12px 0;
    }
    .chip {
      background: #0f172a;
      border: 1px solid #3b82f6;
      color: #93c5fd;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      cursor: pointer;
      transition: 0.2s;
    }
    .chip:hover { background: #2563eb; color: white; }
    .input-row { display: flex; gap: 10px; margin-top: 8px; }
    input {
      flex: 1;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid #475569;
      background: #0f172a;
      color: white;
      font-size: 14px;
      outline: none;
    }
    input:focus { border-color: #3b82f6; }
    button {
      padding: 12px 20px;
      background: #3b82f6;
      color: white;
      font-weight: 600;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: 0.2s;
    }
    button:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="dashboard">
    <!-- Left Column: Live Portfolio Summary -->
    <div class="card">
      <span class="badge-title">PORTFOLIO OVERVIEW</span>
      <h1>Tejesh Goyal</h1>
      <p class="subtitle">B.Tech CSE Student @ GLA University, Mathura</p>

      <div class="section-title">Technical Skills</div>
      <div class="skills">
        <span class="skill-tag">Python</span>
        <span class="skill-tag">Java</span>
        <span class="skill-tag">C++</span>
        <span class="skill-tag">Node.js</span>
        <span class="skill-tag">Pandas & NumPy</span>
        <span class="skill-tag">Streamlit</span>
        <span class="skill-tag">Git & GitHub</span>
      </div>

      <div class="section-title">Featured Projects</div>
      <div class="project-item">
        <strong>☀️ Solar Plant Health Dashboard (Deviathon Hackathon)</strong>
        Built <code>anomaly-detection.py</code> with Python, Pandas, NumPy, and Streamlit to analyze plant telemetry and detect anomalies.
      </div>
      <div class="project-item">
        <strong>🧠 Federated Learning (Foundations of AI)</strong>
        Research presentation & study guide on decentralized privacy-preserving machine learning models.
      </div>
      <div class="project-item">
        <strong>📚 RAG Academic Assistant & Online Judge Architecture</strong>
        System design using LangChain, ChromaDB, and multi-language code execution sandboxes.
      </div>
    </div>

    <!-- Right Column: Interactive AI Assistant -->
    <div class="card chat-panel">
      <div class="chat-header">
        <div>
          <strong>🤖 Tejesh's Digital Twin</strong>
          <div style="font-size: 12px; color: #94a3b8;">Powered by Gemini 2.5 Flash</div>
        </div>
        <div style="font-size: 12px; color: #22c55e;">
          <span class="status-dot"></span>Online
        </div>
      </div>

      <div id="chat-box">
        <div class="msg bot">Hi! I'm Tejesh's AI portfolio assistant. Click a prompt below or ask me anything about his projects, skills, or education!</div>
      </div>

      <div class="chips">
        <span class="chip" onclick="askChip('Tell me about Tejesh\\'s Solar Plant Hackathon project')">☀️ Solar Hackathon Project</span>
        <span class="chip" onclick="askChip('What programming languages and tools does Tejesh know?')">💻 Tech Stack</span>
        <span class="chip" onclick="askChip('Where is Tejesh studying and what are his subjects?')">🎓 Education & Courses</span>
      </div>

      <div class="input-row">
        <input type="text" id="question" placeholder="Ask about skills, projects, or education..." onkeypress="if(event.key==='Enter') sendMessage()" />
        <button onclick="sendMessage()">Send</button>
      </div>
    </div>
  </div>

  <script>
    function askChip(text) {
      document.getElementById("question").value = text;
      sendMessage();
    }

    async function sendMessage() {
      const input = document.getElementById("question");
      const box = document.getElementById("chat-box");
      const text = input.value.trim();
      if (!text) return;

      box.innerHTML += '<div class="msg user">' + text + '</div>';
      input.value = "";
      box.scrollTop = box.scrollHeight;

      const loadingId = "load-" + Date.now();
      box.innerHTML += '<div class="msg bot" id="' + loadingId + '">Thinking...</div>';
      box.scrollTop = box.scrollHeight;

      try {
        const res = await fetch("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text })
        });
        const data = await res.json();
        document.getElementById(loadingId).innerText = data.reply;
      } catch (err) {
        document.getElementById(loadingId).innerText = "Network error: " + err.message;
      }
      box.scrollTop = box.scrollHeight;
    }
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(HTML_UI);
  }

  if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", async () => {
      try {
        if (!API_KEY || API_KEY === "YOUR_GEMINI_API_KEY") {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({
            reply: "⚠️ API Key Missing: Set GEMINI_API_KEY in your terminal and restart the server."
          }));
        }

        const { question } = JSON.parse(body);
        const promptText = `You are the AI Portfolio Assistant for Tejesh Goyal. Answer the visitor's question professionally, enthusiastically, and concisely using the portfolio data below.\n\nPORTFOLIO DATA:\n${PORTFOLIO_DATA}\n\nVISITOR QUESTION: ${question}`;

        const apiRes = await fetch(GEMINI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        });

        const data = await apiRes.json();

        // Surface the exact error from Google if the API key or request fails
        if (data.error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({
            reply: "⚠️ Gemini API Error: " + data.error.message
          }));
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No text returned from model.";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply: "⚠️ Server Error: " + err.message }));
      }
    });
  }
});

server.listen(3000, () => {
  console.log("✅ Portfolio Dashboard running at http://localhost:3000");
});