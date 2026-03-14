import { useState } from "react";

const PRESTIGE_SYSTEM_PROMPT = `You are a strategic business analyst creating a personalized Prestige Score Report for a small, mid-size, or large business, nonprofit, government entity, or educational institution.

Your tone is warm, direct, and expert — like a trusted advisor who has done their homework. This report could land in front of anyone from a solo founder to a senior executive. It is sophisticated in its analysis but avoids jargon like "pipeline," "scale," "leverage," or "synergy." You are built to impress with ideas, not consultant-speak.

The report should feel like it was written specifically for this organization — not AI generated.

Use the web_search tool to fetch and read the content at the provided URL before generating any output. If the first fetch fails or returns no useful content, try these variations in order:
1. Add or remove a trailing slash
2. Add or remove "www."
3. Try the root domain if a subpage was given
Do NOT rely on LLM memory. Only use what you find by actually visiting the URL.

Return ONLY valid JSON. No markdown, no preamble, no backticks, no citation tags, no XML markup, no annotation syntax of any kind. Clean JSON only. Adhere strictly to word counts per section.

SCORING RUBRIC (internal only, do not output as separate field):
18-20: Exceptional
14-17: Strong with gaps
10-13: Present but underdeveloped
6-9: Weak signal
0-5: Missing or unclear

JSON Schema:
{
  "businessName": "string",
  "dateGenerated": "Month YYYY",
  "overview": "Two sentences max. Include full business name. 30 words max.",
  "overallScore": 72,
  "overallDescriptor": "string — one of: Category Leader | Strong Foundation, Underutilized Story | Solid Presence, Clear Gaps | Underdeveloped Positioning | Significant Opportunity",
  "overallSummary": "Two sentences. What's working, what's the primary gap. Specific to this organization. 40 words max.",
  "prestige": {
    "score": 14,
    "content": "40-50 words. Does this organization have a clear category they lead or are claiming? Is their positioning distinct or generic? For nonprofits, government, or education, assess whether their mission is stated with conviction and clarity."
  },
  "origin": {
    "score": 12,
    "content": "40-50 words. For for-profit: is the founder or leader's story visible and compelling? For nonprofit, government, or education: is the founding mission and institutional values present and active — or buried under program listings and compliance language?"
  },
  "wow": {
    "score": 16,
    "content": "40-50 words. Identify the singular standout factor — the thing that makes this organization genuinely different. Also identify the Sleeping Giant: a high-value but underserved pillar, service, or story that should be more elevated. Explain briefly why it's being left on the table."
  },
  "expertise": {
    "score": 10,
    "content": "40-50 words. Look for self-reported proof: credentials, methodologies, case studies, track record, proprietary frameworks, certifications, years of experience. Is the depth of knowledge visible or assumed? Is there a clear demonstration of how they work?"
  },
  "reputation": {
    "score": 8,
    "content": "40-50 words. On-page only. Look for testimonials, client logos, press mentions, embedded reviews, awards, or any third-party validation the organization has chosen to feature. Assess quality, placement, and whether social proof is doing any conversion work."
  },
  "brandPersonality": "40-50 words. Based on tone, language, word choice, and content elements — what personality does this brand project? How is a visitor likely to experience it emotionally? What questions might a visitor have that aren't being answered? Note any friction between the personality projected and what the audience likely expects.",
  "urlsAttempted": ["https://example.com", "https://www.example.com"],
  "fetchSuccess": true,
  "fetchNote": "Optional string — only include if there were issues fetching. Describe what happened."
}

For overallScore: sum the five P-O-W-E-R scores (each out of 20, total out of 100). Use the descriptor that matches:
90-100: Category Leader
75-89: Strong Foundation, Underutilized Story
60-74: Solid Presence, Clear Gaps
45-59: Underdeveloped Positioning
Below 45: Significant Opportunity`;

function normalizeUrl(input) {
  let url = input.trim();
  if (!url) return url;
  // Add protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  // Remove trailing slash for consistency (we'll try both in the prompt)
  url = url.replace(/\/+$/, "");
  return url;
}

async function generatePlaybook(rawUrl) {
  const url = normalizeUrl(rawUrl);

  const response = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: PRESTIGE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate a Prestige Score Report for this organization. Start by fetching: ${url}

If that fetch fails or returns no meaningful content, try these in order:
- ${url}/
- ${url.replace(/^https:\/\//, "https://www.")}
- ${url.replace(/^https:\/\/www\./, "https://")}

Record all URLs you attempted in the urlsAttempted field. Set fetchSuccess to false and explain in fetchNote if you were unable to retrieve useful content from any variation.

Then generate the full Prestige Score Report JSON.`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find(b => b.type === "text");
  if (!textBlock) {
    throw new Error(`No text block in response. Content types received: ${data.content?.map(b => b.type).join(", ") || "none"}`);
  }

  const clean = textBlock.text
    .replace(/```json|```/g, "")
    .replace(/<[^>]*cite[^>]*>/gi, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch (parseErr) {
    throw new Error(`JSON parse failed: ${parseErr.message}\n\nRaw response (first 500 chars):\n${clean.substring(0, 500)}`);
  }
}

const POWER_SECTIONS = [
  { key: "prestige", letter: "P", label: "Prestige", subtitle: "Do You Own Your Category?" },
  { key: "origin",   letter: "O", label: "Origin",   subtitle: "Is Your Story Showing Up?" },
  { key: "wow",      letter: "W", label: "Wow",       subtitle: "What Makes You Unforgettable?" },
  { key: "expertise",letter: "E", label: "Expertise", subtitle: "Are You Proving What You Know?" },
  { key: "reputation",letter:"R", label: "Reputation",subtitle: "Are Others Vouching For You?" },
];

function ScoreBar({ score, max = 20 }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 75 ? "#06472a" : pct >= 55 ? "#861442" : "#8a5a3a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
      <div style={{ flex: 1, background: "#1e1510", borderRadius: "2px", height: "4px", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: "2px",
          transition: "width 1.2s ease"
        }} />
      </div>
      <span style={{ fontSize: "13px", color: "#f2e4ca", fontWeight: "600", minWidth: "36px", textAlign: "right" }}>
        {score}/{max}
      </span>
    </div>
  );
}

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [playbook, setPlaybook] = useState(null);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [progress, setProgress] = useState("");

  const handleGenerate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    setDebugOpen(false);
    setPlaybook(null);

    const steps = [
      "Pulling up the site...",
      "Reading between the lines...",
      "Evaluating your P-O-W-E-R...",
      "Sizing up the landscape...",
      "Writing your Prestige Score Report..."
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
      // Surface fetch issues even on success
      if (!result.fetchSuccess || result.fetchNote) {
        setDebugInfo(
          `Fetch status: ${result.fetchSuccess ? "Success" : "Failed"}\n` +
          `URLs attempted: ${result.urlsAttempted?.join(", ") || "unknown"}\n` +
          (result.fetchNote ? `Note: ${result.fetchNote}` : "")
        );
      }
    } catch (e) {
      setError("Something went wrong generating your Prestige Score Report. Check the URL and try again.");
      setDebugInfo(e.message);
    } finally {
      clearInterval(interval);
      setLoading(false);
      setProgress("");
    }
  };

  const overallColor = playbook
    ? playbook.overallScore >= 75 ? "#06472a"
    : playbook.overallScore >= 55 ? "#861442"
    : "#8a5a3a"
    : "#861442";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#2b211b",
      fontFamily: "'Poppins', 'Georgia', sans-serif",
      color: "#f2e4ca",
      padding: "0"
    }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');

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
        input::placeholder { color: #5a4a3a; }
        * { box-sizing: border-box; }
        button:hover { opacity: 0.88; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #3d2e24",
        padding: "32px 40px 28px",
        display: "flex",
        alignItems: "baseline",
        gap: "12px"
      }}>
        <span style={{ fontSize: "12px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#f9ebea", fontWeight: "500" }}>Monica Poling</span>
        <span style={{ color: "#5a3a2a", fontSize: "10px" }}>✦</span>
        <span style={{ fontSize: "12px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#6a5040", fontWeight: "400" }}>Prestige Score Report</span>
      </div>

      {/* Hero */}
      <div style={{ padding: "80px 40px 64px", maxWidth: "860px", margin: "0 auto" }}>
        <p style={{ fontSize: "11px", letterSpacing: "0.25em", textTransform: "uppercase", color: "#7a6050", marginBottom: "48px", fontWeight: "500" }}>Market Intelligence</p>
        <p style={{ fontSize: "15px", color: "#f2e4ca", margin: "0 0 6px", fontWeight: "400", letterSpacing: "0.01em" }}>Get Your</p>
        <h1 style={{
          fontSize: "clamp(42px, 6vw, 72px)",
          fontWeight: "700",
          lineHeight: "1.05",
          margin: "0 0 24px",
          color: "#861442",
          letterSpacing: "-0.03em",
          fontFamily: "'Poppins', sans-serif"
        }}>
          Prestige Score
        </h1>
        <p style={{ fontSize: "17px", lineHeight: "1.75", color: "#f2e4ca", maxWidth: "560px", margin: "0 0 52px", fontWeight: "300" }}>
          Unlock your Prestige Score to see exactly how your brand, offers, and presence stack up in today's market. Get your score now to reveal hidden opportunities, fix weak spots, and take your next best step with confidence.
        </p>

        {/* Input — full width search bar style */}
        <div style={{ position: "relative", maxWidth: "680px" }}>
          <div style={{
            position: "relative",
            border: "1px solid #3d2e24",
            borderRadius: "6px",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            background: "#1a120e",
            transition: "border-color 0.2s"
          }}
            onFocus={() => {}}
          >
            <span style={{ padding: "0 0 0 20px", color: "#5a4030", fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: "500", whiteSpace: "nowrap" }}>
              Get your Prestige Score
            </span>
            <span style={{ color: "#3d2e24", padding: "0 12px", fontSize: "14px" }}>—</span>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && handleGenerate()}
              placeholder="your-website.com"
              style={{
                flex: "1",
                padding: "20px 16px",
                background: "transparent",
                border: "none",
                color: "#f2e4ca",
                fontSize: "17px",
                fontFamily: "'Poppins', sans-serif",
                outline: "none",
                fontWeight: "300"
              }}
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !url.trim()}
              style={{
                padding: "20px 24px",
                background: "transparent",
                border: "none",
                borderLeft: "1px solid #3d2e24",
                color: loading ? "#4a3020" : "#861442",
                fontSize: "20px",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "color 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {loading ? "⋯" : "→"}
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ marginTop: "32px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%", background: "#861442",
              animation: "pulse 1.2s ease-in-out infinite"
            }} />
            <p style={{ color: "#9a8070", fontSize: "15px", fontStyle: "italic", margin: 0, fontWeight: "300" }}>{progress}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: "20px" }}>
            <p style={{ color: "#c0705a", fontSize: "15px", margin: "0 0 8px" }}>{error}</p>
            {debugInfo && (
              <div>
                <button
                  onClick={() => setDebugOpen(o => !o)}
                  style={{
                    background: "none",
                    border: "1px solid #3d2e24",
                    borderRadius: "3px",
                    color: "#6a5040",
                    fontSize: "12px",
                    fontFamily: "'Poppins', sans-serif",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    padding: "6px 12px"
                  }}
                >
                  {debugOpen ? "Hide" : "Show"} Debug Info
                </button>
                {debugOpen && (
                  <pre style={{
                    marginTop: "10px",
                    padding: "16px",
                    background: "#1e1510",
                    border: "1px solid #3d2e24",
                    borderRadius: "4px",
                    color: "#9a8070",
                    fontSize: "12px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: "1.6"
                  }}>{debugInfo}</pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report Output */}
      {playbook && (
        <div style={{
          maxWidth: "780px",
          margin: "0 auto",
          padding: "0 40px 80px",
          animation: "fadeIn 0.6s ease"
        }}>
          <div style={{ borderTop: "1px solid #3d2e24", marginBottom: "56px" }} />

          {/* Business name + date */}
          <div style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "30px", fontWeight: "400", color: "#f2e4ca", margin: "0 0 8px", letterSpacing: "-0.01em", fontFamily: "'Georgia', serif" }}>
              {playbook.businessName}
            </h2>
            <p style={{ fontSize: "13px", color: "#861442", letterSpacing: "0.1em", margin: 0, textTransform: "uppercase", fontWeight: "500" }}>
              ➜ {playbook.dateGenerated}
            </p>
          </div>

          {/* Overview */}
          <div style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#5a4a3a", marginBottom: "12px", fontWeight: "500" }}>Overview</p>
            <p style={{ fontSize: "14px", lineHeight: "1.75", color: "#c8b8a0", margin: 0, fontStyle: "italic", fontFamily: "'Georgia', serif", fontWeight: "300" }}>
              {playbook.overview}
            </p>
          </div>

          {/* Overall Score */}
          <div style={{
            background: "#1e1510",
            border: "1px solid #3d2e24",
            borderRadius: "6px",
            padding: "36px 40px",
            marginBottom: "48px"
          }}>
            <p style={{ fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#5a4a3a", marginBottom: "20px", fontWeight: "500" }}>⚡ Overall Prestige Score</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "16px" }}>
              <span style={{ fontSize: "76px", fontWeight: "300", lineHeight: "1", color: overallColor, letterSpacing: "-0.04em", fontFamily: "'Georgia', serif" }}>
                {playbook.overallScore}
              </span>
              <span style={{ fontSize: "26px", color: "#3d2e24", paddingBottom: "8px" }}>/100</span>
            </div>
            <div style={{ background: "#2b211b", borderRadius: "2px", height: "4px", marginBottom: "16px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${playbook.overallScore}%`,
                background: overallColor,
                borderRadius: "2px",
                animation: "scoreBar 1.2s ease forwards"
              }} />
            </div>
            <p style={{ fontSize: "19px", color: "#f2e4ca", margin: "0 0 10px", fontWeight: "500" }}>
              {playbook.overallDescriptor}
            </p>
            <p style={{ fontSize: "14px", color: "#7a6a58", margin: 0, lineHeight: "1.7", fontStyle: "italic", fontFamily: "'Georgia', serif", fontWeight: "300" }}>
              {playbook.overallSummary}
            </p>
          </div>

          {/* P-O-W-E-R Sections */}
          {POWER_SECTIONS.map(({ key, letter, label, subtitle }) => {
            const section = playbook[key];
            if (!section) return null;
            return (
              <div key={key} style={{
                background: "#1e1510",
                border: "1px solid #3d2e24",
                borderRadius: "6px",
                padding: "32px 36px",
                marginBottom: "16px"
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "18px", fontWeight: "700", color: "#f2e4ca", letterSpacing: "0.1em" }}>{letter}</span>
                  <p style={{ fontSize: "16px", letterSpacing: "0.06em", textTransform: "uppercase", color: "#f2e4ca", margin: 0, fontWeight: "600" }}>
                    {label} — <span style={{ fontWeight: "400", letterSpacing: "0.04em" }}>{subtitle}</span>
                  </p>
                </div>
                <ScoreBar score={section.score} />
                <p style={{ fontSize: "14px", lineHeight: "1.8", color: "#9a8a72", margin: 0, fontWeight: "300" }}>
                  {section.content}
                </p>
              </div>
            );
          })}

          {/* Brand Personality */}
          {playbook.brandPersonality && (
            <div style={{
              background: "#1e1510",
              border: "1px solid #3d2e24",
              borderRadius: "6px",
              padding: "32px 36px",
              marginBottom: "16px",
              marginTop: "16px"
            }}>
              <p style={{ fontSize: "16px", letterSpacing: "0.06em", textTransform: "uppercase", color: "#f2e4ca", marginBottom: "12px", fontWeight: "600" }}>✨ Bonus — <span style={{ fontWeight: "400" }}>Brand Personality</span></p>
              <p style={{ fontSize: "14px", lineHeight: "1.8", color: "#9a8a72", margin: 0, fontWeight: "300" }}>
                {playbook.brandPersonality}
              </p>
            </div>
          )}

          {/* Fetch debug info on success (if issues) */}
          {debugInfo && (
            <div style={{ marginBottom: "32px" }}>
              <button
                onClick={() => setDebugOpen(o => !o)}
                style={{
                  background: "none",
                  border: "1px solid #3d2e24",
                  borderRadius: "3px",
                  color: "#6a5040",
                  fontSize: "12px",
                  fontFamily: "'Poppins', sans-serif",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  padding: "6px 12px"
                }}
              >
                {debugOpen ? "Hide" : "Show"} Fetch Info
              </button>
              {debugOpen && (
                <pre style={{
                  marginTop: "10px",
                  padding: "16px",
                  background: "#1e1510",
                  border: "1px solid #3d2e24",
                  borderRadius: "4px",
                  color: "#9a8070",
                  fontSize: "12px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  lineHeight: "1.6"
                }}>{debugInfo}</pre>
              )}
            </div>
          )}

          {/* CTA */}
          <div style={{
            padding: "40px",
            background: "#1e1510",
            border: "1px solid #3d2e24",
            borderRadius: "6px"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px"
            }}>
              <p style={{ fontSize: "16px", color: "#9a8070", margin: 0, maxWidth: "340px", lineHeight: "1.7", fontWeight: "300" }}>
                Want to close that gap? Let's talk about your unfair advantage.
              </p>
              <a
                href="https://monicapoling.com/vision"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "15px 28px",
                  background: "#861442",
                  color: "#f9ebea",
                  borderRadius: "4px",
                  fontSize: "13px",
                  fontFamily: "'Poppins', sans-serif",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: "600",
                  textDecoration: "none",
                  whiteSpace: "nowrap"
                }}
              >
                Book a Vision Call →
              </a>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: "48px", paddingTop: "28px", borderTop: "1px solid #2a1e18" }}>
            <p style={{ fontSize: "13px", color: "#9a8070", margin: 0, fontWeight: "400" }}>Monica Poling · monicapoling.com</p>
          </div>
        </div>
      )}
    </div>
  );
}
