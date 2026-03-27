import { useState } from "react";

// ── Google Fonts ──────────────────────────────────────────────────────────────
// Dark zone: Fraunces + DM Mono
// Light zone: Fraunces + Plus Jakarta Sans
// Loaded via @import in the style block below

// ── System Prompts ────────────────────────────────────────────────────────────

const POWER_SYSTEM_PROMPT = `You are a strategic business analyst creating a POWER Score Report. Your tone is warm, direct, and expert — like a trusted advisor who has done their homework. Avoid jargon like "pipeline," "scale," "leverage," or "synergy." The report should feel written specifically for this organization — not AI generated.

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

const INTEL_SYSTEM_PROMPT = `You are a strategic market analyst. You will be given a POWER Score JSON for a business. Use web search to find current competitive intelligence.

Return ONLY valid JSON. No markdown, no preamble, no backticks. Clean JSON only.
All content fields must address the business in second person ("your positioning," "your website," "your story") rather than third person.

JSON Schema:
{
  "competitors": [
    {
      "name": "Competitor name",
      "whatTheyDo": "One sentence: what they do and who they serve.",
      "whyTheyreWinning": "One sentence: what they are doing well or differently that is worth paying attention to."
    }
  ],
  "trends": [
    {
      "title": "Trend name, 7 words max",
      "insight": "1-2 sentences, 45 words max. What is happening and why it matters right now.",
      "relevance": "1 sentence, 30 words max. Tie this directly to something specific found in the POWER Score — a gap, a strength, or a score — using second person."
    }
  ]
}

Rules:
- Find 2 real, named competitors. Prioritize competitors who are winning — appearing in media, winning awards, being quoted as experts, or visibly setting the conversation in this space.
- Find 3 industry trends that are genuinely relevant to this specific business right now.
- Be specific. No generic trends like "digital transformation" unless you can tie it directly to something real.
- Warm, direct tone. Like a smart advisor who did the research.`;

const REVENUE_SYSTEM_PROMPT = `You are a strategic revenue advisor. You will be given a POWER Score JSON for a business. Based only on what the report reveals — the scores, the gaps, the brand personality — identify three high-leverage revenue moves for this business.

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
- Each move must be grounded in something specific from the POWER Score — a gap, a strength, a score.
- No generic advice. If you can't tie it to the report, don't include it.
- Tone: trusted advisor in the room, not a consultant's slide deck.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeUrl(input) {
  let url = input.trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  url = url.replace(/\/+$/, "");
  return url;
}

function scoreColor(score, max) {
  const pct = score / max;
  if (pct >= 0.75) return "#0F6E56";
  if (pct >= 0.55) return "#a07800";
  return "#861442";
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
      system: POWER_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Generate a POWER Score for this organization. Start by fetching: ${url}

If that fetch fails or returns no meaningful content, try these in order:
- ${url}/
- ${url.replace(/^https:\/\//, "https://www.")}
- ${url.replace(/^https:\/\/www\./, "https://")}

Record all URLs you attempted in the urlsAttempted field. Set fetchSuccess to false and explain in fetchNote if you were unable to retrieve useful content from any variation.

Then generate the full POWER Score JSON.`
      }]
    })
  });
  if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const textBlock = data.content?.find(b => b.type === "text");
  if (!textBlock) throw new Error("No text block in response.");
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
        content: `Here is the POWER Score for this business:\n\n${JSON.stringify(playbookData, null, 2)}\n\nNow search the web to find their top 2 competitors and 3 relevant industry trends. Return the JSON.`
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
        content: `Here is your POWER Score:\n\n${JSON.stringify(playbookData, null, 2)}\n\nIdentify the three highest-leverage revenue moves for this business. Return the JSON.`
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

// ── Constants ─────────────────────────────────────────────────────────────────

const POWER_SECTIONS = [
  { key: "prestige",   letter: "P", label: "Prestige",   subtitle: "Do You Own Your Category?" },
  { key: "origin",     letter: "O", label: "Ownership",  subtitle: "What's Your Origin Story?" },
  { key: "wow",        letter: "W", label: "Wow Factor", subtitle: "What Makes You Unforgettable?" },
  { key: "expertise",  letter: "E", label: "Expertise",  subtitle: "Do You Demonstrate Clear Expertise?" },
  { key: "reputation", letter: "R", label: "Reputation", subtitle: "Are You the Voice of Your Industry?" },
];

const LOAD_STEPS = [
  "Pulling up your site...",
  "Wow! This is great stuff...",
  "Evaluating your P·O·W·E·R...",
  "Personality, deconstructed...",
  "Love what you're doing...",
  "Calculating your POWER Score...",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function PulseLoader({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "6px 0" }}>
      <div style={{
        width: "6px", height: "6px", borderRadius: "50%", background: "#861442",
        animation: "kot-pulse 1.2s ease-in-out infinite", flexShrink: 0
      }} />
      <p style={{ color: "#888580", fontSize: "13px", fontStyle: "italic", margin: 0, fontWeight: 300, fontFamily: "'DM Mono', monospace" }}>{text}</p>
    </div>
  );
}

function ScoreBar({ score, max }) {
  const col = scoreColor(score, max);
  const pct = Math.round((score / max) * 100);
  return (
    <div style={{ background: "var(--surface2)", borderRadius: "2px", height: "4px", overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${pct}%`, background: col, borderRadius: "2px",
        animation: "kot-scoreBar 1.2s ease forwards"
      }} />
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [playbook, setPlaybook] = useState(null);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [debugOpen, setDebugOpen] = useState(false);

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

  const phase2Done = intel && revenue;

  const handleGenerate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    setPlaybook(null);
    setIntel(null);
    setRevenue(null);
    setEmailSubmitted(false);

    let i = 0;
    setProgress(LOAD_STEPS[0]);
    const interval = setInterval(() => { i = (i + 1) % LOAD_STEPS.length; setProgress(LOAD_STEPS[i]); }, 2200);

    try {
      const result = await generatePlaybook(url);
      setPlaybook(result);
      // Fire-and-forget GA event
      fetch("https://script.google.com/macros/s/AKfycbxtCPP6q6wqCUYlSEtNdyQxFF_22K94lvgP4MJytXYX-kWqpCYkZnXG7tYV5fSZThYj/exec", {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "report_run", timestamp: new Date().toISOString(), url: url.trim(), score: result.overallScore || "", browser: navigator.userAgent, subscribe: "false" })
      }).catch(() => {});
      if (!result.fetchSuccess || result.fetchNote) {
        setDebugInfo(
          `Fetch status: ${result.fetchSuccess ? "Success" : "Failed"}\n` +
          `URLs attempted: ${result.urlsAttempted?.join(", ") || "unknown"}\n` +
          (result.fetchNote ? `Note: ${result.fetchNote}` : "")
        );
      }
    } catch (e) {
      setError("Oops — looks like AI gremlins are up to no good. Submit your URL and try again.");
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
        body: JSON.stringify({ event: "email_submit", timestamp: new Date().toISOString(), url: url.trim(), score: playbook?.overallScore || "", browser: navigator.userAgent, firstName: firstName.trim(), email: email.trim(), website: url.trim(), subscribe: "true" })
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

  const sc = playbook?.overallScore || 0;
  const overallColor = scoreColor(sc, 100);

  return (
    <div style={{ minHeight: "100vh", background: "#2b211b", fontFamily: "'DM Mono', monospace", color: "#f2e4ca" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300;1,9..144,600&family=DM+Mono:wght@300;400;500&family=Plus+Jakarta+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        @keyframes kot-scoreBar { from { width: 0%; } }
        @keyframes kot-pulse { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
        @keyframes kot-fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

        .kot-report-zone { background: #f4f3ef; color: #1a1a18; }
        .kot-report-zone { --bg: #f4f3ef; --surface: #ffffff; --surface2: #edecea; --border: rgba(0,0,0,0.08); --border2: rgba(0,0,0,0.14); --text: #1a1a18; --muted: #6b6b66; --accent: #861442; --accent2: #be3650; --green: #0F6E56; --amber: #a07800; --radius: 10px; }

        .kot-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: clamp(20px,4vw,32px) clamp(20px,4vw,36px); margin-bottom: 16px; }
        .kot-card-label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; font-family: 'DM Mono', monospace; font-weight: 500; color: var(--accent); margin-bottom: 16px; }
        .kot-card-body { font-size: 14px; line-height: 1.8; color: var(--text); font-weight: 300; font-family: 'Plus Jakarta Sans', sans-serif; }

        .kot-narrative { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 0 var(--radius) var(--radius) 0; padding: clamp(16px,3vw,24px) clamp(16px,3vw,28px); font-size: 14px; line-height: 1.8; color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 300; margin-bottom: 16px; }

        .kot-field { width: 100%; padding: 11px 14px; background: var(--surface2); border: 1px solid var(--border2); border-radius: var(--radius); color: var(--text); font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; transition: border-color 0.2s; }
        .kot-field:focus { border-color: #861442; }
        .kot-field::placeholder { color: var(--muted); }

        .kot-btn { background: #861442; color: #ffffff; border: none; border-radius: 10px; font-size: 13px; font-weight: 500; padding: 12px 22px; cursor: pointer; letter-spacing: 0.04em; transition: opacity 0.15s, transform 0.1s; white-space: nowrap; font-family: 'DM Mono', monospace; }
        .kot-btn:hover { opacity: 0.88; }
        .kot-btn:active { transform: scale(0.97); }
        .kot-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .kot-btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border2); font-size: 13px; padding: 10px 18px; border-radius: var(--radius); cursor: pointer; transition: color 0.15s, border-color 0.15s; font-family: 'DM Mono', monospace; }
        .kot-btn-ghost:hover { color: #861442; border-color: #861442; }

        .kot-power-row { padding: 18px 0; border-bottom: 1px solid var(--border); }
        .kot-power-row:first-child { padding-top: 0; }
        .kot-power-row:last-child { border-bottom: none; padding-bottom: 0; }
        .kot-power-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        .kot-power-title { font-size: 12px; font-weight: 500; color: var(--text); font-family: 'DM Mono', monospace; }
        .kot-power-letter { color: var(--accent); margin-right: 4px; }
        .kot-power-score { font-size: 12px; font-family: 'DM Mono', monospace; font-weight: 500; color: var(--muted); white-space: nowrap; }
        .kot-power-content { font-size: 13px; line-height: 1.75; color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 300; margin-top: 10px; }

        .kot-intel-item { padding: 18px 0; border-bottom: 1px solid var(--border); }
        .kot-intel-item:first-child { padding-top: 0; }
        .kot-intel-item:last-child { border-bottom: none; padding-bottom: 0; }

        .kot-move-item { padding: 20px 0; border-bottom: 1px solid var(--border); }
        .kot-move-item:first-child { padding-top: 0; }
        .kot-move-item:last-child { border-bottom: none; padding-bottom: 0; }

        .kot-anim { animation: kot-fadeUp 0.5s ease both; }

        .kot-debug-pre { padding: 14px; background: #edecea; border: 1px solid rgba(0,0,0,0.08); border-radius: 6px; color: #6b6b66; font-size: 11px; white-space: pre-wrap; word-break: break-word; line-height: 1.6; font-family: 'DM Mono', monospace; margin-top: 8px; }

        @media print {
          .no-print { display: none !important; }
        }

        @media (max-width: 480px) {
          .kot-input-row { flex-direction: column; }
          .kot-input-row .kot-btn { width: 100%; text-align: center; }
          .kot-email-row { flex-direction: column; }
          .kot-tool-inner-wrap { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      {/* ── DARK ZONE: KoT Banner + Hero ── */}

      {/* Tier 1: Brand shelf */}
      <div style={{ display: "flex", overflow: "hidden" }}>
        <div style={{ width: "7px", background: "#861442", flexShrink: 0 }} />
        <div style={{ flex: 1, background: "#1a120e", padding: "7px 1.5rem", display: "flex", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ fontSize: "11px", fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", margin: 0 }}>Knowledge on Tap</p>
        </div>
      </div>

      {/* Hero */}
      <div className="no-print" style={{ padding: "48px clamp(20px,5vw,48px) 64px", maxWidth: "760px", margin: "0 auto" }}>

        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 300, fontSize: "42px", lineHeight: 1.1, letterSpacing: "-0.02em", color: "#f2e4ca", marginBottom: "12px" }}>
          POWER <em style={{ fontStyle: "italic", color: "#be3650" }}>Score</em>
        </h1>

        <p style={{ fontSize: "14px", color: "#f2e4ca", fontFamily: "'DM Mono', monospace", fontWeight: 300, lineHeight: 1.6, marginBottom: "28px" }}>
          Share your URL and get your POWER Score — a free business audit across five categories:
        </p>

        {/* Category pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "36px" }}>
          {POWER_SECTIONS.map(({ letter, label }) => (
            <div key={letter} style={{ fontSize: "11px", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", color: "#f2e4ca", padding: "5px 12px", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "20px" }}>
              <span style={{ color: "#be3650", marginRight: "4px" }}>{letter}</span>{label}
            </div>
          ))}
        </div>

        {/* URL input */}
        <p style={{ fontSize: "11px", fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase", color: "#f2e4ca", marginBottom: "10px" }}>Enter Your URL</p>
        <div className="kot-input-row" style={{ display: "flex", gap: "10px", flexWrap: "wrap", maxWidth: "620px" }}>
          <input
            type="url" value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !loading && handleGenerate()}
            placeholder="yourbusiness.com"
            style={{ flex: 1, minWidth: "200px", padding: "13px 16px", background: "#1a120e", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "10px", color: "#f2e4ca", fontSize: "13px", fontFamily: "'DM Mono', monospace", fontWeight: 300, outline: "none" }}
            onFocus={e => e.target.style.borderColor = "#861442"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.14)"}
          />
          <button className="kot-btn" onClick={handleGenerate} disabled={loading || !url.trim()}>
            {loading ? "Analyzing..." : "Get My Score →"}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ marginTop: "24px" }}>
            <PulseLoader text={progress} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: "20px" }}>
            <p style={{ color: "#c0705a", fontSize: "13px", margin: "0 0 8px", fontFamily: "'DM Mono', monospace" }}>{error}</p>
            {debugInfo && (
              <>
                <button onClick={() => setDebugOpen(o => !o)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#888580", fontSize: "11px", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", cursor: "pointer", padding: "5px 12px" }}>
                  {debugOpen ? "Hide" : "Show"} Debug Info
                </button>
                {debugOpen && <pre style={{ marginTop: "10px", padding: "14px", background: "#1e1510", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#888580", fontSize: "11px", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.6", fontFamily: "'DM Mono', monospace" }}>{debugInfo}</pre>}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── LIGHT ZONE: Report Output ── */}
      {playbook && (
        <div className="kot-report-zone" style={{ animation: "kot-fadeUp 0.6s ease" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 clamp(16px,5vw,48px) 80px" }}>

            <div style={{ paddingTop: "48px", marginBottom: "48px", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 300, fontSize: "clamp(24px,4vw,36px)", letterSpacing: "-0.02em", color: "#1a1a18", marginBottom: "6px" }}>{playbook.businessName}</h2>
              <p style={{ fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#861442", fontFamily: "'DM Mono', monospace", margin: 0 }}>➜ {playbook.dateGenerated}</p>
            </div>

            {/* About */}
            <div className="kot-card kot-anim" style={{ animationDelay: "0.05s" }}>
              <p className="kot-card-label">About</p>
              <p className="kot-card-body">{playbook.orgParagraph}</p>
            </div>

            {/* Score */}
            <div className="kot-card kot-anim" style={{ animationDelay: "0.1s" }}>
              <p className="kot-card-label">Your POWER Score</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "8px" }}>
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 300, fontSize: "clamp(64px,12vw,96px)", lineHeight: 1, letterSpacing: "-0.04em", color: overallColor }}>{sc}</span>
                <span style={{ fontSize: "22px", color: "#6b6b66", fontWeight: 300, paddingBottom: "8px" }}>/100</span>
              </div>
              <p style={{ fontSize: "12px", fontFamily: "'DM Mono', monospace", color: "#6b6b66", letterSpacing: "0.06em", marginBottom: "16px" }}>{playbook.overallDescriptor}</p>
              <div style={{ background: "#edecea", borderRadius: "2px", height: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${sc}%`, background: overallColor, borderRadius: "2px", animation: "kot-scoreBar 1.2s ease forwards" }} />
              </div>
            </div>

            {/* Score paragraph */}
            <div className="kot-narrative kot-anim" style={{ animationDelay: "0.15s" }}>{playbook.scoreParagraph}</div>

            {/* POWER Breakdown */}
            <div className="kot-card kot-anim" style={{ animationDelay: "0.2s" }}>
              <p className="kot-card-label">P·O·W·E·R Breakdown</p>
              {POWER_SECTIONS.map(({ key, letter, label, subtitle }, idx) => {
                const section = playbook[key];
                if (!section) return null;
                return (
                  <div key={key} className="kot-power-row">
                    <div className="kot-power-meta">
                      <span className="kot-power-title"><span className="kot-power-letter">{letter}</span> — {label}: {subtitle}</span>
                      <span className="kot-power-score">{section.score}/20</span>
                    </div>
                    <ScoreBar score={section.score} max={20} />
                    <p className="kot-power-content">{section.content}</p>
                  </div>
                );
              })}
            </div>

            {/* Brand Personality */}
            {playbook.brandPersonality && (
              <div className="kot-card kot-anim" style={{ animationDelay: "0.25s" }}>
                <p className="kot-card-label">Brand Personality</p>
                <p className="kot-card-body">{playbook.brandPersonality}</p>
              </div>
            )}

            {/* Debug */}
            {debugInfo && (
              <div style={{ marginBottom: "16px" }} className="no-print">
                <button className="kot-btn-ghost" onClick={() => setDebugOpen(o => !o)} style={{ fontSize: "11px", padding: "5px 12px" }}>
                  {debugOpen ? "Hide" : "Show"} Fetch Info
                </button>
                {debugOpen && <pre className="kot-debug-pre">{debugInfo}</pre>}
              </div>
            )}

            {/* Phase 2 teasers */}
            {!emailSubmitted && (
              <>
                {[
                  { label: "Industry-Leading Competitors", teaser: "Submit your email below to unlock." },
                  { label: "Trends to Watch", teaser: "Submit your email below to unlock." },
                  { label: "Three Moves Worth Making", teaser: "Submit your email below to unlock." },
                ].map(({ label, teaser }) => (
                  <div key={label} className="kot-card kot-anim">
                    <p className="kot-card-label">{label}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "4px" }}>
                      <span style={{ fontSize: "16px", opacity: 0.35 }}>🔒</span>
                      <span style={{ fontSize: "13px", color: "#6b6b66", fontFamily: "'DM Mono', monospace", fontWeight: 300 }}>{teaser}</span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Email Capture */}
            <div className="kot-card kot-anim no-print" style={{ animationDelay: "0.45s" }}>
              <p className="kot-card-label">Unlock More Intel</p>
              <p className="kot-card-body" style={{ marginBottom: "20px" }}>
                See who's winning your category and what trends they're riding. Drop your email to unlock your competitor and trend intel.
              </p>
              {emailSubmitted ? (
                <p style={{ fontSize: "14px", color: "#0F6E56", fontFamily: "'DM Mono', monospace", fontWeight: 400 }}>✓ Unlocking your expanded report below...</p>
              ) : (
                <>
                  <div className="kot-email-row" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" className="kot-field" style={{ flex: 1, minWidth: "140px" }} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEmailSubmit()} placeholder="Email address" className="kot-field" style={{ flex: 2, minWidth: "200px" }} />
                  </div>
                  <p style={{ fontSize: "11px", color: "#6b6b66", fontFamily: "'DM Mono', monospace", marginBottom: "16px" }}>By submitting, you agree to receive the Let's Make Some Noise newsletter.</p>
                  {emailError && <p style={{ fontSize: "13px", color: "#c0705a", marginBottom: "10px", fontFamily: "'DM Mono', monospace" }}>{emailError}</p>}
                  <button className="kot-btn" onClick={handleEmailSubmit} disabled={emailSubmitting || !email.trim() || !firstName.trim()}>
                    {emailSubmitting ? "Sending..." : "Give Me More Details →"}
                  </button>
                </>
              )}
            </div>

            {/* Phase 2 content */}
            {emailSubmitted && (
              <>
                {/* Competitors */}
                {(intelLoading || intel || intelError) && (
                  <div className="kot-card kot-anim">
                    <p className="kot-card-label">Industry-Leading Competitors</p>
                    {intelLoading && <PulseLoader text="Searching for competitors and trends..." />}
                    {intelError && <p style={{ color: "#c0705a", fontSize: "13px", fontFamily: "'DM Mono', monospace" }}>{intelError}</p>}
                    {intel?.competitors?.map((c, i, arr) => (
                      <div key={i} className="kot-intel-item">
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#1a1a18", marginBottom: "4px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{c.name}</p>
                        <p style={{ fontSize: "13px", lineHeight: 1.75, color: "#1a1a18", fontWeight: 300, marginBottom: "6px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{c.whatTheyDo}</p>
                        <p style={{ fontSize: "13px", lineHeight: 1.75, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 300, color: "#1a1a18" }}>
                          <strong style={{ color: "#861442", fontWeight: 500 }}>Why They're Winning</strong> · {c.whyTheyreWinning}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Trends */}
                {(intelLoading || intel || intelError) && (
                  <div className="kot-card kot-anim">
                    <p className="kot-card-label">Trends to Watch</p>
                    {intelLoading && <PulseLoader text="Pulling industry trends..." />}
                    {intel?.trends?.map((t, i) => (
                      <div key={i} className="kot-intel-item">
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#861442", marginBottom: "4px", fontFamily: "'DM Mono', monospace" }}>{t.title}</p>
                        <p style={{ fontSize: "13px", lineHeight: 1.75, color: "#1a1a18", fontWeight: 300, marginBottom: "6px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{t.insight}</p>
                        <p style={{ fontSize: "13px", lineHeight: 1.75, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 300, color: "#1a1a18" }}>
                          <strong style={{ color: "#861442", fontWeight: 500 }}>How This Relates</strong> · {t.relevance}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Revenue moves */}
                {(revenueLoading || revenue || revenueError) && (
                  <div className="kot-card kot-anim">
                    <p className="kot-card-label">Three Moves Worth Making</p>
                    {revenueLoading && <PulseLoader text="Identifying your highest-leverage moves..." />}
                    {revenueError && <p style={{ color: "#c0705a", fontSize: "13px", fontFamily: "'DM Mono', monospace" }}>{revenueError}</p>}
                    {revenue?.moves?.map((m, i) => (
                      <div key={i} className="kot-move-item">
                        <p style={{ fontSize: "11px", fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase", color: "#861442", marginBottom: "6px" }}>Move {i + 1}</p>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#1a1a18", marginBottom: "8px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{m.title}</p>
                        <p style={{ fontSize: "13px", lineHeight: 1.75, color: "#1a1a18", fontWeight: 300, marginBottom: "6px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{m.context}</p>
                        <p style={{ fontSize: "13px", lineHeight: 1.75, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 300, color: "#1a1a18" }}>
                          <strong style={{ color: "#861442", fontWeight: 500 }}>Next Step</strong> · {m.action}
                        </p>
                      </div>
                    ))}
                    {revenue?.closingLine && (
                      <p style={{ fontSize: "13px", color: "#be3650", fontStyle: "italic", marginTop: "16px", fontFamily: "'DM Mono', monospace" }}>{revenue.closingLine}</p>
                    )}
                  </div>
                )}

                {/* Print */}
                {phase2Done && (
                  <div className="kot-card kot-anim no-print">
                    <p className="kot-card-label">Save This Report</p>
                    <p className="kot-card-body" style={{ marginBottom: "20px" }}>This report isn't saved. Print it before leaving — or lose it. Businesses can only run one report per day.</p>
                    <button className="kot-btn" onClick={() => window.print()}>Print / Save Report →</button>
                  </div>
                )}
              </>
            )}

            {/* CTA */}
            <div className="kot-card kot-anim">
              <p className="kot-card-label">Want to Talk?</p>
              <p className="kot-card-body" style={{ marginBottom: "20px" }}>
                Want to dig into your results — or learn how your organization can deploy AI business intelligence tools?
              </p>
              <a href="https://monicapoling.com/vision" target="_blank" rel="noopener noreferrer" className="kot-btn" style={{ display: "inline-block", textDecoration: "none" }}>
                Book a Vision Call →
              </a>
            </div>

          </div>

          {/* Tier 3: Newsletter — only after value delivered */}
          {emailSubmitted && (
            <div style={{ display: "flex", overflow: "hidden" }}>
              <div style={{ width: "7px", background: "#861442", opacity: 0.2, flexShrink: 0 }} />
              <div style={{ flex: 1, background: "#1a120e", border: "1px solid rgba(255,255,255,0.08)", borderTop: "none", padding: "10px 1.5rem", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em", margin: 0 }}>Let's Make Some Noise</p>
                <input type="email" placeholder="your@email.com" style={{ flex: 1, minWidth: "160px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "5px", color: "#fff", fontSize: "12px", padding: "6px 12px", outline: "none", fontFamily: "'DM Mono', monospace" }} />
                <button style={{ background: "#861442", color: "#fff", border: "none", borderRadius: "5px", fontSize: "11px", fontWeight: 500, letterSpacing: "0.06em", padding: "7px 16px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>Subscribe →</button>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer style={{ padding: "1.2rem clamp(16px,5vw,48px)", borderTop: "1px solid rgba(0,0,0,0.08)", fontSize: "12px", color: "#6b6b66", lineHeight: 1.8, fontFamily: "'DM Mono', monospace" }}>
            <p>The POWER Score is an AI-powered tool from Knowledge on Tap</p>
            <p>Knowledge on Tap | <a href="https://monicapoling.com" target="_blank" rel="noopener noreferrer" style={{ color: "#be3650", textDecoration: "none" }}>Monica Poling</a></p>
          </footer>

        </div>
      )}
    </div>
  );
}
