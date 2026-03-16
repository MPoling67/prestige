import { useState } from "react";

const PRESTIGE_SYSTEM_PROMPT = `You are a strategic business analyst creating a Prestige Score Report. Your tone is warm, direct, and expert — like a trusted advisor who has done their homework. Avoid jargon like "pipeline," "scale," "leverage," or "synergy." The report should feel written specifically for this organization — not AI generated.

Use the web_search tool to fetch and read the content at the provided URL before generating any output. If the first fetch fails or returns no useful content, try these variations in order:
1. Add or remove a trailing slash
2. Add or remove "www."
3. Try the root domain if a subpage was given
Do NOT rely on LLM memory. Only use what you find by actually visiting the URL.
All content fields should address the business in second person ("your positioning," "your website," "your story") rather than third person.

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
  "orgParagraph": "2 sentences max, 45 words max. Include the business name, what they do, and one specific genuine thing that makes them worth paying attention to. Warm, like introducing them to a smart friend.",
  "scoreParagraph": "2 sentences max, 40 words max. Start with a the company name and a punchy one-liner summarizing idea — one clause that captures the essence, not a label. Then: what is genuinely working and what is the primary gap. Specific, warm, no generics.",
  "prestige": {
    "score": 14,
    "content": "TWO sentences, 40 words max. Warm, observational tone. Is their positioning distinct or generic? For nonprofits/govt/edu: is the mission stated with conviction?"
  },
  "origin": {
    "score": 12,
    "content": "TWO sentences, 40 words max. Warm, observational tone. For for-profit: is the founder/leader story visible and compelling? For nonprofits/govt/edu: is the founding mission active or buried?"
  },
  "wow": {
    "score": 16,
    "content": "TWO sentences, 40 words max. Warm, observational tone. Name the standout factor in the first sentence. Name the Sleeping Giant — the high-value thing being left on the table — in the second."
  },
  "expertise": {
    "score": 10,
    "content": "TWO sentences, 40 words max. Warm, observational tone. Is the depth of knowledge visible or assumed? Look for credentials, methodologies, frameworks, track record."
  },
  "reputation": {
    "score": 8,
    "content": "TWO sentences, 40 words max. Warm, observational tone. Do they show up as a voice of their industry — press mentions, quoted expertise, speaking, awards, published thought leadership? Or is their credibility assumed rather than demonstrated?"
  },
  "brandPersonality": "2 sentences max, 35 words max. Start with the business name. What personality does this brand project? Then name the friction — the gap between the personality being projected and what the audience likely expects. Warm observation, not criticism.",
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

const INTEL_SYSTEM_PROMPT = `You are a strategic market analyst. You will be given a Prestige Score Report JSON for a business. Use web search to find current competitive intelligence.

Return ONLY valid JSON. No markdown, no preamble, no backticks. Clean JSON only.

JSON Schema:
{
  "competitors": [
    {
      "name": "Competitor name",
      "url": "https://...",
      "whatTheyDo": "One sentence: what they do and who they serve.",
      "theirEdge": "One sentence: what they are doing well or differently that is worth paying attention to."
    }
  ],
  "trends": [
    {
      "title": "Trend name, 5 words max",
      "insight": "2 sentences max, 40 words max. What is happening and why it matters specifically for this business."
    }
  ]
}

Rules:
- Find 2 real, named competitors. Prioritize competitors who are winning — appearing in media, winning awards, being quoted as experts, or visibly setting the conversation in this space.
- Find 3 industry trends that are genuinely relevant to this specific business right now.
- Be specific. No generic trends like "digital transformation" unless you can tie it directly to something real.
- Warm, direct tone. Like a smart advisor who did the research.`;

const REVENUE_SYSTEM_PROMPT = `You are a strategic revenue advisor. You will be given a Prestige Score Report JSON for a business. Based only on what the report reveals — the scores, the gaps, the brand personality — identify three high-leverage revenue moves for this business.

Return ONLY valid JSON. No markdown, no preamble, no backticks. Clean JSON only.

JSON Schema:
{
  "moves": [
    {
      "title": "Increase [Specific Thing]: [Brief Why]",
      "context": "One sentence: why this move matters for this specific business based on what the report revealed.",
      "action": "One sentence: the single most important next step. Specific, not generic."
    }
  ],
  "closingLine": "One sentence. Warm, direct. Positions deeper Revenue Mapping work without being salesy."
}

Rules:
- Exactly 3 moves, in priority order.
- Each move must be grounded in something specific from the Prestige Score Report — a gap, a strength, a score.
- No generic advice. If you can't tie it to the report, don't include it.
- Tone: trusted advisor in the room, not a consultant's slide deck.`;

function normalizeUrl(input) {
  let url = input.trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
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
      messages: [{
        role: "user",
        content: `Generate a Prestige Score Report for this organization. Start by fetching: ${url}

If that fetch fails or returns no meaningful content, try these in order:
- ${url}/
- ${url.replace(/^https:\/\//, "https://www.")}
- ${url.replace(/^https:\/\/www\./, "https://")}

Record all URLs you attempted in the urlsAttempted field. Set fetchSuccess to false and explain in fetchNote if you were unable to retrieve useful content from any variation.

Then generate the full Prestige Score Report JSON.`
      }]
    })
  });
  if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const textBlock = data.content?.find(b => b.type === "text");
  if (!textBlock) throw new Error(`No text block in response.`);
  const clean = textBlock.text.replace(/```json|```/g, "").replace(/<[^>]*cite[^>]*>/gi, "").trim();
  try { return JSON.parse(clean); }
  catch (e) { throw new Error(`JSON parse failed: ${e.message}\n\nRaw (first 500):\n${clean.substring(0, 500)}`); }
}

async function generateIntel(playbookData) {
  const response = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: INTEL_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Here is the Prestige Score Report for this business:\n\n${JSON.stringify(playbookData, null, 2)}\n\nNow search the web to find their top 2 competitors and 3 relevant industry trends. Return the JSON.`
      }]
    })
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const textBlock = data.content?.find(b => b.type === "text");
  if (!textBlock) throw new Error("No text block in intel response.");
  const clean = textBlock.text.replace(/```json|```/g, "").replace(/<[^>]*cite[^>]*>/gi, "").trim();
  try { return JSON.parse(clean); }
  catch (e) { throw new Error(`Intel JSON parse failed: ${e.message}`); }
}

async function generateRevenue(playbookData) {
  const response = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: REVENUE_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Here is the Prestige Score Report:\n\n${JSON.stringify(playbookData, null, 2)}\n\nIdentify the three highest-leverage revenue moves for this business. Return the JSON.`
      }]
    })
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const textBlock = data.content?.find(b => b.type === "text");
  if (!textBlock) throw new Error("No text block in revenue response.");
  const clean = textBlock.text.replace(/```json|```/g, "").replace(/<[^>]*cite[^>]*>/gi, "").trim();
  try { return JSON.parse(clean); }
  catch (e) { throw new Error(`Revenue JSON parse failed: ${e.message}`); }
}

const POWER_SECTIONS = [
  { key: "prestige",    letter: "P", label: "Prestige",   subtitle: "Do You Own Your Category?" },
  { key: "origin",      letter: "O", label: "Origin",     subtitle: "What's Your Origin Story?" },
  { key: "wow",         letter: "W", label: "Wow",        subtitle: "What Makes You Unforgettable?" },
  { key: "expertise",   letter: "E", label: "Expertise",  subtitle: "Do You Demonstrate Clear Expertise?" },
  { key: "reputation",  letter: "R", label: "Reputation", subtitle: "Are You the Voice of Your Industry?" },
];

const BOX = {
  background: "#1e1510",
  border: "1px solid #3d2e24",
  borderRadius: "6px",
  padding: "32px 36px",
  marginBottom: "16px"
};

const SUPERTITLE = {
  fontSize: "11px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "#f2e4ca",
  marginBottom: "8px",
  fontWeight: "600"
};

const BODY = {
  fontSize: "15px",
  color: "#f2e4ca",
  lineHeight: "1.75",
  fontWeight: "300"
};

const BTN = {
  display: "inline-block",
  padding: "12px 24px",
  background: "#861442",
  color: "#f9ebea",
  border: "none",
  borderRadius: "4px",
  fontSize: "13px",
  fontFamily: "'Poppins', sans-serif",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: "600",
  cursor: "pointer",
  whiteSpace: "nowrap",
  textDecoration: "none"
};

function PulseLoader({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0" }}>
      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#861442", animation: "pulse 1.2s ease-in-out infinite" }} />
      <p style={{ color: "#9a8070", fontSize: "14px", fontStyle: "italic", margin: 0, fontWeight: "300" }}>{text}</p>
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

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState(null);

  const [intel, setIntel] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState(null);

  const [revenue, setRevenue] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueError, setRevenueError] = useState(null);

  const handleGenerate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    setPlaybook(null);
    setIntel(null);
    setRevenue(null);
    setEmailSubmitted(false);

    const steps = [
      "Pulling up the site...",
      "Reading between the lines...",
      "Evaluating your P-O-W-E-R...",
      "Sizing up the landscape...",
      "Writing your Prestige Score Report..."
    ];
    let i = 0;
    setProgress(steps[0]);
    const interval = setInterval(() => { i = (i + 1) % steps.length; setProgress(steps[i]); }, 2200);

    try {
      const result = await generatePlaybook(url);
      setPlaybook(result);
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

  const handleEmailSubmit = async () => {
    if (!email.trim() || !firstName.trim()) return;
    setEmailSubmitting(true);
    setEmailError(null);
    try {
      await fetch("https://script.google.com/macros/s/AKfycbxtCPP6q6wqCUYlSEtNdyQxFF_22K94lvgP4MJytXYX-kWqpCYkZnXG7tYV5fSZThYj/exec", {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), email: email.trim(), website: url.trim(), subscribe: "true" })
      });
      setEmailSubmitted(true);
      runPhase2();
    } catch (e) {
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const runPhase2 = async () => {
    setIntelLoading(true);
    setRevenueLoading(true);

    // Run both calls in parallel
    const [intelResult, revenueResult] = await Promise.allSettled([
      generateIntel(playbook),
      generateRevenue(playbook)
    ]);

    if (intelResult.status === "fulfilled") setIntel(intelResult.value);
    else setIntelError("Could not load competitor and trend data. Try refreshing.");
    setIntelLoading(false);

    if (revenueResult.status === "fulfilled") setRevenue(revenueResult.value);
    else setRevenueError("Could not load revenue mapping. Try refreshing.");
    setRevenueLoading(false);
  };

  const overallColor = playbook
    ? playbook.overallScore >= 75 ? "#06472a"
    : playbook.overallScore >= 55 ? "#861442"
    : "#8a5a3a"
    : "#861442";

  const phase2Done = intel && revenue;

  return (
    <div style={{ minHeight: "100vh", background: "#2b211b", fontFamily: "'Poppins', 'Georgia', sans-serif", color: "#f2e4ca", padding: "0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');
        @keyframes scoreBar { from { width: 0%; } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        input::placeholder { color: #5a4a3a; }
        * { box-sizing: border-box; }
        @media print {
          .no-print { display: none !important; }
          body { background: #2b211b !important; }
          .print-warning { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{ borderBottom: "1px solid #3d2e24", padding: "32px 40px 28px", display: "flex", alignItems: "baseline", gap: "12px" }}>
        <span style={{ fontSize: "12px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#861442", fontWeight: "700" }}>The Prestige Score</span>
        <span style={{ color: "#f2e4ca", fontSize: "10px", fontWeight: "700" }}>✦</span>
        <span style={{ fontSize: "12px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#f2e4ca", fontWeight: "700" }}>Knowledge on Tap</span>
      </div>

      {/* Hero / Input */}
      <div className="no-print" style={{ padding: "80px 40px 64px", maxWidth: "780px", margin: "0 auto" }}>
        <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#f2e4ca", marginBottom: "48px", fontWeight: "600" }}>Market Intelligence</p>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 54px)", fontWeight: "700", lineHeight: "1.05", margin: "0 0 24px", color: "#861442", letterSpacing: "-0.03em", fontFamily: "'Poppins', sans-serif" }}>
          Prestige Score
        </h1>
        <p style={{ fontSize: "17px", lineHeight: "1.75", color: "#f2e4ca", maxWidth: "560px", margin: "0 0 52px", fontWeight: "300" }}>
          Great businesses often get overlooked because they're trained to do excellent work, but they don't know how to showcase their work strategically. Learn what's working and what isn't.
          <br /><br />
          Unlock your Prestige Score now.
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", maxWidth: "680px" }}>
          <input
            type="url" value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !loading && handleGenerate()}
            placeholder="Enter your URL"
            style={{ flex: "1", minWidth: "200px", padding: "15px 20px", background: "#1a120e", border: "1px solid #3d2e24", borderRadius: "4px", color: "#f2e4ca", fontSize: "15px", fontFamily: "'Poppins', sans-serif", outline: "none", fontWeight: "300" }}
            onFocus={e => e.target.style.borderColor = "#861442"}
            onBlur={e => e.target.style.borderColor = "#3d2e24"}
          />
          <button onClick={handleGenerate} disabled={loading || !url.trim()}
            style={{ ...BTN, padding: "15px 28px", cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Analyzing..." : "Get My Score →"}
          </button>
        </div>
        {loading && (
          <div style={{ marginTop: "32px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#861442", animation: "pulse 1.2s ease-in-out infinite" }} />
            <p style={{ color: "#9a8070", fontSize: "15px", fontStyle: "italic", margin: 0, fontWeight: "300" }}>{progress}</p>
          </div>
        )}
        {error && (
          <div style={{ marginTop: "20px" }}>
            <p style={{ color: "#c0705a", fontSize: "15px", margin: "0 0 8px" }}>{error}</p>
            {debugInfo && (
              <div>
                <button onClick={() => setDebugOpen(o => !o)} style={{ background: "none", border: "1px solid #3d2e24", borderRadius: "3px", color: "#6a5040", fontSize: "12px", fontFamily: "'Poppins', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", padding: "6px 12px" }}>
                  {debugOpen ? "Hide" : "Show"} Debug Info
                </button>
                {debugOpen && <pre style={{ marginTop: "10px", padding: "16px", background: "#1e1510", border: "1px solid #3d2e24", borderRadius: "4px", color: "#9a8070", fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.6" }}>{debugInfo}</pre>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report Output */}
      {playbook && (
        <div style={{ maxWidth: "780px", margin: "0 auto", padding: "0 40px 80px", animation: "fadeIn 0.6s ease" }}>
          <div style={{ borderTop: "1px solid #3d2e24", marginBottom: "56px" }} />

          {/* Business name + date */}
          <div style={{ marginBottom: "40px" }}>
            <h2 style={{ fontSize: "28px", fontWeight: "600", color: "#f2e4ca", margin: "0 0 8px", letterSpacing: "-0.01em" }}>{playbook.businessName}</h2>
            <p style={{ fontSize: "12px", color: "#861442", letterSpacing: "0.1em", margin: 0, textTransform: "uppercase", fontWeight: "500" }}>➜ {playbook.dateGenerated}</p>
          </div>

          {/* Box 1: Business Overv iew */}
          <div style={BOX}>
            <p style={SUPERTITLE}>📌 About {playbook.businessName}</p>
            <p style={{ ...BODY, margin: "0 0 20px" }}>{playbook.orgParagraph}</p>
          </div>
          
          {/* Box 2: Score Total */}
          <div style={BOX}>
            <p style={SUPERTITLE}>⚡ Prestige Score</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "14px" }}>
              <span style={{ fontSize: "72px", fontWeight: "300", lineHeight: "1", color: overallColor, letterSpacing: "-0.04em", fontFamily: "'Georgia', serif" }}>{playbook.overallScore}</span>
              <span style={{ fontSize: "22px", color: "#f2e4ca", paddingBottom: "6px", fontWeight: "600" }}>/100</span>
            </div>
            <div style={{ background: "#f2e4ca", borderRadius: "2px", height: "3px", marginBottom: "20px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${playbook.overallScore}%`, background: "#861442", borderRadius: "2px", animation: "scoreBar 1.2s ease forwards" }} />
            </div>
            <p style={SUPERTITLE}>⭐ About Your Score</p>
            <p style={{ ...BODY, margin: 0 }}>{playbook.scoreParagraph}</p>
          </div>

          {/* Box 2: Score Breakdown */}
          <div style={BOX}>
            <p style={{ ...SUPERTITLE, marginBottom: "24px" }}>📊 Score Breakdown</p>
            {POWER_SECTIONS.map(({ key, letter, label, subtitle }, idx) => {
              const section = playbook[key];
              if (!section) return null;
              return (
                <div key={key} style={{ marginBottom: idx < POWER_SECTIONS.length - 1 ? "24px" : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <p style={{ fontSize: "15px", color: "#f2e4ca", margin: 0, fontWeight: "600" }}>
                      <span style={{ color: "#861442", marginRight: "6px" }}>{letter}</span>— {label}: {subtitle}
                    </p>
                    <span style={{ fontSize: "13px", color: "#f2e4ca", fontWeight: "600", whiteSpace: "nowrap", marginLeft: "16px" }}>{section.score}/20</span>
                  </div>
                  <div style={{ background: "#f2e4ca", borderRadius: "2px", height: "3px", marginBottom: "8px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.round((section.score / 20) * 100)}%`, background: "#861442", borderRadius: "2px", transition: "width 1.2s ease" }} />
                  </div>
                  <p style={{ ...BODY, margin: 0 }}>{section.content}</p>
                </div>
              );
            })}
          </div>

          {/* Box 3: Brand Personality */}
          {playbook.brandPersonality && (
            <div style={BOX}>
              <p style={{ ...SUPERTITLE, marginBottom: "16px" }}>✨ Bonus: Brand Personality</p>
              <p style={{ ...BODY, margin: 0 }}>{playbook.brandPersonality}</p>
            </div>
          )}

          {/* Debug */}
          {debugInfo && (
            <div style={{ marginBottom: "16px" }} className="no-print">
              <button onClick={() => setDebugOpen(o => !o)} style={{ background: "none", border: "1px solid #3d2e24", borderRadius: "3px", color: "#6a5040", fontSize: "12px", fontFamily: "'Poppins', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", padding: "6px 12px" }}>
                {debugOpen ? "Hide" : "Show"} Fetch Info
              </button>
              {debugOpen && <pre style={{ marginTop: "10px", padding: "16px", background: "#1e1510", border: "1px solid #3d2e24", borderRadius: "4px", color: "#9a8070", fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.6" }}>{debugInfo}</pre>}
            </div>
          )}

          {/* Email Capture */}
          <div style={BOX} className="no-print">
            <p style={SUPERTITLE}>📩 Want an Expanded Report?</p>
            <p style={{ ...BODY, marginBottom: "24px" }}>
              Want a deeper dive? Enter your first name and email to see your top competitors and top industry trends.
            </p>
            {emailSubmitted ? (
              <p style={{ fontSize: "15px", color: "#4a9a6a", fontWeight: "500" }}>✓ Unlocking your expanded report below...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name"
                    style={{ flex: "1", minWidth: "140px", padding: "12px 16px", background: "#2b211b", border: "1px solid #3d2e24", borderRadius: "4px", color: "#f2e4ca", fontSize: "14px", fontFamily: "'Poppins', sans-serif", outline: "none", fontWeight: "300" }}
                    onFocus={e => e.target.style.borderColor = "#861442"} onBlur={e => e.target.style.borderColor = "#3d2e24"} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleEmailSubmit()} placeholder="Email address"
                    style={{ flex: "2", minWidth: "200px", padding: "12px 16px", background: "#2b211b", border: "1px solid #3d2e24", borderRadius: "4px", color: "#f2e4ca", fontSize: "14px", fontFamily: "'Poppins', sans-serif", outline: "none", fontWeight: "300" }}
                    onFocus={e => e.target.style.borderColor = "#861442"} onBlur={e => e.target.style.borderColor = "#3d2e24"} />
                </div>
                <p style={{ fontSize: "12px", color: "#5a4a3a", margin: 0, fontWeight: "300" }}>By submitting, you agree to receive the Let's Make Some Noise newsletter.</p>
                {emailError && <p style={{ fontSize: "13px", color: "#c0705a", margin: 0 }}>{emailError}</p>}
                <button onClick={handleEmailSubmit} disabled={emailSubmitting || !email.trim() || !firstName.trim()}
                  style={{ ...BTN, alignSelf: "flex-start", cursor: emailSubmitting || !email.trim() || !firstName.trim() ? "not-allowed" : "pointer" }}>
                  {emailSubmitting ? "Sending..." : "Give Me More Details →"}
                </button>
              </div>
            )}
          </div>

          {/* Phase 2: Industry-Leading Competitors */}
          {(intelLoading || intel || intelError) && (
            <div style={{ ...BOX, animation: "fadeIn 0.6s ease" }}>
              <p style={SUPERTITLE}>🏆 Industry-Leading Competitors</p>
              {intelLoading && <PulseLoader text="Searching for competitors and trends..." />}
              {intelError && <p style={{ color: "#c0705a", fontSize: "14px" }}>{intelError}</p>}
              {intel && (
                <>
                  {intel.competitors?.map((c, i) => (
                    <div key={i} style={{ marginBottom: i < intel.competitors.length - 1 ? "20px" : 0, paddingBottom: i < intel.competitors.length - 1 ? "20px" : 0, borderBottom: i < intel.competitors.length - 1 ? "1px solid #3d2e24" : "none" }}>
                      <p style={{ fontSize: "15px", fontWeight: "600", color: "#f2e4ca", margin: "0 0 4px" }}>
                        {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: "#861442", textDecoration: "none" }}>{c.name} →</a> : c.name}
                      </p>
                      <p style={{ ...BODY, margin: "0 0 4px" }}>{c.whatTheyDo}</p>
                      <p style={{ fontSize: "14px", color: "#9a8070", margin: 0, lineHeight: "1.6", fontWeight: "300", fontStyle: "italic" }}>{c.theirEdge}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Phase 2: Trends to Watch */}
          {(intelLoading || intel || intelError) && intel && (
            <div style={{ ...BOX, animation: "fadeIn 0.6s ease" }}>
              <p style={SUPERTITLE}>📈 Trends to Watch</p>
              {intel.trends?.map((t, i) => (
                <div key={i} style={{ marginBottom: i < intel.trends.length - 1 ? "20px" : 0 }}>
                  <p style={{ fontSize: "15px", fontWeight: "600", color: "#861442", margin: "0 0 4px" }}>{t.title}</p>
                  <p style={{ ...BODY, margin: 0 }}>{t.insight}</p>
                </div>
              ))}
            </div>
          )}

          {/* Phase 2: Revenue Mapping */}
          {(revenueLoading || revenue || revenueError) && (
            <div style={{ ...BOX, animation: "fadeIn 0.6s ease" }}>
              <p style={SUPERTITLE}>💡 Three Moves Worth Making</p>
              {revenueLoading && <PulseLoader text="Identifying your highest-leverage moves..." />}
              {revenueError && <p style={{ color: "#c0705a", fontSize: "14px" }}>{revenueError}</p>}
              {revenue && (
                <>
                  {revenue.moves?.map((m, i) => (
                    <div key={i} style={{ marginBottom: i < revenue.moves.length - 1 ? "24px" : "20px", paddingBottom: i < revenue.moves.length - 1 ? "24px" : 0, borderBottom: i < revenue.moves.length - 1 ? "1px solid #3d2e24" : "none" }}>
                      <p style={{ fontSize: "15px", fontWeight: "600", color: "#f2e4ca", margin: "0 0 6px" }}>
                        {m.title}
                      </p>
                      <p style={{ ...BODY, margin: "0 0 4px" }}>{m.context}</p>
                      <p style={{ fontSize: "14px", color: "#9a8070", margin: 0, lineHeight: "1.6", fontWeight: "300" }}>Next Step: {m.action}</p>
                    </div>
                  ))}
                  {revenue.closingLine && (
                    <p style={{ fontSize: "14px", color: "#861442", margin: "4px 0 0", fontWeight: "500", fontStyle: "italic" }}>{revenue.closingLine}</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* CTA */}
          <div style={BOX}>
            <p style={SUPERTITLE}>✦ Want to Talk</p>
            <p style={{ ...BODY, marginBottom: "24px" }}>
              Want to talk about your results? Or learn how your org can develop AI business intelligence tools.
            </p>
            <a href="https://monicapoling.com/vision" target="_blank" rel="noopener noreferrer" style={BTN}>
              Book a Vision Call →
            </a>
          </div>

          {/* Print Button */}
          {phase2Done && (
            <div className="no-print" style={{ ...BOX, marginBottom: "32px" }}>
              <p style={SUPERTITLE}>🖨️ Print This Report!</p>
              <p style={{ ...BODY, marginBottom: "24px" }}>
                This report is not saved. Print it now, before leaving this page, or lose it forever more. (Businesses can only run one report per day.)
              </p>
              <button onClick={() => window.print()} style={BTN}>
                Print / Save Report →
              </button>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: "48px", paddingTop: "28px", borderTop: "1px solid #2a1e18" }}>
            <p style={{ fontSize: "13px", color: "#9a8070", margin: 0, fontWeight: "400" }}>
              Monica Poling · Knowledge on Tap ·{" "}
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
