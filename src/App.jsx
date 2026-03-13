import { useState } from "react";

const MONICA_SYSTEM_PROMPT = `You are a strategic business analyst creating a personalized Market Intel Playbook for Monica Poling (monicapoling.com), a business strategist and AI trainer. 

Your tone is warm, direct, and expert — like a trusted advisor who has done their homework. Sophisticated in analysis but avoids jargon like "pipeline," "scale," or "leverage." You are built to impress with ideas, not corporate-speak.

The playbook must feel written specifically for the client, not AI-generated.

You will research the provided URL and return a JSON object with these exact keys. STRICT word counts apply.

Return ONLY valid JSON, no markdown, no preamble. Schema:
{
  "businessName": "string",
  "dateGenerated": "Month YYYY",
  "overview": "Two sentences max, 30 words max. Include the business name.",
  "yourWow": "50 words max. The singular standout thing that makes them remarkable in their industry. Surface it even if not explicit on site.",
  "sleepingGiant": "50 words max. One high-level underserved pillar, service, or content story that should be more elevated — especially on the home page. Explain revenue, status, or opportunity potential.",
  "voiceOfTheIndustry": "50 words max. Their perceived reputation, sentiment, uniqueness. Note whether an about statement is present and findable, if testimonials exist, and whether there is a clear leader voice.",
  "whatOtherLeadersDo": "50 words max. A real competitive organization example and how their leadership elevates the org.",
  "thirtyDayPlaybook": ["bullet 1 (15 words max)", "bullet 2 (15 words max)", "bullet 3 (15 words max)", "bullet 4 (15 words max)"],
  "score": 72,
  "scoreLabel": "Strong foundation. Your story isn't keeping pace with your results.",
  "scoreContext": "One sentence (20 words max) that names ONE specific thing holding the score back — honest, direct, not discouraging."
}

For thirtyDayPlaybook: Based on findings, create exactly 4 action bullets always in this sequence: (1) Most urgent positioning move — specific to what the analysis found, never a generic opener; (2) Reputation/visibility — PR, thought leadership, social proof, leader voice; (3) Fix the pipeline — newsletter, lead magnet, contact form, or whatever is missing; (4) Systemize it with AI — turn the insight into a repeatable process. Keep bullets directional, not prescriptive.

For score: Give an honest 0-100 market positioning score. Most businesses land 45-75. Reserve 80+ for genuinely exceptional positioning. The scoreLabel is one punchy line that captures the gap — specific, not generic. The scoreContext names the single biggest thing holding the score back.`;

async function generatePlaybook(url) {
  const response = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: MONICA_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `You must use the web_search tool to fetch and read the content at this URL before generating any output: ${url}. Do not rely on any prior knowledge about this business. Only use what you find by actually visiting the URL. Then generate the Market Intel Playbook JSON.`
        }
      ]
    })
  });
  const data = await response.json();
  const textBlock = data.content?.find(b => b.type === "text");
  if (!textBlock) throw new Error("No text response received.");
  const clean = textBlock.text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

const sectionEmoji = {
  yourWow: "✨",
  sleepingGiant: "🌵",
  voiceOfTheIndustry: "🎙️",
  whatOtherLeadersDo: "🔭",
  thirtyDayPlaybook: "🗓️"
};

const sectionTitles = {
  yourWow: "Your Unfair Advantage",
  sleepingGiant: "Your Sleeping Giant (Your Institutional Knowledge)",
  voiceOfTheIndustry: "Voice of the Industry",
  whatOtherLeadersDo: "What Other Leaders Do",
  thirtyDayPlaybook: "30-Day Playbook: Claim Your Space"
};

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [playbook, setPlaybook] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState("");

  const handleGenerate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setPlaybook(null);

    const steps = [
      "Pulling up the site...",
      "Reading between the lines...",
      "Finding the Sleeping Giant...",
      "Sizing up the competition...",
      "Writing your playbook..."
    ];
    let i = 0;
    setProgress(steps[0]);
    const interval = setInterval(() => {
      i = (i + 1) % steps.length;
      setProgress(steps[i]);
    }, 2200);

    try {
      const result = await generatePlaybook(url);
      setPlaybook(result);
    } catch (e) {
      setError("Something went wrong generating the playbook. Check the URL and try again.");
    } finally {
      clearInterval(interval);
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0d0d",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: "#f0ece4",
      padding: "0"
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #2a2a2a",
        padding: "32px 40px 28px",
        display: "flex",
        alignItems: "baseline",
        gap: "12px"
      }}>
        <span style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#b8a98a", fontFamily: "'Georgia', serif" }}>Monica Poling</span>
        <span style={{ color: "#3a3a3a", fontSize: "10px" }}>✦</span>
        <span style={{ fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#5a5a5a", fontFamily: "'Georgia', serif" }}>Unfair Advantage Playbook</span>
      </div>

      {/* Hero */}
      <div style={{ padding: "72px 40px 56px", maxWidth: "760px", margin: "0 auto" }}>
        <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#b8a98a", marginBottom: "20px", fontFamily: "'Georgia', serif" }}>Market Intelligence</p>
        <h1 style={{
          fontSize: "clamp(36px, 5vw, 58px)",
          fontWeight: "400",
          lineHeight: "1.1",
          margin: "0 0 24px",
          color: "#f0ece4",
          letterSpacing: "-0.02em"
        }}>
          <span style={{ color: "#b8a98a", fontStyle: "italic" }}>Unfair Advantage</span><br />
          Starts Here.
        </h1>
        <p style={{ fontSize: "17px", lineHeight: "1.7", color: "#8a8070", maxWidth: "520px", margin: "0 0 48px" }}>
          Drop in a website URL. Get a personalized strategic playbook — written in plain language, built around what makes you remarkable.
        </p>

        {/* Input */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !loading && handleGenerate()}
            placeholder="https://yourwebsite.com"
            style={{
              flex: "1",
              minWidth: "260px",
              padding: "16px 20px",
              background: "#1a1a1a",
              border: "1px solid #2e2e2e",
              borderRadius: "4px",
              color: "#f0ece4",
              fontSize: "15px",
              fontFamily: "'Georgia', serif",
              outline: "none",
              transition: "border-color 0.2s"
            }}
            onFocus={e => e.target.style.borderColor = "#b8a98a"}
            onBlur={e => e.target.style.borderColor = "#2e2e2e"}
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !url.trim()}
            style={{
              padding: "16px 32px",
              background: loading ? "#2a2a2a" : "#b8a98a",
              color: loading ? "#5a5a5a" : "#0d0d0d",
              border: "none",
              borderRadius: "4px",
              fontSize: "13px",
              fontFamily: "'Georgia', serif",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              fontWeight: "600"
            }}
          >
            {loading ? "Analyzing..." : "Generate Playbook →"}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ marginTop: "32px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%", background: "#b8a98a",
              animation: "pulse 1.2s ease-in-out infinite"
            }} />
            <p style={{ color: "#8a8070", fontSize: "14px", fontStyle: "italic", margin: 0 }}>{progress}</p>
          </div>
        )}

        {error && (
          <p style={{ color: "#c0705a", fontSize: "14px", marginTop: "20px" }}>{error}</p>
        )}
      </div>

      {/* Playbook Output */}
      {playbook && (
        <div style={{
          maxWidth: "760px",
          margin: "0 auto",
          padding: "0 40px 80px",
          animation: "fadeIn 0.6s ease"
        }}>
          <div style={{ borderTop: "1px solid #2a2a2a", marginBottom: "56px" }} />

          {/* Business name + date */}
          <div style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "28px", fontWeight: "400", color: "#f0ece4", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
              {playbook.businessName}
            </h2>
            <p style={{ fontSize: "12px", color: "#4a9eff", letterSpacing: "0.1em", margin: 0, textTransform: "uppercase" }}>
              ➜ {playbook.dateGenerated}
            </p>
          </div>

          {/* Overview */}
          <div style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#5a5a5a", marginBottom: "12px" }}>Overview</p>
            <p style={{ fontSize: "18px", lineHeight: "1.75", color: "#c8c0b0", margin: 0, fontStyle: "italic" }}>
              {playbook.overview}
            </p>
          </div>

          {/* Sections */}
          {["yourWow", "sleepingGiant", "voiceOfTheIndustry", "whatOtherLeadersDo"].map((key) => (
            <div key={key} style={{
              marginBottom: "44px",
              paddingBottom: "44px",
              borderBottom: "1px solid #1e1e1e"
            }}>
              <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#5a5a5a", marginBottom: "10px" }}>
                {sectionEmoji[key]} {sectionTitles[key]}
              </p>
              <p style={{ fontSize: "16px", lineHeight: "1.8", color: "#d8d0c0", margin: 0 }}>
                {playbook[key]}
              </p>
            </div>
          ))}

          {/* 30-Day Playbook */}
          <div style={{
            background: "#141414",
            border: "1px solid #2a2a2a",
            borderRadius: "6px",
            padding: "36px 40px"
          }}>
            <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#b8a98a", marginBottom: "24px" }}>
              {sectionEmoji.thirtyDayPlaybook} {sectionTitles.thirtyDayPlaybook}
            </p>
            {playbook.thirtyDayPlaybook?.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "16px", marginBottom: i < playbook.thirtyDayPlaybook.length - 1 ? "20px" : 0 }}>
                <span style={{ color: "#b8a98a", fontSize: "13px", fontWeight: "600", minWidth: "20px", paddingTop: "2px" }}>{i + 1}.</span>
                <p style={{ fontSize: "16px", lineHeight: "1.7", color: "#d8d0c0", margin: 0 }}>{item}</p>
              </div>
            ))}
          </div>

          {/* Score */}
          {playbook.score && (
            <div style={{
              marginTop: "40px",
              padding: "40px",
              background: "#0f0f0f",
              border: "1px solid #2a2a2a",
              borderRadius: "6px",
              animation: "fadeIn 0.8s ease 0.3s both"
            }}>
              <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#5a5a5a", marginBottom: "20px" }}>⚡ Market Positioning Score</p>

              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "16px" }}>
                <span style={{
                  fontSize: "72px",
                  fontWeight: "400",
                  lineHeight: "1",
                  color: playbook.score >= 75 ? "#7ec98a" : playbook.score >= 55 ? "#b8a98a" : "#c0705a",
                  letterSpacing: "-0.04em"
                }}>{playbook.score}</span>
                <span style={{ fontSize: "24px", color: "#3a3a3a", paddingBottom: "8px" }}>/100</span>
              </div>

              <div style={{ background: "#1e1e1e", borderRadius: "2px", height: "4px", marginBottom: "20px", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${playbook.score}%`,
                  background: playbook.score >= 75 ? "#7ec98a" : playbook.score >= 55 ? "#b8a98a" : "#c0705a",
                  borderRadius: "2px",
                  transition: "width 1.2s ease",
                  animation: "scoreBar 1.2s ease forwards"
                }} />
              </div>

              <p style={{ fontSize: "18px", color: "#f0ece4", margin: "0 0 8px", lineHeight: "1.5" }}>
                {playbook.scoreLabel}
              </p>
              <p style={{ fontSize: "14px", color: "#6a6060", margin: "0 0 32px", lineHeight: "1.6", fontStyle: "italic" }}>
                {playbook.scoreContext}
              </p>

              <div style={{
                borderTop: "1px solid #2a2a2a",
                paddingTop: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "16px"
              }}>
                <p style={{ fontSize: "15px", color: "#8a8070", margin: 0, maxWidth: "340px", lineHeight: "1.6" }}>
                  Want to close that gap?  Let&#39;s talk about your unfair advantage.
                </p>
                
                  <a href="https://monicapoling.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "14px 28px",
                    background: "#b8a98a",
                    color: "#0d0d0d",
                    borderRadius: "4px",
                    fontSize: "13px",
                    fontFamily: "'Georgia', serif",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontWeight: "600",
                    textDecoration: "none",
                    whiteSpace: "nowrap"
                  }}
                >
                  Book a Strategy Call →
                </a>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: "48px", paddingTop: "28px", borderTop: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <p style={{ fontSize: "13px", color: "#3a3a3a", margin: 0 }}>Monica Poling · monicapoling.com</p>
            <button
              onClick={() => { setPlaybook(null); setUrl(""); }}
              style={{
                padding: "10px 20px",
                background: "transparent",
                border: "1px solid #2e2e2e",
                borderRadius: "4px",
                color: "#5a5a5a",
                fontSize: "12px",
                fontFamily: "'Georgia', serif",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer"
              }}
            >
              New Playbook
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scoreBar {
          from { width: 0%; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: #3a3a3a; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
