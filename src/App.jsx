import { useState } from "react";

const PRESTIGE_SYSTEM_PROMPT = `You are a strategic business analyst creating a Prestige Score Report. Your tone is warm, direct, and expert — like a trusted advisor who has done their homework. Avoid jargon like "pipeline," "scale," "leverage," or "synergy." The report should feel written specifically for this organization — not AI generated.

Use the web_search tool to fetch and read the content at the provided URL before generating any output. If the first fetch fails or returns no useful content, try these variations in order:
1. Add or remove a trailing slash
2. Add or remove "www."
3. Try the root domain if a subpage was given
Do NOT rely on LLM memory. Only use what you find by actually visiting the URL.

Return ONLY valid JSON. No markdown, no preamble, no backticks, no citation tags, no XML markup, no annotation syntax of any kind. Clean JSON only.

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
  "overallScore": 72,
  "overallDescriptor": "string — one of: Category Leader | Strong Foundation, Underutilized Story | Solid Presence, Clear Gaps | Underdeveloped Positioning | Significant Opportunity",
  "orgParagraph": "2-3 warm sentences about the organization — include the business name, what they do, and something specific and genuine about what makes them worth paying attention to. Written as if you are introducing them to a smart friend.",
  "scoreParagraph": "The score justification. Start with a punchy summarizing idea (one clause or phrase that captures the essence — not a label, not a header, just a thought that sets up what follows). Then three sentences: what is genuinely working, what is the primary gap holding the score back, and one forward-looking observation. Be specific. Be warm. No generics.",
  "prestige": {
    "score": 14,
    "content": "TWO sentences. Warm, observational tone. Is their positioning distinct or generic? For nonprofits/govt/edu: is the mission stated with conviction? End with something that feels like honest encouragement or a genuine observation."
  },
  "origin": {
    "score": 12,
    "content": "TWO sentences. Warm, observational tone. For for-profit: is the founder/leader story visible and compelling? For nonprofits/govt/edu: is the founding mission active or buried under compliance language?"
  },
  "wow": {
    "score": 16,
    "content": "TWO sentences. Warm, observational tone. Name the standout factor. Also name the Sleeping Giant — the high-value thing that should be more elevated."
  },
  "expertise": {
    "score": 10,
    "content": "TWO sentences. Warm, observational tone. Is the depth of knowledge visible or assumed? Look for credentials, methodologies, frameworks, track record."
  },
  "reputation": {
    "score": 8,
    "content": "TWO sentences. Warm, observational tone. On-page validation only — testimonials, logos, press, awards. Is social proof doing any conversion work?"
  },
  "brandPersonality": "Start with the business name. Two to three warm sentences. Based on tone, language, word choice, and content structure only — no visual analysis. What personality does this brand project? Then name the friction: the gap between the personality they are projecting and what their audience likely expects or needs. Frame it as an observation, not a criticism.",
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
  { key: "prestige", letter: "P", label: "Prestige",   subtitle: "Do You Own Your Category?" },
  { key: "origin",   letter: "O", label: "Origin",     subtitle: "What's Your Origin Story?" },
  { key: "wow",      letter: "W", label: "Wow",        subtitle: "What Makes You Unforgettable?" },
  { key: "expertise",letter: "E", label: "Expertise",  subtitle: "Do You Demonstrate Clear Expertise?" },
  { key: "reputation",letter:"R", label: "Reputation", subtitle: "Do Others Vouch For You?" },
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
      <div style={{ padding: "80px 40px 64px", maxWidth: "780px", margin: "0 auto" }}>
        <p style={{ fontSize: "11px", letterSpacing: "0.25em", textTransform: "uppercase", color: "#5a4a3a", marginBottom: "48px", fontWeight: "400" }}>Market Intelligence</p>
        <h1 style={{
          fontSize: "clamp(34px, 5vw, 56px)",
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
          Unlock your Prestige Score to see exactly how your business stacks up in today's market.
        </p>

        {/* Input */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", maxWidth: "680px" }}>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !loading && handleGenerate()}
            placeholder="Enter your URL"
            style={{
              flex: "1",
              minWidth: "200px",
              padding: "15px 20px",
              background: "#1a120e",
              border: "1px solid #3d2e24",
              borderRadius: "4px",
              color: "#f2e4ca",
              fontSize: "15px",
              fontFamily: "'Poppins', sans-serif",
              outline: "none",
              fontWeight: "300"
            }}
            onFocus={e => e.target.style.borderColor = "#861442"}
            onBlur={e => e.target.style.borderColor = "#3d2e24"}
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !url.trim()}
            style={{
              padding: "15px 28px",
              background: loading ? "#3d2e24" : "#861442",
              color: loading ? "#6a5040" : "#f9ebea",
              border: "none",
              borderRadius: "4px",
              fontSize: "13px",
              fontFamily: "'Poppins', sans-serif",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              fontWeight: "600",
              whiteSpace: "nowrap"
            }}
          >
            {loading ? "Analyzing..." : "Get My Score →"}
          </button>
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
          <div style={{ marginBottom: "40px" }}>
            <h2 style={{ fontSize: "28px", fontWeight: "600", color: "#f2e4ca", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
              {playbook.businessName}
            </h2>
            <p style={{ fontSize: "12px", color: "#861442", letterSpacing: "0.1em", margin: 0, textTransform: "uppercase", fontWeight: "500" }}>
              ➜ {playbook.dateGenerated}
            </p>
          </div>

          {/* Box 1: Score Total */}
          <div style={{
            background: "#1e1510",
            border: "1px solid #3d2e24",
            borderRadius: "6px",
            padding: "32px 36px",
            marginBottom: "16px"
          }}>
            <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#5a4a3a", marginBottom: "20px", fontWeight: "500" }}>⚡ Prestige Score</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "14px" }}>
              <span style={{ fontSize: "72px", fontWeight: "300", lineHeight: "1", color: overallColor, letterSpacing: "-0.04em", fontFamily: "'Georgia', serif" }}>
                {playbook.overallScore}
              </span>
              <span style={{ fontSize: "22px", color: "#f2e4ca", paddingBottom: "6px", fontWeight: "600" }}>/100</span>
            </div>
            <div style={{ background: "#3d2e24", borderRadius: "2px", height: "3px", marginBottom: "20px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${playbook.overallScore}%`,
                background: "#861442",
                borderRadius: "2px",
                animation: "scoreBar 1.2s ease forwards"
              }} />
            </div>
            <p style={{ fontSize: "15px", color: "#f2e4ca", margin: "0 0 6px", fontWeight: "600", letterSpacing: "0.01em" }}>
              {playbook.overallDescriptor}
            </p>
            <p style={{ fontSize: "15px", color: "#f2e4ca", margin: "0 0 16px", lineHeight: "1.75", fontWeight: "400" }}>
              {playbook.orgParagraph}
            </p>
            <p style={{ fontSize: "15px", color: "#f2e4ca", margin: 0, lineHeight: "1.75", fontWeight: "400" }}>
              {playbook.scoreParagraph}
            </p>
          </div>

          {/* Box 2: Score Breakdown */}
          <div style={{
            background: "#1e1510",
            border: "1px solid #3d2e24",
            borderRadius: "6px",
            padding: "32px 36px",
            marginBottom: "16px"
          }}>
            <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#f2e4ca", marginBottom: "24px", fontWeight: "600" }}>📊 Score Breakdown</p>
            {POWER_SECTIONS.map(({ key, letter, label, subtitle }, idx) => {
              const section = playbook[key];
              if (!section) return null;
              return (
                <div key={key} style={{ marginBottom: idx < POWER_SECTIONS.length - 1 ? "24px" : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <p style={{ fontSize: "15px", color: "#f2e4ca", margin: 0, fontWeight: "600" }}>
                      <span style={{ color: "#861442", marginRight: "6px" }}>{letter}</span>
                      — {label}: {subtitle}
                    </p>
                    <span style={{ fontSize: "13px", color: "#f2e4ca", fontWeight: "600", whiteSpace: "nowrap", marginLeft: "16px" }}>{section.score}/20</span>
                  </div>
                  <div style={{ background: "#3d2e24", borderRadius: "2px", height: "3px", marginBottom: "8px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.round((section.score / 20) * 100)}%`,
                      background: "#861442",
                      borderRadius: "2px",
                      transition: "width 1.2s ease"
                    }} />
                  </div>
                  <p style={{ fontSize: "15px", lineHeight: "1.75", color: "#f2e4ca", margin: 0, fontWeight: "400" }}>
                    {section.content}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Box 3: Brand Personality */}
          {playbook.brandPersonality && (
            <div style={{
              background: "#1e1510",
              border: "1px solid #3d2e24",
              borderRadius: "6px",
              padding: "32px 36px",
              marginBottom: "16px"
            }}>
              <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#f2e4ca", marginBottom: "16px", fontWeight: "600" }}>✨ Bonus: Brand Personality</p>
              <p style={{ fontSize: "15px", lineHeight: "1.75", color: "#f2e4ca", margin: 0, fontWeight: "400" }}>
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
            <p style={{ fontSize: "13px", color: "#9a8070", margin: 0, fontWeight: "400" }}>
              Monica Poling ·{" "}
              <a href="https://monicapoling.com" target="_blank" rel="noopener noreferrer" style={{ color: "#9a8070", textDecoration: "underline", textUnderlineOffset: "3px" }}>
                monicapoling.com
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
