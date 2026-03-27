import { useState } from "react";

const POWER_SYSTEM_PROMPT = `You are a strategic business analyst creating a POWER Score Report. Your tone is warm, direct, and expert — like a trusted advisor who has done their homework. Avoid jargon like "pipeline," "scale," "leverage," or "synergy." The report should feel written specifically for this organization — not AI generated.

CRITICAL — YOU MUST ACTUALLY FETCH THE WEBSITE:
Step 1: Use the web_fetch tool to retrieve the exact URL provided. Read the actual page content.
Step 2: If web_fetch returns an error or empty content, try these variations in order:
  - Add or remove a trailing slash
  - Add or remove "www."
  - Try the root domain if a subpage was given
Step 3: Only after fetching real content, generate the report based ONLY on what you read.
DO NOT rely on LLM training memory about this organization. If you cannot fetch the page, say so in fetchNote and score conservatively.
All content fields should address the business in second person ("your positioning," "your website," "your story") rather than third person.

Return ONLY valid JSON. No markdown, no preamble, no backticks, no citation tags, no XML markup, no annotation syntax of any kind. Clean JSON only.

SCORING RUBRIC (internal only, do not output as separate field):
18-20: Exceptional | 14-17: Strong with gaps | 10-13: Present but underdeveloped | 6-9: Weak signal | 0-5: Missing or unclear

JSON Schema:
{
  "businessName": "string",
  "dateGenerated": "Month YYYY",
  "overallScore": 72,
  "overallDescriptor": "Category Leader | Strong Foundation, Underloaded Story | Solid Presence, Clear Gaps | Underdeveloped Positioning | Significant Opportunity",
  "orgParagraph": "2-3 sentences, 60 words max. Business name, what they do, one specific genuine thing worth paying attention to. Warm, like introducing them to a smart friend. Based ONLY on fetched content.",
  "scoreParagraph": "2-3 sentences, 60 words max. Punchy one-liner capturing the essence, then what's working and the primary gap. Specific, warm, no generics. Based ONLY on fetched content.",
  "prestige":    { "score": 14, "content": "2-3 sentences, 65 words max. Warm, observational. Reference specific things found on the actual website." },
  "origin":      { "score": 12, "content": "2-3 sentences, 65 words max. Warm, observational. Reference specific things found on the actual website." },
  "wow":         { "score": 16, "content": "2-3 sentences, 65 words max. Warm, observational. Reference specific things found on the actual website." },
  "expertise":   { "score": 10, "content": "2-3 sentences, 65 words max. Warm, observational. Reference specific things found on the actual website." },
  "reputation":  { "score": 8,  "content": "2-3 sentences, 65 words max. Warm, observational. Reference specific things found on the actual website." },
  "brandPersonality": "2-3 sentences, 60 words max. Start with business name. Personality projected, then the friction. Based ONLY on fetched content.",
  "urlsAttempted": ["https://example.com"],
  "fetchSuccess": true,
  "fetchNote": "Optional — only if fetch issues or if content was sparse."
}

overallScore = sum of five scores (each /20, total /100).
90-100: Category Leader | 75-89: Strong Foundation, Underloaded Story | 60-74: Solid Presence, Clear Gaps | 45-59: Underdeveloped Positioning | Below 45: Significant Opportunity`;

const INTEL_SYSTEM_PROMPT = `You are a strategic market analyst. Given a POWER Score JSON, use web search to find current competitive intelligence.
Return ONLY valid JSON. No markdown, no preamble, no backticks. All content in second person.
{
  "competitors": [{"name":"string","whatTheyDo":"string","whyTheyreWinning":"string"}],
  "trends": [{"title":"string","insight":"string","relevance":"string"}]
}
2 real named competitors. 3 relevant industry trends. Specific. Warm, direct tone.`;

const REVENUE_SYSTEM_PROMPT = `You are a strategic revenue advisor. Given a POWER Score JSON, identify three high-leverage revenue moves.
Return ONLY valid JSON. No markdown, no preamble, no backticks.
{"moves":[{"title":"string","context":"string","action":"string"}],"closingLine":"string"}
Exactly 3 moves grounded in specific report findings. Trusted advisor tone.`;

function normalizeUrl(input) {
  let url = input.trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url.replace(/\/+$/, "");
}

async function callAPI(system, messages, useSearch = false) {
  const body = { model: "claude-sonnet-4-20250514", max_tokens: 3000, system, messages };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const r = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const tb = data.content?.find((b) => b.type === "text");
  if (!tb) throw new Error("No text block in response.");
  const clean = tb.text.replace(/```json|```/g, "").replace(/<[^>]*cite[^>]*>/gi, "").trim();
  return JSON.parse(clean);
}

async function generatePlaybook(rawUrl) {
  const url = normalizeUrl(rawUrl);
  return callAPI(POWER_SYSTEM_PROMPT, [{
    role: "user",
    content: `You MUST use web_search to fetch and read the live website before scoring. Search for the exact URL: ${url}

Do not use anything from memory. Only score based on content you actually retrieve right now.

Try in order if needed:
1. ${url}
2. ${url}/
3. ${url.replace(/^https:\/\//, "https://www.")}
4. ${url.replace(/^https:\/\/www\./, "https://")}

Record every URL attempted in urlsAttempted. If you cannot retrieve real content, set fetchSuccess to false and explain in fetchNote. Return the full JSON.`
  }], true);
}

async function generateIntel(p) {
  return callAPI(INTEL_SYSTEM_PROMPT, [{
    role: "user",
    content: `POWER Score:\n\n${JSON.stringify(p, null, 2)}\n\nFind top 2 competitors and 3 industry trends. Return the JSON.`
  }], true);
}

async function generateRevenue(p) {
  return callAPI(REVENUE_SYSTEM_PROMPT, [{
    role: "user",
    content: `POWER Score:\n\n${JSON.stringify(p, null, 2)}\n\nIdentify the three highest-leverage revenue moves. Return the JSON.`
  }]);
}

const POWER_SECTIONS = [
  { key: "prestige",   letter: "P", label: "Prestige",   sub: "Do You Own Your Category?" },
  { key: "origin",     letter: "O", label: "Ownership",  sub: "What's Your Origin Story?" },
  { key: "wow",        letter: "W", label: "Wow Factor", sub: "What Makes You Unforgettable?" },
  { key: "expertise",  letter: "E", label: "Expertise",  sub: "Do You Demonstrate Clear Expertise?" },
  { key: "reputation", letter: "R", label: "Reputation", sub: "Are You the Voice of Your Industry?" },
];

const LOAD_STEPS = [
  "Pulling up your site...",
  "Wow! This is great stuff...",
  "Evaluating your P·O·W·E·R...",
  "Personality, deconstructed...",
  "Love what you're doing...",
  "Calculating your POWER Score...",
];

function PulseLoader({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%", background: "#861442",
        display: "inline-block", animation: "kot-pulse 1.2s ease-in-out infinite", flexShrink: 0,
      }} />
      <span style={{ fontSize: 13, color: "#6b6b66", fontStyle: "italic", fontWeight: 300 }}>{text}</span>
    </div>
  );
}

function ScoreBar({ score, max }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div style={{ background: "#2e2e2b", borderRadius: 2, height: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: "#861442", borderRadius: 2, animation: "kot-bar 1.2s ease forwards" }} />
    </div>
  );
}

function Checkmark() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8">
      <polyline points="1,4 3,6 7,2" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

  const [footerFirstName, setFooterFirstName] = useState("");
  const [footerEmail, setFooterEmail] = useState("");
  const [footerSubscribe, setFooterSubscribe] = useState(false);
  const [footerVision, setFooterVision] = useState(false);
  const [footerSubmitted, setFooterSubmitted] = useState(false);

  const phase2Done = intel && revenue;
  const sc = playbook?.overallScore || 0;

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
      setError("Oops — looks like AI gremlins are up to no good. Try again.");
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
    } catch {
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleFooterSubmit = async () => {
    if (!footerEmail.trim() || !footerFirstName.trim()) return;
    try {
      await fetch("https://script.google.com/macros/s/AKfycbxtCPP6q6wqCUYlSEtNdyQxFF_22K94lvgP4MJytXYX-kWqpCYkZnXG7tYV5fSZThYj/exec", {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "footer_submit", timestamp: new Date().toISOString(), firstName: footerFirstName.trim(), email: footerEmail.trim(), subscribe: footerSubscribe, visionCall: footerVision, browser: navigator.userAgent })
      });
      setFooterSubmitted(true);
    } catch { /* silent */ }
  };

  const runPhase2 = async () => {
    setIntelLoading(true);
    setRevenueLoading(true);
    const [intelResult, revenueResult] = await Promise.allSettled([
      generateIntel(playbook),
      generateRevenue(playbook),
    ]);
    if (intelResult.status === "fulfilled") setIntel(intelResult.value);
    else setIntelError("Could not load competitor and trend data.");
    setIntelLoading(false);
    if (revenueResult.status === "fulfilled") setRevenue(revenueResult.value);
    else setRevenueError("Could not load revenue mapping.");
    setRevenueLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1a1a18", color: "#f0ede8" }}>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #1a1a18; --surface: #242422; --surface2: #2e2e2b;
          --border: rgba(255,255,255,0.08); --border2: rgba(255,255,255,0.14);
          --text: #f0ede8; --muted: #8a8a84;
          --accent: #861442; --accent2: #be3650;
          --font-display: 'Fraunces', Georgia, serif;
          --font-body: 'Plus Jakarta Sans', sans-serif;
          --radius: 10px;
        }
        body { font-family: var(--font-body); background: #1a1a18; }
        @keyframes kot-pulse { 0%,100%{opacity:.25;transform:scale(1)} 50%{opacity:1;transform:scale(1.5)} }
        @keyframes kot-bar { from { width: 0 } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .kot-anim { animation: fadeUp 0.5s ease both; }

        .kot-tier1 { width:100%; background:#111110; padding:7px clamp(16px,4vw,2rem); display:flex; align-items:center; border-bottom:1px solid rgba(255,255,255,0.06); }
        .kot-tier1-label { font-family:var(--font-body); font-size:12px; font-weight:400; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.35); }

        .kot-hero { width:100%; background:#111110; padding:2.25rem clamp(16px,4vw,2rem) 2rem; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; gap:1.5rem; }
        .kot-hero-svg { flex-shrink:0; }
        .kot-hero-title { font-family:var(--font-display); font-weight:300; font-size:24px; line-height:1.3; color:#fff; margin-bottom:10px; letter-spacing:-0.01em; }
        .kot-hero-title strong { font-weight:700; color:#fff; font-style:normal; }
        .kot-hero-title em { font-style:italic; font-weight:300; color:#be3650; }
        .kot-hero-txt { font-family:var(--font-body); font-size:14px; font-weight:300; color:rgba(255,255,255,0.6); line-height:1.7; }

        .kot-input-zone { background:#111110; padding:clamp(28px,5vw,44px) clamp(16px,4vw,2rem) clamp(32px,5vw,48px); border-top:1px solid rgba(255,255,255,0.06); }
        .kot-input-card { background:#1a1a18; border:1.5px solid rgba(134,20,66,0.5); border-radius:var(--radius); padding:1.5rem; max-width:620px; }
        .kot-input-label { font-family:var(--font-body); font-size:11px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:12px; }
        .kot-input-row { display:flex; gap:10px; flex-wrap:wrap; }

        .btn-primary { background:#861442 !important; color:#ffffff !important; border:none; font-family:var(--font-body); font-size:13px; font-weight:500; padding:10px 22px; border-radius:var(--radius); cursor:pointer; letter-spacing:0.04em; transition:opacity 0.15s,transform 0.1s; white-space:nowrap; }
        .btn-primary:hover { opacity:0.88; }
        .btn-primary:active { transform:scale(0.97); }
        .btn-primary:disabled { opacity:0.35; cursor:not-allowed; }
        .btn-ghost { background:transparent; color:var(--text); border:1px solid var(--border2); font-family:var(--font-body); font-size:13px; padding:10px 18px; border-radius:var(--radius); cursor:pointer; transition:color 0.15s,border-color 0.15s; }
        .btn-ghost:hover { color:#be3650; border-color:#be3650; }

        .kot-report-zone { background:var(--bg); padding:0 clamp(16px,4vw,2rem) 80px; }
        .kot-report-head { padding:36px 0 24px; border-bottom:1px solid var(--border); }
        .kot-report-name { font-family:var(--font-display); font-weight:300; font-size:clamp(22px,4vw,36px); letter-spacing:-0.02em; color:var(--text); margin-bottom:6px; line-height:1.1; }
        .kot-report-date { font-family:var(--font-body); font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#be3650; }

        .card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:clamp(18px,4vw,24px) clamp(18px,4vw,28px); margin-bottom:14px; }
        .card-label { font-family:var(--font-body); font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#be3650; margin-bottom:14px; }
        .card-body { font-family:var(--font-body); font-size:14px; font-weight:300; line-height:1.8; color:var(--text); }
        .narrative-box { background:var(--surface); border:1px solid var(--border); border-left:3px solid #861442; border-radius:0 var(--radius) var(--radius) 0; padding:clamp(14px,3vw,20px) clamp(16px,3vw,24px); font-family:var(--font-body); font-size:14px; line-height:1.8; color:var(--text); font-weight:300; margin-bottom:14px; }

        .kot-score-num { font-family:var(--font-display); font-weight:300; font-style:italic; font-size:clamp(72px,13vw,108px); line-height:1; letter-spacing:-0.04em; color:#be3650; }
        .kot-score-den { font-family:var(--font-display); font-size:22px; font-weight:300; color:var(--muted); padding-bottom:8px; }

        .power-row { padding:18px 0; border-bottom:1px solid var(--border); }
        .power-row:first-child { padding-top:0; }
        .power-row:last-child { border-bottom:none; padding-bottom:0; }
        .power-meta { display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:8px; }
        .power-title { font-family:var(--font-body); font-size:12px; font-weight:500; color:var(--text); }
        .power-letter { color:#be3650; margin-right:4px; }
        .power-score-val { font-family:var(--font-body); font-size:12px; font-weight:500; color:var(--muted); white-space:nowrap; }
        .power-content { font-family:var(--font-body); font-size:13px; font-weight:300; line-height:1.75; color:rgba(255,255,255,0.7); margin-top:10px; }

        .intel-row { padding:18px 0; border-bottom:1px solid var(--border); }
        .intel-row:first-child { padding-top:0; }
        .intel-row:last-child { border-bottom:none; padding-bottom:0; }
        .intel-name { font-family:var(--font-body); font-size:14px; font-weight:500; color:var(--text); margin-bottom:4px; }
        .intel-body { font-family:var(--font-body); font-size:13px; font-weight:300; line-height:1.75; color:rgba(255,255,255,0.7); margin-bottom:5px; }
        .intel-accent { color:#be3650; font-weight:500; margin-right:6px; }

        .kot-field { width:100%; padding:10px 14px; background:#111110 !important; border:1px solid rgba(255,255,255,0.12); border-radius:var(--radius); color:#f0ede8 !important; font-family:var(--font-body); font-size:13px; outline:none; transition:border-color 0.2s; -webkit-text-fill-color:#f0ede8; }
        .kot-field:focus { border-color:#861442; }
        .kot-field::placeholder { color:#5a5a56; opacity:1; }

        .kot-debug-pre { padding:14px; background:var(--surface2); border:1px solid var(--border); border-radius:6px; color:var(--muted); font-size:12px; white-space:pre-wrap; word-break:break-word; line-height:1.6; font-family:var(--font-body); margin-top:8px; }

        .page-footer-rule { width:100%; height:1.5px; background:rgba(134,20,66,0.5); }
        .page-footer { background:#0d0d0c; padding:1.25rem clamp(16px,4vw,2rem); font-family:var(--font-body); }
        .footer-copy { font-size:11px; color:rgba(255,255,255,0.2); letter-spacing:0.03em; }
        .footer-copy-link { color:rgba(255,255,255,0.3); text-decoration:none; }
        .footer-copy-link:hover { color:#be3650; }
        .footer-submitted { font-size:12px; color:#4caf8a; margin-top:10px; }

        @media print { .no-print { display:none !important; } body { background:#fff; color:#000; } }
        @media (max-width:600px) {

          .kot-input-row { flex-direction:column; }
        }
      `}</style>

      {/* ── Constrained wrapper — everything inside this ── */}
      <div style={{ maxWidth: 860, margin: "0 auto", overflow: "hidden" }}>

        {/* SEO: visually hidden h1 — readable by crawlers, invisible to users */}
        <h1 style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
          POWER Score — Free AI Business Audit | Knowledge on Tap
        </h1>

        {/* Tier 1 */}
        <div className="kot-tier1 no-print">
          <span className="kot-tier1-label">Knowledge on Tap</span>
        </div>

        {/* Hero */}
        <div className="kot-hero no-print">
          <svg width="54" height="54" viewBox="0 0 54 54" fill="none" className="kot-hero-svg" xmlns="http://www.w3.org/2000/svg">
            <rect x="0"  y="0"  width="24" height="24" fill="#ffffff" opacity="0.9" />
            <rect x="30" y="0"  width="24" height="24" fill="#861442" opacity="0.85" />
            <rect x="0"  y="30" width="24" height="24" fill="#ffffff" opacity="0.2" />
            <rect x="30" y="30" width="24" height="24" fill="#ffffff" opacity="0.4" />
          </svg>
          <div>
            <h1 className="kot-hero-title"><strong>POWER</strong> <em>Score</em></h1>
            <p className="kot-hero-txt">
              Share your URL and get your POWER Score — a free business audit across five categories: Prestige, Ownership, Wow Factor, Expertise, and Reputation.
            </p>
          </div>
        </div>

        {/* Input zone */}
        <div className="kot-input-zone no-print">
          <div className="kot-input-card">
            <p className="kot-input-label">Enter Your URL</p>
            <div className="kot-input-row">
              <input
                type="url" value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
                placeholder="yourbusiness.com"
                style={{
                  flex: 1, minWidth: 200, padding: "10px 14px",
                  background: "#111110", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10, color: "#f0ede8", WebkitTextFillColor: "#f0ede8",
                  fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 300,
                  outline: "none",
                }}
              />
              <button className="btn-primary" onClick={handleGenerate} disabled={loading || !url.trim()}>
                {loading ? "Analyzing..." : "Get My Score →"}
              </button>
            </div>
          </div>
          {loading && <div style={{ marginTop: 18 }}><PulseLoader text={progress} /></div>}
          {error && (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: "#c0705a", fontSize: 13, fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 8 }}>{error}</p>
              {debugInfo && (
                <>
                  <button className="btn-ghost" onClick={() => setDebugOpen(o => !o)} style={{ fontSize: 12, padding: "5px 12px" }}>
                    {debugOpen ? "Hide" : "Show"} debug info
                  </button>
                  {debugOpen && <pre className="kot-debug-pre">{debugInfo}</pre>}
                </>
              )}
            </div>
          )}
        </div>

        {/* Report */}
        {playbook && (
          <div className="kot-report-zone" style={{ animation: "fadeUp 0.5s ease both" }}>
            <div className="kot-report-head kot-anim">
              <h2 className="kot-report-name">{playbook.businessName}</h2>
              <p className="kot-report-date">➜ {playbook.dateGenerated}</p>
            </div>

            {/* 1 — POWER Score */}
            <div className="card kot-anim" style={{ animationDelay: "0.05s", marginTop: 14 }}>
              <p className="card-label">Your POWER Score</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                <span className="kot-score-num">{sc}</span>
                <span className="kot-score-den">/100</span>
              </div>
              <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, color: "#8a8a84", letterSpacing: "0.06em", marginBottom: 16 }}>
                {playbook.overallDescriptor}
              </p>
              <div style={{ background: "#2e2e2b", borderRadius: 2, height: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${sc}%`, background: "#861442", borderRadius: 2, animation: "kot-bar 1.2s ease forwards" }} />
              </div>
            </div>

            {/* 2 — Consolidated: About + Brand Personality + About Your Score */}
            <div className="card kot-anim" style={{ animationDelay: "0.1s" }}>
              <p className="card-label">About {playbook.businessName}</p>
              <p className="card-body">{playbook.orgParagraph}</p>

              {playbook.brandPersonality && (
                <>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "20px 0" }} />
                  <p className="card-label">Brand Personality</p>
                  <p className="card-body">{playbook.brandPersonality}</p>
                </>
              )}

              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "20px 0" }} />
              <p className="card-label">About Your Score</p>
              <p className="card-body">{playbook.scoreParagraph}</p>
            </div>

            {/* 3 — P·O·W·E·R Score Breakdown */}
            <div className="card kot-anim" style={{ animationDelay: "0.15s" }}>
              <p className="card-label">P·O·W·E·R Score Breakdown</p>
              {POWER_SECTIONS.map(({ key, letter, label, sub }) => {
                const section = playbook[key];
                if (!section) return null;
                return (
                  <div key={key} className="power-row">
                    <div className="power-meta">
                      <span className="power-title"><span className="power-letter">{letter}</span>— {label}: {sub}</span>
                      <span className="power-score-val">{section.score}/20</span>
                    </div>
                    <ScoreBar score={section.score} max={20} />
                    <p className="power-content">{section.content}</p>
                  </div>
                );
              })}
            </div>

            {debugInfo && (
              <div style={{ marginBottom: 14 }} className="no-print">
                <button className="btn-ghost" onClick={() => setDebugOpen(o => !o)} style={{ fontSize: 12, padding: "5px 12px" }}>
                  {debugOpen ? "Hide" : "Show"} fetch info
                </button>
                {debugOpen && <pre className="kot-debug-pre">{debugInfo}</pre>}
              </div>
            )}



            {!emailSubmitted && (
              <div className="card kot-anim no-print" style={{ animationDelay: "0.4s" }}>
                <p className="card-label">Unlock More Intel</p>
                <p className="card-body" style={{ marginBottom: 16 }}>
                  Want to see your top competitors and industry trends? Drop your email to unlock.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {["Industry-leading competitors", "Trends to watch", "Three revenue moves worth making"].map((item) => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="8" fill="#2a5c3f"/>
                        <polyline points="4,8 7,11 12,5" stroke="#4caf8a" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 300, color: "rgba(255,255,255,0.75)" }}>{item}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name" className="kot-field" style={{ flex: 1, minWidth: 140 }} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                    placeholder="Email address" className="kot-field" style={{ flex: 2, minWidth: 200 }} />
                </div>
                {emailError && <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: "#c0705a", marginBottom: 10 }}>{emailError}</p>}
                <button className="btn-primary" onClick={handleEmailSubmit}
                  disabled={emailSubmitting || !email.trim() || !firstName.trim()}
                  style={{ marginBottom: 12 }}>
                  {emailSubmitting ? "Sending..." : "Give me more intel →"}
                </button>
                <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, color: "#5a5a56", lineHeight: 1.6 }}>
                  By submitting, you understand you'll be subscribed to the Let's Make Some Noise newsletter. You may unsubscribe any time.
                </p>
              </div>
            )}

            {emailSubmitted && (
              <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: "#4caf8a", marginBottom: 14 }}>
                ✓ Unlocking your expanded report below...
              </p>
            )}

            {emailSubmitted && (intelLoading || intel || intelError) && (
              <div className="card kot-anim">
                <p className="card-label">Industry-leading competitors</p>
                {intelLoading && <PulseLoader text="Searching for competitors and trends..." />}
                {intelError && <p style={{ color: "#c0705a", fontSize: 13 }}>{intelError}</p>}
                {intel?.competitors?.map((c, i) => (
                  <div key={i} className="intel-row">
                    <p className="intel-name">{c.name}</p>
                    <p className="intel-body">{c.whatTheyDo}</p>
                    <p className="intel-body"><span className="intel-accent">Why they're winning</span>{c.whyTheyreWinning}</p>
                  </div>
                ))}
              </div>
            )}

            {emailSubmitted && (intelLoading || intel || intelError) && (
              <div className="card kot-anim">
                <p className="card-label">Trends to watch</p>
                {intelLoading && <PulseLoader text="Pulling industry trends..." />}
                {intel?.trends?.map((t, i) => (
                  <div key={i} className="intel-row">
                    <p className="intel-name" style={{ color: "#be3650" }}>{t.title}</p>
                    <p className="intel-body">{t.insight}</p>
                    <p className="intel-body"><span className="intel-accent">How this relates</span>{t.relevance}</p>
                  </div>
                ))}
              </div>
            )}

            {emailSubmitted && (revenueLoading || revenue || revenueError) && (
              <div className="card kot-anim">
                <p className="card-label">Three moves worth making</p>
                {revenueLoading && <PulseLoader text="Identifying your highest-leverage moves..." />}
                {revenueError && <p style={{ color: "#c0705a", fontSize: 13 }}>{revenueError}</p>}
                {revenue?.moves?.map((m, i) => (
                  <div key={i} className="intel-row">
                    <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#be3650", marginBottom: 6 }}>
                      Move {i + 1}
                    </p>
                    <p className="intel-name">{m.title}</p>
                    <p className="intel-body">{m.context}</p>
                    <p className="intel-body"><span className="intel-accent">Next step</span>{m.action}</p>
                  </div>
                ))}
                {revenue?.closingLine && (
                  <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: "#be3650", fontStyle: "italic", marginTop: 16 }}>
                    {revenue.closingLine}
                  </p>
                )}
              </div>
            )}

            {/* Print — subtle, only when report is done */}
            {phase2Done && (
              <div className="no-print" style={{ textAlign: "right", marginBottom: 8 }}>
                <button className="btn-ghost" style={{ fontSize: 12, padding: "7px 16px" }} onClick={() => window.print()}>
                  Print / save this report →
                </button>
              </div>
            )}

            {/* Vision Call — the closer */}
            <div className="card kot-anim">
              <p className="card-label">Ready to dig in?</p>
              <p className="card-body" style={{ marginBottom: 20 }}>
                Book a free Vision Call to walk through your results and map out what's next.
              </p>
              <a href="https://monicapoling.com/vision" target="_blank" rel="noopener noreferrer"
                className="btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
                Book a Vision Call →
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="page-footer-rule" />
        <footer className="page-footer">
          <p className="footer-copy">
            © {new Date().getFullYear()} The POWER Score &nbsp;·&nbsp; Knowledge on Tap &nbsp;·&nbsp;{" "}
            <a className="footer-copy-link" href="https://monicapoling.com/knowledge-on-tap" target="_blank" rel="noopener noreferrer">
              monicapoling.com/knowledge-on-tap
            </a>
          </p>
        </footer>

      </div>
      {/* ── End constrained wrapper ── */}

    </div>
  );
}
